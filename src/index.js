const camelCase = require('camelcase');
const nconf = require('nconf');
const dotenv = require('dotenv');
const reduce = require('lodash.reduce');
const merge = require('lodash.merge');
const assert = require('assert');
const env = process.env;
const silent = env.hasOwnProperty('DOTENV_NOT_SILENT') ? false : true;

// load dotenv
dotenv.config({
  silent,
  encoding: env.DOTENV_ENCODING || 'utf-8',
  path: env.DOTENV_FILE_PATH || process.cwd() + '/.env',
});

nconf.use('memory');
nconf.argv();
nconf.env({
  separator: env.NCONF_SEPARATOR || '__',
  match: env.hasOwnProperty('NCONF_MATCH') ? new RegExp(env.NCONF_MATCH, env.NCONF_MATCH_OPTS) : null,
  whitelist: env.hasOwnProperty('NCONF_WHITELIST') ? JSON.parse(env.NCONF_WHITELIST) : null,
});

assert.ok(env.NCONF_NAMESPACE, 'NCONF_NAMESPACE must be present in order to parse your configuration');

function parseJSONSafe(possibleJSON) {
  try {
    return JSON.parse(possibleJSON);
  } catch (e) {
    return possibleJSON;
  }
}

const camelize = env.hasOwnProperty('NCONF_NO_CAMELCASE');
function camelCaseKeys(obj, value, key) {
  const camelized = camelize ? key : camelCase(key);

  if (value && typeof value === 'object') {
    reduce(value, camelCaseKeys, (obj[camelized] = {}));
  } else {
    obj[camelized] = parseJSONSafe(value);
  }

  return obj;
}

const namespace = nconf.get(env.NCONF_NAMESPACE);
const configuration = reduce(namespace, camelCaseKeys, {});

if (env.hasOwnProperty('NCONF_FILE_PATH')) {
  // nconf file does not merge configuration, it will either omit it
  // or overwrite it, since it's JSON and is already parsed, what we will do is pass it into configuration
  // as is after it was already camelCased and merged
  //
  // nconf.file(env.NCONF_FILE_PATH);

  let files;
  try {
    files = JSON.parse(env.NCONF_FILE_PATH);
    if (!Array.isArray(files)) {
      throw new Error('NCONF_FILE_PATH must be a stringified array or a string');
    }
  } catch (e) {
    files = [env.NCONF_FILE_PATH];
  }

  files.forEach(function mergeConfiguration(file) {
    try {
      merge(configuration, require(file));
    } catch (e) {
      // file might not be present, if we are not in silent mode - print warn
      if (!silent) {
        process.stderr.write(`Failed to include file ${file}, err: ${e.message}\n`);
      }
    }
  });
}

module.exports = configuration;
