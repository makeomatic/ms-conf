import assert from 'node:assert'
import { once } from 'node:events'
import sinon from 'sinon'
import type { Store } from 'ms-conf'
import { setTimeout } from 'node:timers/promises'

export const loadTests = (StoreCtor: typeof Store, baseDir: string) => {
  describe('Configuration loader', () => {
    const { env } = process

    let mod: any
    let store: Store

    env.DOTENV_FILE_PATH = `${baseDir}/.env`
    env.NCONF_FILE_PATH = JSON.stringify([
      `${baseDir}/config.json`,
      `${baseDir}/dir`,
    ])

    it('should load configuration', async () => {
      store = new StoreCtor({ crashOnError: false })
      await store.ready()
      mod = store.get('/')
      const debug = await import('debug').then(x => x.default('ms-conf'))
      debug('mod loaded %j', mod)
    })

    it('should correctly use match env option', () => {
      assert.strictEqual(Object.keys(mod).length, 10)
      assert.ok(mod.amqp)
      assert.ok(mod.value)
      assert.ok(mod.expanded)
    })

    it('should overwrite config values from file using env values', () => {
      assert.strictEqual(mod.overwritten.by.env, true)
    })

    it('correctly omits options', () => {
      assert.ifError(mod.omit)
      assert.ok(mod.whitelist)
    })

    it('does not expand values', () => {
      assert.strictEqual(mod.expanded, '$MS_CONF___VALUE')
      assert.strictEqual(mod.value, 'darn')
    })

    it('parses correct json and returns original text if it is not', () => {
      assert.deepEqual(mod.amqp.hosts, ['127.0.0.1'])
      assert.strictEqual(mod.amqp.invalidJson, '{"test":bad}')
    })

    it('file was loaded and configuration was merged', () => {
      assert.ok(mod.my)
      assert.strictEqual(mod.amqp.ssl, false)
    })

    it('produces correct configuration', () => {
      assert.deepEqual(mod, {
        amqp: {
          hosts: ['127.0.0.1'],
          ssl: false,
          stringTrue: 'true',
          invalidJson: '{"test":bad}',
        },
        expanded: '$MS_CONF___VALUE',
        value: 'darn',
        whitelist: true,
        my: {
          special: {
            config: true,
          },
        },
        agri: {
          culture: true,
        },
        pot: 'is-json',
        array: [1, 3],
        ok: null,
        overwritten: { by: { env: true } },
      })
    })

    it('enables hot-reload', async () => {
      store.enableReload()

      env.NCONF_FILE_PATH = JSON.stringify([
        `${baseDir}/config.json`,
        `${baseDir}/dir`,
        `${baseDir}/reload.json`,
      ])

      await Promise.all([
        process.kill(process.pid, 'SIGUSR2'),
        once(store, 'reload')
      ])

      assert(store.get('/reloaded'))
    })

    it('dynamic overwrites', async () => {
      store.append({
        boose: 'works',
      })

      assert.strictEqual(store.get('/boose'), undefined)

      await Promise.all([
        process.kill(process.pid, 'SIGUSR2'),
        once(store, 'reload')
      ])

      assert.equal(store.get('/boose'), 'works')
    })

    it('disables hot-reload', async () => {
      store.disableReload()

      env.NCONF_FILE_PATH = JSON.stringify([
        `${baseDir}/config.json`,
        `${baseDir}/dir`,
      ])

      // so that process doesnt die
      const spy = sinon.spy()

      process.on('SIGUSR2', spy)
      process.kill(process.pid, 'SIGUSR2')

      // SIGHUP comes in as async action
      try {
        await setTimeout(10)
        assert.strictEqual(store.get('/reloaded'), true)
        assert.strictEqual(spy.calledOnce, true)
      } finally {
        process.removeListener('SIGUSR2', spy)
      }
    })

    it('crashes on error when reading files', async () => {
      env.NCONF_FILE_PATH = JSON.stringify([
        `${baseDir}/dir`,
      ])

      store.opts.crashOnError = true
      await assert.rejects(store.reload(), 'must throw with malformed.json')
    })
  })
}
