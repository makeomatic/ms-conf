const Promise = require('bluebird');
const assert = require('assert');
const env = process.env;

describe('Configuration loader', () => {
  env.DOTENV_FILE_PATH = `${__dirname}/.env`;
  env.NCONF_FILE_PATH = JSON.stringify([
    `${__dirname}/config.json`,
    `${__dirname}/dir`,
  ]);

  it('should load configuration', () => {
    this.store = require('../src');
    this.mod = this.store.get('/');
  });

  it('should correctly use match env option', () => {
    assert.equal(Object.keys(this.mod).length, 7);
    assert.ok(this.mod.amqp);
    assert.ok(this.mod.value);
    assert.ok(this.mod.expanded);
  });

  it('correctly omits options', () => {
    assert.ifError(this.mod.omit);
    assert.ok(this.mod.whitelist);
  });

  it('does not expand values', () => {
    assert.equal(this.mod.expanded, '$MS_CONF___VALUE');
    assert.equal(this.mod.value, 'darn');
  });

  it('parses correct json and returns original text if it is not', () => {
    assert.deepEqual(this.mod.amqp.hosts, ['127.0.0.1']);
    assert.equal(this.mod.amqp.invalidJson, '{"test":bad}');
  });

  it('file was loaded and configuration was merged', () => {
    assert.ok(this.mod.my);
    assert.equal(this.mod.amqp.ssl, false);
  });

  it('produces correct configuration', () => {
    assert.deepEqual(this.mod, {
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
    this.store.enableReload();
    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
      `${__dirname}/reload.json`,
    ]);

    process.kill(process.pid, 'SIGUSR1');

    // SIGHUP comes in as async action
    return Promise.delay(10).then(() => {
      assert(this.store.get('/reloaded'));
    });
  });

  it('disables hot-reload', () => {
    this.store.disableReload();
    env.NCONF_FILE_PATH = JSON.stringify([
      `${__dirname}/config.json`,
      `${__dirname}/dir`,
    ]);

    process.kill(process.pid, 'SIGUSR1');

    // SIGHUP comes in as async action
    return Promise.delay(1).then(() => {
      assert(this.store.get('/reloaded'));
    });
  });
});
