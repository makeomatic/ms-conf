const debug = require('debug')('ms-conf');
const Confidence = require('confidence');
const loadConfig = require('./load-config');

// uses confidence API to access store
let store;

// use this on sighup
function reload() {
  debug('reloading configuration');
  store = new Confidence.Store(loadConfig());
}

// hot-reload enabler
function enableReload() {
  debug('enabling sighup');
  process.on('SIGUSR1', reload);
}

// hot-reload disabler
function disableReload() {
  debug('disabling sighup');
  process.removeListener('SIGUSR1', reload);
}

function get(key, opts) {
  return store.get(key, opts);
}

function meta(key, opts) {
  return store.meta(key, opts);
}

// load first configuration
reload();

// init first configuration
module.exports = {
  get,
  meta,
  reload,
  enableReload,
  disableReload,
};
