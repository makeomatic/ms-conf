import { strict as assert } from 'node:assert'
import _debug from 'debug'
import camelCase from 'camelcase'
import nconf from 'nconf'
import dotenv from 'dotenv'
import mergeFactory from '@fastify/deepmerge'
import fs from 'node:fs/promises'
import { glob } from 'glob'
import path from 'path'
import parse from 'secure-json-parse'

const debug = _debug('ms-conf')
const { hasOwnProperty } = Object.prototype
const { isArray } = Array
const { env } = process
const verbose = hasOwnProperty.call(env, 'DOTENV_NOT_SILENT') === false
const cwd = process.cwd()
const merge = mergeFactory({
  mergeArray: () => (_, source) => {
    return source
  }
})

// safe json parse
function parseJSONSafe(possibleJSON: string): unknown {
  try {
    return parse(possibleJSON)
  } catch (e) {
    return possibleJSON
  }
}

// make camelCase keys
const camelCaseKeys = (camelize: boolean) => function processKeys(obj: Record<string, unknown>, value: unknown, key: string) {
  const camelized = camelize ? key : camelCase(key)

  if (value == null) {
    obj[camelized] = value
    return obj
  }

  if (typeof value === 'object') {
    const gatherer = obj[camelized] = Object.create(null)
    for (const [innerKey, innerValue] of Object.entries(value)) {
      processKeys(gatherer, innerValue, innerKey)
    }
  } else if (typeof value === 'string') {
    obj[camelized] = parseJSONSafe(value)
  } else {
    obj[camelized] = value
  }

  return obj
}

const importOrRequire = async (absPath: string) => {
  try {
    return require(absPath)
  } catch (err) {
    return import(absPath)
  }
}

// read file from path and try to parse it
const mergeFileFactory = (crashOnError: boolean, allowDynamicImport: boolean) => {
  return async (configuration: Record<string, unknown>, absPath: string): Promise<Record<string, unknown>> => {
    assert(path.isAbsolute(absPath), `${absPath} must be an absolute path`)

    try {
      debug('loading %s', absPath)

      let data
      if (absPath.endsWith('.json')) {
        data = parse(await fs.readFile(absPath))
      } else if (allowDynamicImport) {
        data = await importOrRequire(absPath).then(m => m.default || m)
      } else {
        data = require(absPath)
      }

      debug('loaded', data)

      return merge(configuration, data)
    } catch (err: any) {
      if (crashOnError) {
        throw err
      } else {
        process.stderr.write(`Failed to include file ${absPath}, err: ${err.message}\n`)
        return configuration
      }
    }
  }
}

export function possibleJSONStringToArray(filePaths: string): string[] {
  let files
  try {
    files = JSON.parse(filePaths)
  } catch (e) {
    files = [filePaths]
  }

  if (!isArray(files)) {
    throw new Error('NCONF_FILE_PATH must be a stringified array or a string')
  }

  return files
}

async function resolveAbsPaths(paths: string[]): Promise<string[]> {
  debug('resolving abs paths for %j', paths)
  const absolutePaths = new Set<string>()

  for (const filePath of paths) {
    debug('evaluating %s', filePath)
    const stats = await fs.stat(filePath)
    if (stats.isFile()) {
      debug('isFile')
      absolutePaths.add(require.resolve(filePath))
      debug('file added', require.resolve(filePath))
    } else if (stats.isDirectory()) {
      // NOTE: can be improved
      // this is an extra call, but we dont care since it's a one-time op
      const absPaths = await glob(`${filePath}/*.{ts,cts,mts,js,cjs,mjs,json}`, {
        absolute: true,
        ignore: '/**/*.d.ts'
      })

      debug('isDir - %s - %j', filePath, absPaths)
      for (const path of absPaths) {
        absolutePaths.add(path)
      }
    } else {
      debug('ignoring %s', filePath)
    }
  }

  debug('prepared abs paths set - %j', Array.from(absolutePaths))

  return Array.from(absolutePaths)
}

