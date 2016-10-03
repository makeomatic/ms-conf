const debug = require('debug')('ms-conf');
const camelCase = require('camelcase');
const nconf = require('nconf');
const dotenv = require('dotenv');
const reduce = require('lodash.reduce');
const merge = require('lodash.merge');
const uniq = require('lodash.uniq');
const assert = require('assert');
const fs = require('fs');
const glob = require('glob');
const path = require('path');

const hasOwnProperty = Object.prototype.hasOwnProperty;
const env = process.env;
const silent = hasOwnProperty.call(env, 'DOTENV_NOT_SILENT');
const cwd = process.cwd();
const isArray = Array.isArray;

// safe json parse
function parseJSONSafe(possibleJSON) {
  try {
    return JSON.parse(possibleJSON);
  } catch (e) {
    return possibleJSON;
  }
}

// make camelCase keys
const camelCaseKeys = camelize => function processKeys(obj, value, key) {
  const camelized = camelize ? key : camelCase(key);

  if (value && typeof value === 'object') {
    reduce(value, processKeys, (obj[camelized] = {}));
  } else {
    obj[camelized] = parseJSONSafe(value);
  }

  return obj;
};

// read file from path and try to parse it
const readFile = configuration => (absPath) => {
  assert(path.isAbsolute(absPath), `${absPath} must be an absolute path`);

  try {
    // delete loaded file
    delete require.cache[absPath];
    debug('loading %s', absPath);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    merge(configuration, require(absPath));
  } catch (e) {
    process.stderr.write(`Failed to include file ${absPath}, err: ${e.message}\n`);
  }
};

function possibleJSONStringToArray(filePaths) {
  let files;
  try {
    files = JSON.parse(filePaths);
  } catch (e) {
    files = [filePaths];
  }

  if (!isArray(files)) {
    throw new Error('NCONF_FILE_PATH must be a stringified array or a string');
  }

  return files;
}

function resolve(filePath) {
  return require.resolve(filePath);
}

function resolveAbsPaths(paths) {
  const absolutePaths = paths.reduce((resolvedPaths, filePath) => {
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      resolvedPaths.push(resolve(filePath));
    } else if (stats.isDirectory()) {
      // NOTE: can be improved
      // this is an extra call, but we dont care since it's a one-time op
      const absPaths = glob.sync(`${filePath}/*.{js,json}`).map(resolve);
      resolvedPaths.push(...absPaths);
    }

    return resolvedPaths;
  }, []);

  return uniq(absolutePaths);
}

function globFiles(filePaths, configuration = {}) {
  // if we get parsed JSON array - use it right away
  const files = isArray(filePaths)
    ? filePaths
    : possibleJSONStringToArray(filePaths);

  // prepare merger
  const mergeFile = readFile(configuration);

  // resolve paths and merge
  resolveAbsPaths(files).forEach(mergeFile);

  return configuration;
}

function loadConfiguration() {
  // load dotenv
  dotenv.config({
    silent,
    encoding: env.DOTENV_ENCODING || 'utf-8',
    path: env.DOTENV_FILE_PATH || `${cwd}/.env`,
  });

  // do we camelize?
  const camelize = hasOwnProperty.call(env, 'NCONF_NO_CAMELCASE');
  const namespaceKey = env.NCONF_NAMESPACE;
  const filePaths = env.NCONF_FILE_PATH;

  // if we don't have it yet
  assert(namespaceKey, 'NCONF_NAMESPACE must be present in order to parse your configuration');

  // init nconf store
  nconf.use('memory');
  nconf.reset();
  nconf.argv();
  nconf.env({
    separator: env.NCONF_SEPARATOR || '__',
    match: hasOwnProperty.call(env, 'NCONF_MATCH') ? new RegExp(env.NCONF_MATCH, env.NCONF_MATCH_OPTS) : null,
    whitelist: hasOwnProperty.call(env, 'NCONF_WHITELIST') ? JSON.parse(env.NCONF_WHITELIST) : null,
  });

  // pull camelCase data
  const namespace = nconf.get(namespaceKey);
  const configuration = reduce(namespace, camelCaseKeys(camelize), {});

  if (filePaths) {
    // nconf file does not merge configuration, it will either omit it
    // or overwrite it, since it's JSON and is already parsed, what we will
    // do is pass it into configuration as is after it was already camelCased and merged
    //
    // nconf.file(env.NCONF_FILE_PATH);

    globFiles(filePaths, configuration);
  }

  return configuration;
}

module.exports = loadConfiguration;
module.exports.globFiles = globFiles;
module.exports.possibleJSONStringToArray = possibleJSONStringToArray;
