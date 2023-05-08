import { EventEmitter } from 'eventemitter3'
import _debug from 'debug'
import type { Criteria } from '@makeomatic/confidence'
import { Store as BaseStore } from '@makeomatic/confidence'
import { strict as assert } from 'node:assert'
import { loadConfiguration } from './load-config'

const debug = _debug('ms-conf')

export interface StoreConfig {
  crashOnError: boolean
  defaultOpts: Criteria
}

export class Store extends EventEmitter {
  public readonly opts: Criteria

  private store!: BaseStore
  private _prepend: string | undefined
  private _append: unknown

  constructor({ crashOnError = true, defaultOpts = {} }: Partial<StoreConfig> = {}) {
    super()
    this.opts = {
      crashOnError,
      defaultOpts
    }
    this.reload = this.reload.bind(this)
  }

  /**
   * Add base configuration
   */
  prependDefaultConfiguration(baseConfig: unknown): void {
    assert(baseConfig, 'must be a path to specific location')
    assert(typeof baseConfig === 'string')
    this._prepend = baseConfig
  }

  /**
   * Appends passed configuration to resolved config
   */
  append(configuration: unknown): void {
    this._append = configuration
  }

  /**
   * Triggers reload from the disk
   */
  reload(): void {
    debug('reloading configuration')
    this.store = new BaseStore(loadConfiguration(
      this.opts.crashOnError,
      this._prepend,
      this._append
    ))
    this.emit('reload')
  }

  enableReload(): void {
    debug('enabling sigusr')
    process.on('SIGUSR1', this.reload)
    process.on('SIGUSR2', this.reload)
  }

  disableReload(): void {
    debug('disabling sigusr')
    process.removeListener('SIGUSR1', this.reload)
    process.removeListener('SIGUSR2', this.reload)
  }

  get<Response>(key: string, opts: Criteria = this.opts.defaultOpts): Response | undefined {
    if (!this.store) {
      this.reload()
    }

    return this.store.get<Response>(key, opts)
  }

  meta<Response>(key: string, opts: Criteria = this.opts.defaultOpts): Response | undefined {
    if (!this.store) {
      this.reload()
    }

    return this.store.meta(key, opts)
  }
}
