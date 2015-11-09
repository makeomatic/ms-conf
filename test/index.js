const chai = require('chai');
const { expect } = chai;

describe('Configuration loader', function suite() {
  process.env.DOTENV_FILE_PATH = __dirname + '/.env';
  process.env.NCONF_FILE_PATH = __dirname + '/config.json';

  it('should load configuration', function confInit() {
    this.mod = require('../src');
  });

  it('should correctly use match env option', function envChecker() {
    expect(Object.keys(this.mod)).to.have.length.of(5);
    expect(this.mod).to.have.ownProperty('amqp');
    expect(this.mod).to.have.ownProperty('value');
    expect(this.mod).to.have.ownProperty('expanded');
  });

  it('correctly omits options', function envChecker() {
    expect(this.mod).to.not.have.ownProperty('omit');
    expect(this.mod).to.have.ownProperty('whitelist');
  });

  it('correctly expands values', function envChecker() {
    expect(this.mod.expanded).to.be.eq(this.mod.value);
    expect(this.mod.value).to.be.eq('darn');
  });

  it('parses correct json and returns original text if it is not', function envChecker() {
    expect(this.mod.amqp.hosts).to.be.deep.eq([ '127.0.0.1' ]);
    expect(this.mod.amqp.invalidJson).to.be.eq('{"test":bad}');
  });

  it('file was loaded and configuration was merged', function fileChecker() {
    expect(this.mod).to.have.ownProperty('my');
    expect(this.mod.amqp.ssl).to.be.eq(false);
  });

  it('produces correct configuration', function confChecker() {
    expect(this.mod).to.be.deep.eq({
      amqp: {
        hosts: [ '127.0.0.1' ],
        ssl: false,
        stringTrue: 'true',
        invalidJson: '{"test":bad}',
      },
      expanded: 'darn',
      value: 'darn',
      whitelist: true,
      my: {
        special: {
          config: true,
        },
      },
    });
  });
});
