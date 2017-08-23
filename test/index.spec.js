const Promise = require('bluebird');
const assert = require('assert');
const sinon = require('sinon');

const env = process.env;

describe('Configuration loader', () => {
  let store;
  let mod;

  env.DOTENV_FILE_PATH = `${__dirname}/.env`;
  env.NCONF_FILE_PATH = JSON.stringify([
    `${__dirname}/config.json`,
    `${__dirname}/dir`,
  ]);

  it('should load configuration', () => {
    store = require('../src');
    mod = store.get('/');
  });

  it('should correctly use match env option', () => {
    assert.equal(Object.keys(mod).length, 7);
    assert.ok(mod.amqp);
    assert.ok(mod.value);
    assert.ok(mod.expanded);
  });

  it('correctly omits options', () => {
    assert.ifError(mod.omit);
    assert.ok(mod.whitelist);
  });

  it('does not expand values', () => {
    assert.equal(mod.expanded, '$MS_CONF___VALUE');
    assert.equal(mod.value, 'darn');
  });

  it('parses correct json and returns original text if it is not', () => {
    assert.deepEqual(mod.amqp.hosts, ['127.0.0.1']);
    assert.equal(mod.amqp.invalidJson, '{"test":bad}');
  });

  it('file was loaded and configuration was merged', () => {
    assert.ok(mod.my);
    assert.equal(mod.amqp.ssl, false);
  });

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
    });
  });

  it('enables hot-reload', () => {
    store.enableReload();

    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
      `${__dirname}/reload.json`,
    ]);

    process.kill(process.pid, 'SIGUSR2');

    // SIGHUP comes in as async action
    return Promise.delay(10)
      .then(() => {
        assert(store.get('/reloaded'));
        return null;
      });
  });

  it('dynamic overwrites', () => {
    store.append({
      boose: 'works',
    });

    assert.equal(store.get('/boose'), undefined);
    process.kill(process.pid, 'SIGUSR2');

    // SIGHUP comes in as async action
    return Promise.delay(1).then(() => {
      assert.equal(store.get('/boose'), 'works');
      return null;
    });
  });

  it('disables hot-reload', () => {
    store.disableReload();

    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
    ]);

    // so that process doesnt die
    const spy = sinon.spy();

    process.on('SIGUSR2', spy);
    process.kill(process.pid, 'SIGUSR2');

    // SIGHUP comes in as async action
    return Promise
      .delay(10)
      .then(() => {
        assert.equal(store.get('/reloaded'), true);
        assert.equal(spy.calledOnce, true);
        return null;
      })
      .finally(() => {
        process.removeListener('SIGUSR2', spy);
      });
  });
});
