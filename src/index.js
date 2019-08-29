const EventEmitter = require('eventemitter3');
const debug = require('debug')('ms-conf');
const Confidence = require('@makeomatic/confidence');
const assert = require('assert');
const loadConfig = require('./load-config');

// uses confidence API to access store
let store;
let defaultOpts = {};
let crashOnError = false;
const EE = new EventEmitter();

// use this on sighup
function reload() {
  debug('reloading configuration');
  store = new Confidence.Store(loadConfig(crashOnError));
  EE.emit('reload', store);
}

// hot-reload enabler
function enableReload() {
  debug('enabling sigusr');
  process.on('SIGUSR1', reload);
  process.on('SIGUSR2', reload);
}

// hot-reload disabler
function disableReload() {
  debug('disabling sigusr');
  process.removeListener('SIGUSR1', reload);
  process.removeListener('SIGUSR2', reload);
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
  assert.ok(opts, 'must be an object');
  assert.ok(typeof opts === 'object', 'must be an object');
  defaultOpts = opts;
}

// init first configuration
module.exports = exports = {
  reload,
  enableReload,
  disableReload,
  setDefaultOpts,
  append: loadConfig.append,
  prependDefaultConfiguration: loadConfig.prependDefaultConfiguration,
  onReload(fn) {
    EE.on('reload', fn);
  },
  offReload(fn) {
    EE.off('reload', fn);
  },
  EE,
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

Object.defineProperty(exports, 'crashOnError', {
  enumerable: true,
  get() {
    return crashOnError;
  },
  set(newValue) {
    crashOnError = newValue;
  },
});

ensureStoreWasLoaded(exports, 'get', get);
ensureStoreWasLoaded(exports, 'meta', meta);
