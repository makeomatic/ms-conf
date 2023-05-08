# Configuration loading module

Combines confidence, dotenv, nconf and processes env configuration into camelcase;
Each value is JSON parsed first if it is possible, therefore you can pass arrays/objects and boolean params through env

## Installation

`npm i ms-conf` or any other manager

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
// ESM
import { Store } from 'ms-conf';
// CJS
const { Store } = require('ms-conf');

// get basic configuration
const store = new Store()
const config = store.get('/');
// config would equal
// {
//   amqp: {
//     hosts: ['127.0.0.1'],
//     ssl: true,
//     stringTrue: 'true'
//   }
// }

store.get('/amqp') // will return inner object and so on
store.get('/amqp/hosts') // ['127.0.0.1']
```

## Hot Reload

```js
store.enableReload();
// send SIGUSR1 or SIGUSR2 signal to process to reload configuration

store.disableReload();
// wont listen for SIGUSR1 or SIGUSR2 events any longer
```

## Utilities

1. Load file path

```js
// CJS
const { globFiles } = require('ms-conf');
// ESM
import { globFiles } from 'ms-conf';

// generates config for the passed files bypassing public API
const config = globFiles(
  undefined, // prependFile: string | undefined,
  ['/path/to/configs', '/path/to/config/direct.js', '/path/to/conf.json'], // fileList: string | string[]
  {}, // config: baseConfig
  true, // throw error in case of file processing issues
);
```

2. setDefaultOpts

```js
// define default options
const store = new Store({ defaultOpts: { env: process.env.NODE_ENV } })

// change default opts in runtime
store.opts.defaultOpts = { env: process.env.NODE_ENV }
```

3. prependDefaultConfiguration

Pass absolute filepath, which would be prepended. Useful to pass a directory with bundled default config

```js
store.prependDefaultConfiguration(filePath);
```

4. crash when configuration files can't be loaded

in 8+ behavior changes and malformed configuration files are not ignored anymore.
To disable this set crashOnError option to false`

```js
const { Store } = require('ms-conf');

const store = new Store({ crashOnError: false })
conf.prependDefaultConfiguration(['/path/to/config.json']);
conf.get('/path') // wont throw errors on malformed files, but will write into stderr notifying of the error
```

For a more detailed example - see tests
