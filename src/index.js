const camelCase = require('camelcase');
const nconf = require('nconf');
const dotenv = require('dotenv');
const ld = require('lodash');

// load dotenv
dotenv.config({
  silent: process.env.hasOwnProperty('DOTENV_NOT_SILENT') ? false : true,
  encoding: process.env.DOTENV_ENCODING || 'utf-8',
  path: process.env.DOTENV_FILE_PATH || process.cwd() + '/.env',
});

nconf.use('memory');
nconf.argv();
nconf.env({
  separator: process.env.NCONF_SEPARATOR || '__',
  match: process.env.hasOwnProperty('NCONF_MATCH') ? new RegExp(process.env.NCONF_MATCH, process.env.NCONF_MATCH_OPTS) : null,
  whitelist: process.env.hasOwnProperty('NCONF_WHITELIST') ? JSON.parse(process.env.NCONF_WHITELIST) : null,
});

if (!process.env.NCONF_NAMESPACE) {
  throw new Error('NCONF_NAMESPACE must be present in order to parse your configuration');
}

function parseJSONSafe(possibleJSON) {
  try {
    return JSON.parse(possibleJSON);
  } catch (e) {
    return possibleJSON;
  }
}

const configuration = {};
ld.forOwn(nconf.get(process.env.NCONF_NAMESPACE), function camelCaseKeys(value, key) {
  const camelized = process.env.hasOwnProperty('NCONF_NO_CAMELCASE') ? key : camelCase(key);
  if (value && typeof value === 'object') {
    ld.forOwn(value, camelCaseKeys, (this[camelized] = {}));
  } else {
    this[camelized] = parseJSONSafe(value);
  }
}, configuration);

if (process.env.hasOwnProperty('NCONF_FILE_PATH')) {
  // nconf file does not merge configuration, it will either omit it
  // or overwrite it, since it's JSON and is already parsed, what we will do is pass it into configuration
  // as is after it was already camelCased and merged
  //
  // nconf.file(process.env.NCONF_FILE_PATH);
  //
  ld.merge(configuration, require(process.env.NCONF_FILE_PATH));
}

module.exports = configuration;
