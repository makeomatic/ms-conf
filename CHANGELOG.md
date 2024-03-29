## [8.2.1](https://github.com/makeomatic/ms-conf/compare/v8.2.0...v8.2.1) (2023-06-26)


### Bug Fixes

* sync worker optional ([074d7d6](https://github.com/makeomatic/ms-conf/commit/074d7d695a09c586392f99a99c54dd8070afbefb))

# [8.2.0](https://github.com/makeomatic/ms-conf/compare/v8.1.2...v8.2.0) (2023-06-22)


### Features

* .sync() ready method ([8c071c9](https://github.com/makeomatic/ms-conf/commit/8c071c934975d7093e43e510e0c21e127f1df81c))

## [8.1.2](https://github.com/makeomatic/ms-conf/compare/v8.1.1...v8.1.2) (2023-05-17)


### Bug Fixes

* improve compatibility for .ts ([3b07fef](https://github.com/makeomatic/ms-conf/commit/3b07fef097044526412dc0d1839bfe6d02559247))

## [8.1.1](https://github.com/makeomatic/ms-conf/compare/v8.1.0...v8.1.1) (2023-05-17)


### Bug Fixes

* fallback types ([6b8a93e](https://github.com/makeomatic/ms-conf/commit/6b8a93e4ea195b60d19a41ba3bb7b986356ee979))

# [8.1.0](https://github.com/makeomatic/ms-conf/compare/v8.0.2...v8.1.0) (2023-05-09)


### Features

* reload is now async, support ESM config files ([7e0f264](https://github.com/makeomatic/ms-conf/commit/7e0f264162c28d56d7685a3002be592f2dbc0031))

## [8.0.2](https://github.com/makeomatic/ms-conf/compare/v8.0.1...v8.0.2) (2023-05-08)


### Bug Fixes

* allow empty namespace when env is nothing ([8f39ca9](https://github.com/makeomatic/ms-conf/commit/8f39ca9a815e278b47accdbf9532e49e93b44aab))

## [8.0.1](https://github.com/makeomatic/ms-conf/compare/v8.0.0...v8.0.1) (2023-05-08)


### Bug Fixes

* include relevant examples in readme ([610ecae](https://github.com/makeomatic/ms-conf/commit/610ecae557c3059cdaf3f7aa1bcea5db96e7dbbc))

# [8.0.0](https://github.com/makeomatic/ms-conf/compare/v7.0.2...v8.0.0) (2023-05-08)


### Bug Fixes

* dont use lodash.reduce ([1c73157](https://github.com/makeomatic/ms-conf/commit/1c73157a8956f2ebad65c17d871baf640b7dcc25))
* replace lodash.mergewith ([15a91ba](https://github.com/makeomatic/ms-conf/commit/15a91ba754f1440d4377d21ae68ec6096c3e57e4))


### Features

* hybrid module, remove singleton, update API ([b58fbf4](https://github.com/makeomatic/ms-conf/commit/b58fbf47a6966e68391fbbf8d6ef50658417d1de))


### BREAKING CHANGES

* provides support for both cjs and esm imports.
API has changed and instead exports `Store` class, which you should instantiate and configure.
That class provides similar methods inside to what was previosly available at top level