export async function globFiles(
  prependFile: string | undefined,
  filePaths: string | string[] | undefined = [],
  configuration: Record<string, unknown> = Object.create(null),
  crashOnError = true,
  allowDynamicImport = true
): Promise<Record<string, unknown>> {
  // if we get parsed JSON array - use it right away
  const files = isArray(filePaths)
    ? filePaths
    : possibleJSONStringToArray(filePaths)

  if (typeof prependFile === 'string') {
    files.unshift(prependFile)
  }

  // prepare merger
  const mergeFile = mergeFileFactory(crashOnError, allowDynamicImport)

  // resolve paths and merge
  for (const file of await resolveAbsPaths(files)) {
    debug('merging config for %s', file)
    configuration = await mergeFile(configuration, file)
    debug('merged - prepared %j', configuration)
  }

  return configuration
}

export type ConfigurationOpts = {
  crashOnError: boolean,
  prependFile?: string,
  appendConfiguration?: Record<any, any>
  allowDynamicImport?: boolean
}

export async function loadConfiguration({
  crashOnError,
  prependFile,
  appendConfiguration,
  allowDynamicImport
}: ConfigurationOpts): Promise<Record<string, unknown>> {
  // load dotenv
  const dotenvConfig = {
    verbose,
    encoding: env.DOTENV_ENCODING || 'utf-8',
    path: env.DOTENV_FILE_PATH || `${cwd}/.env`,
  }

  // load dotenv and report error
  const result = dotenv.config(dotenvConfig)
  if (result.error) {
    debug('failed to load %s due to', dotenvConfig.path, result.error)
  }

  // do we camelize?
  const camelize = hasOwnProperty.call(env, 'NCONF_NO_CAMELCASE')
  const namespaceKey = env.NCONF_NAMESPACE
  const filePaths = env.NCONF_FILE_PATH

  // if we don't have it yet
  assert(namespaceKey, 'NCONF_NAMESPACE must be present in order to parse your configuration')

  // init nconf store
  nconf.use('memory')
  nconf.reset()
  nconf.argv()
  nconf.env({
    separator: env.NCONF_SEPARATOR || '__',
    match: hasOwnProperty.call(env, 'NCONF_MATCH') ? new RegExp(env.NCONF_MATCH as string, env.NCONF_MATCH_OPTS) : null,
    whitelist: hasOwnProperty.call(env, 'NCONF_WHITELIST') ? JSON.parse(env.NCONF_WHITELIST as string) : null,
  })

  // pull camelCase data
  const namespace = nconf.get(namespaceKey)
  const configFromEnv = Object.create(null)

  // if there is anything for recording
  debug('retrieved namespace', namespace)
  if (namespace) {
    assert(typeof namespace === 'object' && namespace !== null && !Array.isArray(namespace), 'namespace must be a js object')
    const normalizer = camelCaseKeys(camelize)
    for (const [key, value] of Object.entries(namespace)) {
      normalizer(configFromEnv, value, key)
    }
  }
  debug('normalized config - %j', configFromEnv)

  let config = Object.create(null)
  if (filePaths || prependFile) {
    // nconf file does not merge configuration, it will either omit it
    // or overwrite it, since it's JSON and is already parsed, what we will
    // do is pass it into configuration as is after it was already camelCased and merged
    //
    // nconf.file(env.NCONF_FILE_PATH);

    debug('globbing files', prependFile, filePaths)
    config = await globFiles(prependFile, filePaths, config, crashOnError, allowDynamicImport)
    debug('result\n%j', config)
  }

  debug('merging env\n%j', configFromEnv)
  config = merge(config, configFromEnv)
  debug('result\n%j', config)

  if (appendConfiguration !== undefined) {
    debug('appending config: %j', appendConfiguration)
    config = merge(config, appendConfiguration)
    debug('result: %j', config)
  }

  debug('prepared config\n%j', config)
  return config
}
