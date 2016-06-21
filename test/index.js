const assert = require('assert');
const env = process.env;

describe('Configuration loader', function suite() {
  env.DOTENV_FILE_PATH = `${__dirname}/.env`;
  env.NCONF_FILE_PATH = JSON.stringify([
    `${__dirname}/config.json`,
    `${__dirname}/dir`,
  ]);

  it('should load configuration', function confInit() {
    this.mod = require('../src');
  });

  it('should correctly use match env option', function envChecker() {
    assert.equal(Object.keys(this.mod).length, 7);
    assert.ok(this.mod.amqp);
    assert.ok(this.mod.value);
    assert.ok(this.mod.expanded);
  });

  it('correctly omits options', function envChecker() {
    assert.ifError(this.mod.omit);
    assert.ok(this.mod.whitelist);
  });

  it('does not expand values', function envChecker() {
    assert.equal(this.mod.expanded, '$MS_CONF___VALUE');
    assert.equal(this.mod.value, 'darn');
  });

  it('parses correct json and returns original text if it is not', function envChecker() {
    assert.deepEqual(this.mod.amqp.hosts, ['127.0.0.1']);
    assert.equal(this.mod.amqp.invalidJson, '{"test":bad}');
  });

  it('file was loaded and configuration was merged', function fileChecker() {
    assert.ok(this.mod.my);
    assert.equal(this.mod.amqp.ssl, false);
  });

  it('produces correct configuration', function confChecker() {
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
});
