const debug = require('debug')('ms-conf');
const camelCase = require('camelcase');
const nconf = require('nconf');
const dotenv = require('dotenv');
const reduce = require('lodash.reduce');
const merge = require('lodash.merge');
const assert = require('assert');
const fs = require('fs');
const glob = require('glob');

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
const readFile = configuration => (path) => {
  try {
    // delete loaded file
    const absPath = require.resolve(path);
    delete require.cache[absPath];
    debug('loading %s', absPath);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    merge(configuration, require(absPath));
  } catch (e) {
    process.stderr.write(`Failed to include file ${path}, err: ${e.message}\n`);
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

function globFiles(filePaths, configuration = {}) {
  const files = possibleJSONStringToArray(filePaths);
  const mergeFile = readFile(configuration);

  files.forEach((file) => {
    const stats = fs.statSync(file);
    if (stats.isFile()) {
      mergeFile(file);
    } else if (stats.isDirectory()) {
      glob.sync(`${file}/*.{js,json}`).forEach(mergeFile);
    }
  });

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
