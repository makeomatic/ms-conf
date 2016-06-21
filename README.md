# Configuration loading module

Combines dotenv, nconf and processes env configuration into camelcase;
Each value is JSON parsed first if it is possible, therefore you can pass arrays/objects and boolean params through env

## Installation

`npm i ms-conf -S`

## Configuration

Accepts following configuration params, which can be passed through `.env` or process.env

1. `DOTENV_NOT_SILENT` - if present, warnings from dotenv wont be supressed
2. `DOTENV_ENCODING` - defaults to 'utf-8'
3. `DOTENV_FILE_PATH` - if .env file isn't located in the root of your module, you can pass path here
4. `NCONF_SEPARATOR` - defaults to `__`
5. `NCONF_MATCH` - only envs, matched by this would be returned through configuration
6. `NCONF_MATCH_OPTS` - opts for regexp constructed from `NCONF_MATCH`
7. `NCONF_WHITELIST` - stringified JSON array of variebles that should be parsed into final configuration
8. `NCONF_FILE_PATH` - external JSON configuration file that will be used to provide variables
9. `NCONF_NAMESPACE` - **MUST** be specified, as it will return configuration relative to this namespace
10. `NCONF_NO_CAMELCASE` - if present, keys will not be camelCased

## Usage

`.env` file:

```
NCONF_NAMESPACE=MS_CONF
NCONF_MATCH=^MS_CONF
NCONF_MATCH_OPTS=i
MS_CONF__AMQP__HOSTS=["127.0.0.1"]
MS_CONF__AMQP__SSL=true
MS_CONF__AMQP__STRING_TRUE='"true"'
NCONF_FILE_PATH=["/etc/app-configs","/etc/nice-config.js","/opt/app/bundle.json"]
```

```js
const config = require('ms-amqp-conf');
// config would equal
// {
//   amqp: {
//     hosts: ['127.0.0.1'],
//     ssl: true,
//     stringTrue: 'true'
//   }
// }
```

For a more detailed example - see tests
