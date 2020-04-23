import { strict as assert } from 'assert'
import _debug = require('debug')
import camelCase = require('camelcase');
import nconf = require('nconf');
import dotenv = require('dotenv');
import reduce = require('lodash.reduce');
import merge = require('lodash.mergewith');
import uniq = require('lodash.uniq');
import fs = require('fs');
import glob = require('glob');
import path = require('path');

const debug = _debug('ms-conf')
const { hasOwnProperty } = Object.prototype
const { isArray } = Array
const { env } = process
const verbose = hasOwnProperty.call(env, 'DOTENV_NOT_SILENT') === false
const cwd = process.cwd()

let appendConfiguration: any

// safe json parse
function parseJSONSafe(possibleJSON: string) {
  try {
    return JSON.parse(possibleJSON)
  } catch (e) {
    return possibleJSON
  }
}

// make camelCase keys
const camelCaseKeys = (camelize: boolean) => function processKeys(obj: any, value: any, key: string) {
  const camelized = camelize ? key : camelCase(key)

  if (value && typeof value === 'object') {
    reduce(value, processKeys, (obj[camelized] = {}))
  } else {
    obj[camelized] = parseJSONSafe(value)
  }

  return obj
}

/**
 * @param _ overwrite value, not used
 * @param srcValue
 */
const customizer = (_: any, srcValue: any | any[]) => {
  if (Array.isArray(srcValue)) {
    return srcValue
  }

  return undefined
}

// read file from path and try to parse it
const readFile = (configuration: any, crashOnError: boolean) => (absPath: string) => {
  assert(path.isAbsolute(absPath), `${absPath} must be an absolute path`)

  try {
    // delete loaded file
    delete require.cache[absPath]
    debug('loading %s', absPath)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    merge(configuration, require(absPath), customizer)
  } catch (e) {
    process.stderr.write(`Failed to include file ${absPath}, err: ${e.message}\n`)
    if (crashOnError) {
      throw e
    }
  }
}

export function possibleJSONStringToArray(filePaths: string) {
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

function resolve(filePath: string) {
  return require.resolve(filePath)
}

function resolveAbsPaths(paths: string[]) {
  const absolutePaths = paths.reduce((resolvedPaths: string[], filePath) => {
    const stats = fs.statSync(filePath)
    if (stats.isFile()) {
      resolvedPaths.push(resolve(filePath))
    } else if (stats.isDirectory()) {
      // NOTE: can be improved
      // this is an extra call, but we dont care since it's a one-time op
      const absPaths = glob
        .sync(`${filePath}/*.{ts,js,json}`)
        .map(resolve)
        .filter((x) => x.endsWith('.d.ts') === false)

      resolvedPaths.push(...absPaths)
    }

    return resolvedPaths
  }, [])

  return uniq(absolutePaths)
}

export function globFiles(filePaths: string | string[], configuration: any = {}, crashOnError: boolean) {
  // if we get parsed JSON array - use it right away
  const files = isArray(filePaths)
    ? filePaths
    : possibleJSONStringToArray(filePaths)

  // prepare merger
  const mergeFile = readFile(configuration, crashOnError)

  // resolve paths and merge
  resolveAbsPaths(files).forEach(mergeFile)

  return configuration
}

export function loadConfiguration(crashOnError: boolean) {
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
  const configFromEnv = reduce(namespace, camelCaseKeys(camelize), {})
  const config = Object.create(null)

  if (filePaths) {
    // nconf file does not merge configuration, it will either omit it
    // or overwrite it, since it's JSON and is already parsed, what we will
    // do is pass it into configuration as is after it was already camelCased and merged
    //
    // nconf.file(env.NCONF_FILE_PATH);

    globFiles(filePaths, config, crashOnError)
  }

  merge(config, configFromEnv)

  if (appendConfiguration !== undefined) {
    merge(config, appendConfiguration, customizer)
  }

  return config
}

/**
 * Add base configuration
 */
export function prependDefaultConfiguration(baseConfig: unknown) {
  assert.ok(baseConfig, 'must be a path to specific location')
  assert.ok(typeof baseConfig === 'string')

  let files = null
  if (env.NCONF_FILE_PATH) {
    files = possibleJSONStringToArray(env.NCONF_FILE_PATH)
    files.unshift(baseConfig)
  } else {
    files = [baseConfig]
  }

  env.NCONF_FILE_PATH = JSON.stringify(files)
}

/**
 * Appends passed configuration to resolved config
 */
export function append(configuration: any) {
  appendConfiguration = configuration
}
