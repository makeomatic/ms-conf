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

export { globFiles } from './load-config'

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
  public prependDefaultConfiguration(baseConfig: unknown): void {
    assert(baseConfig, 'must be a path to specific location')
    assert(typeof baseConfig === 'string')
    this._prepend = baseConfig
  }

  /**
   * Appends passed configuration to resolved config
   */
  public append(configuration: unknown): void {
    this._append = configuration
  }

  /**
   * Triggers reload from the disk
   */
  async reload(): Promise<void> {
    debug('reloading configuration')
    this.store = new BaseStore(await loadConfiguration(
      this.opts.crashOnError,
      this._prepend,
      this._append
    ))
    this.emit('reload')
  }

  /**
   * alias for reload for now
   */
  async ready() {
    await this.reload()
  }

  public enableReload(): void {
    debug('enabling sigusr')
    process.on('SIGUSR1', this.reload)
    process.on('SIGUSR2', this.reload)
  }

  public disableReload(): void {
    debug('disabling sigusr')
    process.removeListener('SIGUSR1', this.reload)
    process.removeListener('SIGUSR2', this.reload)
  }

  public get<Response>(key: string, opts: Criteria = this.opts.defaultOpts): Response | undefined {
    assert(this.store, 'call await store.ready() before accessing config')
    return this.store.get<Response>(key, opts)
  }

  public meta<Response>(key: string, opts: Criteria = this.opts.defaultOpts): Response | undefined {
    assert(this.store, 'call await store.ready() before accessing config')
    return this.store.meta(key, opts)
  }
}
