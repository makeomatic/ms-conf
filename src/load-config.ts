import { strict as assert } from 'node:assert'
import _debug from 'debug'
import camelCase from 'camelcase'
import nconf from 'nconf'
import dotenv from 'dotenv'
import mergeFactory from '@fastify/deepmerge'
import fs from 'node:fs'
import { sync } from 'glob'
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

// read file from path and try to parse it
const readFileFactory = (crashOnError: boolean) => (configuration: Record<string, unknown>, absPath: string): Record<string, unknown> => {
  assert(path.isAbsolute(absPath), `${absPath} must be an absolute path`)

  try {
    // delete loaded file
    delete require.cache[absPath]
    debug('loading %s', absPath)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return merge(configuration, require(absPath))
  } catch (err: any) {
    if (crashOnError) {
      throw err
    } else {
      process.stderr.write(`Failed to include file ${absPath}, err: ${err.message}\n`)
      return configuration
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

function resolve(filePath: string): string {
  return require.resolve(filePath)
}

function resolveAbsPaths(paths: string[]): string[] {
  const absolutePaths = paths.reduce((resolvedPaths: string[], filePath) => {
    const stats = fs.statSync(filePath)
    if (stats.isFile()) {
      resolvedPaths.push(resolve(filePath))
    } else if (stats.isDirectory()) {
      // NOTE: can be improved
      // this is an extra call, but we dont care since it's a one-time op
      const absPaths = sync(`${filePath}/*.{ts,js,cjs,json}`)
        .map(resolve)
        .filter((x) => x.endsWith('.d.ts') === false)

      resolvedPaths.push(...absPaths)
    }

    return resolvedPaths
  }, [])

  return Array.from(new Set(absolutePaths))
}

export function globFiles(
  prependFile: string | undefined,
  filePaths: string | string[] | undefined = [],
  configuration: Record<string, unknown> = Object.create(null),
  crashOnError = true
): Record<string, unknown> {
  // if we get parsed JSON array - use it right away
  const files = isArray(filePaths)
    ? filePaths
    : possibleJSONStringToArray(filePaths)

  if (typeof prependFile === 'string') {
    files.unshift(prependFile)
  }

  // prepare merger
  const mergeFile = readFileFactory(crashOnError)

  // resolve paths and merge
  for (const file of resolveAbsPaths(files)) {
    configuration = mergeFile(configuration, file)
  }

  return configuration
}

export function loadConfiguration(crashOnError: boolean, prependFile?: string, appendConfiguration?: any): Record<string, unknown> {
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
  if (namespace) {
    assert(typeof namespace === 'object' && namespace !== null && !Array.isArray(namespace), 'namespace must be a js object')
    const normalizer = camelCaseKeys(camelize)
    for (const [key, value] of Object.entries(namespace)) {
      normalizer(configFromEnv, value, key)
    }
  }

  let config = Object.create(null)
  if (filePaths || prependFile) {
    // nconf file does not merge configuration, it will either omit it
    // or overwrite it, since it's JSON and is already parsed, what we will
    // do is pass it into configuration as is after it was already camelCased and merged
    //
    // nconf.file(env.NCONF_FILE_PATH);

    debug('globbing files', prependFile, filePaths)
    config = globFiles(prependFile, filePaths, config, crashOnError)
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
