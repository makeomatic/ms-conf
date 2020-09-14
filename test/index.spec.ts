import { delay } from 'bluebird'
import assert = require('assert')
import sinon = require('sinon')
import * as store from '..'

const { env } = process

describe('Configuration loader', () => {
  let mod: any

  env.DOTENV_FILE_PATH = `${__dirname}/.env`
  env.NCONF_FILE_PATH = JSON.stringify([
    `${__dirname}/config.json`,
    `${__dirname}/dir`,
  ])

  it('should load configuration', async () => {
    mod = store.get('/')
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

  it('enables hot-reload', () => {
    store.enableReload()

    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
      `${__dirname}/reload.json`,
    ])

    process.kill(process.pid, 'SIGUSR2')

    // SIGHUP comes in as async action
    return delay(10)
      .then(() => {
        assert(store.get('/reloaded'))
        return null
      })
  })

  it('dynamic overwrites', () => {
    store.append({
      boose: 'works',
    })

    assert.strictEqual(store.get('/boose'), undefined)
    process.kill(process.pid, 'SIGUSR2')

    // SIGHUP comes in as async action
    return delay(1).then(() => {
      assert.equal(store.get('/boose'), 'works')
      return null
    })
  })

  it('disables hot-reload', () => {
    store.disableReload()

    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
    ])

    // so that process doesnt die
    const spy = sinon.spy()

    process.on('SIGUSR2', spy)
    process.kill(process.pid, 'SIGUSR2')

    // SIGHUP comes in as async action
    return delay(10)
      .then(() => {
        assert.strictEqual(store.get('/reloaded'), true)
        assert.strictEqual(spy.calledOnce, true)
        return null
      })
      .finally(() => {
        process.removeListener('SIGUSR2', spy)
      })
  })

  it('crashes on error when reading files', () => {
    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/dir`,
    ])

    store.setCrashOnError(true)
    assert.throws(() => store.reload(), 'must throw with malformed.json')
  })
})
