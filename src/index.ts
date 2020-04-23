import EventEmitter = require('eventemitter3');
import _debug = require('debug');
import { Store, Criteria } from '@makeomatic/confidence'
import { strict as assert } from 'assert'
import { loadConfiguration, append, prependDefaultConfiguration } from './load-config'

const debug = _debug('ms-conf')

// uses confidence API to access store
let store: Store
let defaultOpts: Criteria = {}
let crashOnError = false
const EE = new EventEmitter()

export { append, prependDefaultConfiguration, EE }

// use this on sighup
export function reload() {
  debug('reloading configuration')
  store = new Store(loadConfiguration(crashOnError))
  EE.emit('reload', store)
}

// hot-reload enabler
export function enableReload() {
  debug('enabling sigusr')
  process.on('SIGUSR1', reload)
  process.on('SIGUSR2', reload)
}

// hot-reload disabler
export function disableReload() {
  debug('disabling sigusr')
  process.removeListener('SIGUSR1', reload)
  process.removeListener('SIGUSR2', reload)
}

export function get<Response>(key: string, opts: Criteria = defaultOpts): Response | undefined {
  if (!store) reload()
  return store.get<Response>(key, opts)
}

export function meta<Response>(key: string, opts: Criteria = defaultOpts): Response | undefined {
  if (!store) reload()
  return store.meta(key, opts)
}

export function setDefaultOpts(opts: Criteria) {
  assert.ok(opts, 'must be an object')
  assert.ok(typeof opts === 'object', 'must be an object')
  defaultOpts = opts
}

export function onReload(fn: EventEmitter.ListenerFn) {
  EE.on('reload', fn)
}

export function offReload(fn: EventEmitter.ListenerFn) {
  EE.off('reload', fn)
}

export function setCrashOnError(val: boolean) {
  crashOnError = val
}

export function getCrashOnError(): boolean {
  return crashOnError
}
