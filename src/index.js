const debug = require('debug')('ms-conf');
const Confidence = require('confidence');
const loadConfig = require('./load-config');

// uses confidence API to access store
let store;
let defaultOpts = {};

// use this on sighup
function reload() {
  debug('reloading configuration');
  store = new Confidence.Store(loadConfig());
}

// hot-reload enabler
function enableReload() {
  debug('enabling sigusr');
  process.on('SIGUSR1', reload);
}

// hot-reload disabler
function disableReload() {
  debug('disabling sigusr');
  process.removeListener('SIGUSR1', reload);
}

function get(key, _opts) {
  const opts = _opts || defaultOpts;
  return store.get(key, opts);
}

function meta(key, _opts) {
  const opts = _opts || defaultOpts;
  return store.meta(key, opts);
}

function setDefaultOpts(opts) {
  defaultOpts = opts;
}

// init first configuration
module.exports = exports = {
  reload,
  enableReload,
  disableReload,
  setDefaultOpts,
  prependDefaultConfiguration: loadConfig.prependDefaultConfiguration,
};

// small util to ensure effective get calls
function ensureStoreWasLoaded(obj, name, fn) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    value: function loadStore(...args) {
      if (!store) reload();

      // if it is the same property we can redefine it, otherwise
      // it must remain the same
      if (obj[name] === loadStore) {
        Object.defineProperty(obj, name, {
          configurable: true,
          enumerable: true,
          value: fn,
        });
      }

      return fn(...args);
    },
  });
}

ensureStoreWasLoaded(exports, 'get', get);
ensureStoreWasLoaded(exports, 'meta', meta);
