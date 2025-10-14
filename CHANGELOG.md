# Changelog

## [0.1.12](https://github.com/dwmkerr/mock-llm/compare/v0.1.11...v0.1.12) (2025-10-14)


### Features

* add headers, apiVersion, and baseUrl support to Ark Model ([ab2f170](https://github.com/dwmkerr/mock-llm/commit/ab2f170249b1228470f46c47de916049aa176019))
* add headers, apiVersion, and baseUrl support to Ark Model ([29612b4](https://github.com/dwmkerr/mock-llm/commit/29612b43c3a3c7043fdcb0f3d7a56a056a5d3ccc))

## [0.1.11](https://github.com/dwmkerr/mock-llm/compare/v0.1.10...v0.1.11) (2025-10-14)


### ⚠ BREAKING CHANGES

* Templates now access request body via `request.body` instead of direct `request` access.

### Features

* add query params and additional tests ([337db18](https://github.com/dwmkerr/mock-llm/commit/337db18bc06f3ed05d5bdbd56d9204b519b7452f))
* expose full request object to templates ([b4c9f31](https://github.com/dwmkerr/mock-llm/commit/b4c9f31a12e796f26d8ce059856a8f9fbb01e28b))


### Bug Fixes

* include service port in Ark Model baseUrl ([9e29cc9](https://github.com/dwmkerr/mock-llm/commit/9e29cc9f780bc195249c336e358c70fb6f47eacc))
* include service port in Ark Model baseUrl ([6cbddb1](https://github.com/dwmkerr/mock-llm/commit/6cbddb12f9537b7ae4fe8268e937c24aa10fe3f6))


### Miscellaneous Chores

* release 0.1.11 ([b3ee5e7](https://github.com/dwmkerr/mock-llm/commit/b3ee5e7aaac3b6302c619c90d695727e0c4accb7))

## [0.1.10](https://github.com/dwmkerr/mock-llm/compare/v0.1.9...v0.1.10) (2025-10-14)


### Features

* add Helm documentation and Ark Model CRD support ([c39287a](https://github.com/dwmkerr/mock-llm/commit/c39287a8403bba5b2ef3377c1ac13a49ea660677))
* add Helm documentation and Ark Model CRD support ([19083a7](https://github.com/dwmkerr/mock-llm/commit/19083a798a25a30e2d1101bcbd93e48bc68ad698))
* helm chart mock-llm.yaml config ([168e3dd](https://github.com/dwmkerr/mock-llm/commit/168e3dd3fab6d66aca0463cf0a5d1efc26f549d5))
* helm chart mock-llm.yaml config ([a0333b7](https://github.com/dwmkerr/mock-llm/commit/a0333b75ffa32e46c45a0e5c52e6e69226e15a04))

## [0.1.9](https://github.com/dwmkerr/mock-llm/compare/v0.1.8...v0.1.9) (2025-10-13)


### Features

* add Helm chart for Kubernetes deployment ([2bca413](https://github.com/dwmkerr/mock-llm/commit/2bca41323e6e427b7d302a259d832ecbd01d0461))
* add Helm chart for Kubernetes deployment ([b007f0b](https://github.com/dwmkerr/mock-llm/commit/b007f0b976836f8252379d441a829b44ee5fe4fc))
* add Helm chart validation and publishing to CI/CD ([e6e3e83](https://github.com/dwmkerr/mock-llm/commit/e6e3e83faed5017d26385229aea6c81436583d50))
* configure release-please to update Helm chart version ([e39b4e9](https://github.com/dwmkerr/mock-llm/commit/e39b4e91f4d8073ba195b3802733a121c0d173bf))


### Bug Fixes

* address security findings in Helm chart ([39e18f5](https://github.com/dwmkerr/mock-llm/commit/39e18f519d235314e24daf8feadcbb7153dcad31))

## [0.1.8](https://github.com/dwmkerr/mock-llm/compare/v0.1.7...v0.1.8) (2025-10-09)


### Bug Fixes

* replace Handlebars with custom template engine for JMESPath compatibility ([96f37a8](https://github.com/dwmkerr/mock-llm/commit/96f37a8acb015e4d03c6e68401831334f63a794a))
* replace Handlebars with custom template engine for JMESPath compatibility ([b729d19](https://github.com/dwmkerr/mock-llm/commit/b729d19bfb84a50e65786d03164c5800108ce9ec))
* resolve lint errors in error handlers ([2f1b85d](https://github.com/dwmkerr/mock-llm/commit/2f1b85d74fc1d0446fa97f52074f7a323b9fa534))

## [0.1.7](https://github.com/dwmkerr/mock-llm/compare/v0.1.5...v0.1.7) (2025-10-09)


### Features

* 401 sample ([e0357f5](https://github.com/dwmkerr/mock-llm/commit/e0357f5f49bca5234b1f7deee8c7b5a5a0d526e0))
* 401 sample ([13dacc0](https://github.com/dwmkerr/mock-llm/commit/13dacc0eb0600d76dc49c39a14a49f19d24c3a74))
* add config API, sample tests, and refactored architecture ([d8cb72f](https://github.com/dwmkerr/mock-llm/commit/d8cb72fdc2f5c296257a0867230ececa7f41fa91))
* add health/ready endpoints and server error handling ([d5ad72e](https://github.com/dwmkerr/mock-llm/commit/d5ad72e27704f30f68185e4cb155369d7e041ac7))
* add YAML response support for GET /config endpoint ([7838602](https://github.com/dwmkerr/mock-llm/commit/783860216f940e82127d063d56da3485d10a369f))
* add YAML support for config API ([f3c906f](https://github.com/dwmkerr/mock-llm/commit/f3c906fab41e7ff7e729e54c00a94b70a8ab7e1e))
* initial release of mock-llm ([ab4eb34](https://github.com/dwmkerr/mock-llm/commit/ab4eb341d185639702ff968b0fc3bd083106839a))
* merge samples and integration tests ([cd3839a](https://github.com/dwmkerr/mock-llm/commit/cd3839a84068faae678d1a0f09bad263f7a5e492))
* samples and integration tests ([8da7f9c](https://github.com/dwmkerr/mock-llm/commit/8da7f9c9d7fc56f00e179df557991aed648b33b5))
* samples and integration tests ([e807e79](https://github.com/dwmkerr/mock-llm/commit/e807e799aeee7c0fa5fa8244e5314c50874de3fe))


### Bug Fixes

* add packages configuration for release-please ([1a6c354](https://github.com/dwmkerr/mock-llm/commit/1a6c354e9f8b018d59074fa853eacb59c8e29b20))
* configure release-please to use manifest file ([f41f3b1](https://github.com/dwmkerr/mock-llm/commit/f41f3b1fa486fe94760b3dfbe089730faaf359e2))
* move release-please config to .github directory ([6161b00](https://github.com/dwmkerr/mock-llm/commit/6161b0096099cc53f0035f9d6879976cca658b51))
* remove component name from release tags ([bd264e0](https://github.com/dwmkerr/mock-llm/commit/bd264e09a1f32e264a69e2f19a575226f1395aee))
* resolve Express 5 routing and add coverage reporting ([edefb57](https://github.com/dwmkerr/mock-llm/commit/edefb5782996f6971f9358ea5064785b250bd0b8))
* resolve Express 5 routing and add coverage reporting ([a10c238](https://github.com/dwmkerr/mock-llm/commit/a10c238a55bb7f45d6baac04361c899c74198c0b))
* skip prepare script in Docker production stage ([6fb69e6](https://github.com/dwmkerr/mock-llm/commit/6fb69e6a7c51387ebf427d5bd351bfb914f55f6a))
* upgrade dependencies to fix security vulnerabilities ([2b7f39e](https://github.com/dwmkerr/mock-llm/commit/2b7f39ebd0b3dd61389082f530e01b76dc406ca3))


### Miscellaneous Chores

* release 0.1.0 ([d9f7d15](https://github.com/dwmkerr/mock-llm/commit/d9f7d159bef8a0e2c05ca0989daaa91bf345a1d6))
* release 0.1.1 ([dd777a9](https://github.com/dwmkerr/mock-llm/commit/dd777a90a53b89ccbc56c05c060f1635909c9e4f))
* release 0.1.7 ([cf615ad](https://github.com/dwmkerr/mock-llm/commit/cf615adccf1104dae9496c3608f9095ff57b1686))

## [0.1.5](https://github.com/dwmkerr/mock-llm/compare/mock-llm-v0.1.4...mock-llm-v0.1.5) (2025-10-09)


### Features

* add health/ready endpoints and server error handling ([d5ad72e](https://github.com/dwmkerr/mock-llm/commit/d5ad72e27704f30f68185e4cb155369d7e041ac7))
* add YAML response support for GET /config endpoint ([7838602](https://github.com/dwmkerr/mock-llm/commit/783860216f940e82127d063d56da3485d10a369f))
* add YAML support for config API ([f3c906f](https://github.com/dwmkerr/mock-llm/commit/f3c906fab41e7ff7e729e54c00a94b70a8ab7e1e))

## [0.1.4](https://github.com/dwmkerr/mock-llm/compare/mock-llm-v0.1.3...mock-llm-v0.1.4) (2025-10-04)


### Features

* 401 sample ([e0357f5](https://github.com/dwmkerr/mock-llm/commit/e0357f5f49bca5234b1f7deee8c7b5a5a0d526e0))
* 401 sample ([13dacc0](https://github.com/dwmkerr/mock-llm/commit/13dacc0eb0600d76dc49c39a14a49f19d24c3a74))
* add config API, sample tests, and refactored architecture ([d8cb72f](https://github.com/dwmkerr/mock-llm/commit/d8cb72fdc2f5c296257a0867230ececa7f41fa91))
* merge samples and integration tests ([cd3839a](https://github.com/dwmkerr/mock-llm/commit/cd3839a84068faae678d1a0f09bad263f7a5e492))
* samples and integration tests ([8da7f9c](https://github.com/dwmkerr/mock-llm/commit/8da7f9c9d7fc56f00e179df557991aed648b33b5))
* samples and integration tests ([e807e79](https://github.com/dwmkerr/mock-llm/commit/e807e799aeee7c0fa5fa8244e5314c50874de3fe))

## [0.1.3](https://github.com/dwmkerr/mock-llm/compare/mock-llm-v0.1.2...mock-llm-v0.1.3) (2025-10-04)


### Bug Fixes

* resolve Express 5 routing and add coverage reporting ([edefb57](https://github.com/dwmkerr/mock-llm/commit/edefb5782996f6971f9358ea5064785b250bd0b8))
* resolve Express 5 routing and add coverage reporting ([a10c238](https://github.com/dwmkerr/mock-llm/commit/a10c238a55bb7f45d6baac04361c899c74198c0b))

## [0.1.2](https://github.com/dwmkerr/mock-llm/compare/mock-llm-v0.1.1...mock-llm-v0.1.2) (2025-10-03)


### Bug Fixes

* skip prepare script in Docker production stage ([6fb69e6](https://github.com/dwmkerr/mock-llm/commit/6fb69e6a7c51387ebf427d5bd351bfb914f55f6a))
* upgrade dependencies to fix security vulnerabilities ([2b7f39e](https://github.com/dwmkerr/mock-llm/commit/2b7f39ebd0b3dd61389082f530e01b76dc406ca3))

## [0.1.1](https://github.com/dwmkerr/mock-llm/compare/mock-llm-v0.1.0...mock-llm-v0.1.1) (2025-10-03)


### Features

* initial release of mock-llm ([ab4eb34](https://github.com/dwmkerr/mock-llm/commit/ab4eb341d185639702ff968b0fc3bd083106839a))


### Bug Fixes

* add packages configuration for release-please ([1a6c354](https://github.com/dwmkerr/mock-llm/commit/1a6c354e9f8b018d59074fa853eacb59c8e29b20))
* configure release-please to use manifest file ([f41f3b1](https://github.com/dwmkerr/mock-llm/commit/f41f3b1fa486fe94760b3dfbe089730faaf359e2))
* move release-please config to .github directory ([6161b00](https://github.com/dwmkerr/mock-llm/commit/6161b0096099cc53f0035f9d6879976cca658b51))


### Miscellaneous Chores

* release 0.1.0 ([d9f7d15](https://github.com/dwmkerr/mock-llm/commit/d9f7d159bef8a0e2c05ca0989daaa91bf345a1d6))
* release 0.1.1 ([dd777a9](https://github.com/dwmkerr/mock-llm/commit/dd777a90a53b89ccbc56c05c060f1635909c9e4f))
