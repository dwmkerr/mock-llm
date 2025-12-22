# Changelog

## [0.1.26](https://github.com/dwmkerr/mock-llm/compare/v0.1.25...v0.1.26) (2025-12-22)


### Bug Fixes

* only increment sequence counter when winning rule has sequence ([#78](https://github.com/dwmkerr/mock-llm/issues/78)) ([74fb0ea](https://github.com/dwmkerr/mock-llm/commit/74fb0eafd6f704ce68cddb5bcefc12a690c4720f))
* set MCP server path based on transport type ([#82](https://github.com/dwmkerr/mock-llm/issues/82)) ([c66e1fd](https://github.com/dwmkerr/mock-llm/commit/c66e1fda9226456ed53a9f9d3b18183ed4ca2a1d))

## [0.1.25](https://github.com/dwmkerr/mock-llm/compare/v0.1.24...v0.1.25) (2025-11-27)


### Bug Fixes

* checkout release tag in publish jobs to prevent version mismatch ([730eb85](https://github.com/dwmkerr/mock-llm/commit/730eb85c741475aa1b1bdbd06bbc35f5ba8e478b))

## [0.1.24](https://github.com/dwmkerr/mock-llm/compare/v0.1.23...v0.1.24) (2025-11-26)


### Features

* add sequential response matching ([8296fcb](https://github.com/dwmkerr/mock-llm/commit/8296fcb548447cc696320e54d3013b4c402ff0ed))
* add sequential response matching ([925e935](https://github.com/dwmkerr/mock-llm/commit/925e9353afe800519b51144ca68e9f5513a5acae))

## [0.1.23](https://github.com/dwmkerr/mock-llm/compare/v0.1.22...v0.1.23) (2025-11-26)


### Features

* add termination grace period configuration ([0ac9bc9](https://github.com/dwmkerr/mock-llm/commit/0ac9bc9568f6f752ff58dd2d281445852d7fb737))
* add termination grace period configuration ([af60286](https://github.com/dwmkerr/mock-llm/commit/af6028695c5294cf1bc07e81ae564b03e1d2de46))

## [0.1.22](https://github.com/dwmkerr/mock-llm/compare/v0.1.21...v0.1.22) (2025-11-05)


### Features

* chart - pass custom labels to created custom resources ([21b8cce](https://github.com/dwmkerr/mock-llm/commit/21b8cce8fc8a4a4e4a8a78216ed87a4bd1fa3364))
* chart - pass custom labels to created custom resources ([215101d](https://github.com/dwmkerr/mock-llm/commit/215101d1677abc6505b80df55d56bc63ef5ceca5))

## [0.1.21](https://github.com/dwmkerr/mock-llm/compare/v0.1.20...v0.1.21) (2025-11-04)


### Bug Fixes

* filter version lines from helm chart snapshot test ([cfbb19a](https://github.com/dwmkerr/mock-llm/commit/cfbb19a41fbfee32342e264e08a8eac5e91efb54))
* filter version lines from helm chart snapshot test ([f2e715d](https://github.com/dwmkerr/mock-llm/commit/f2e715d19174c19e18b00f8c495441193520d897))

## [0.1.20](https://github.com/dwmkerr/mock-llm/compare/v0.1.19...v0.1.20) (2025-11-03)


### Features

* add echo_headers MCP tool for testing header propagation ([4f83c93](https://github.com/dwmkerr/mock-llm/commit/4f83c931b019cb332e5c811a457f432a43044d45))
* add echo_headers MCP tool for testing header propagation ([f4518a7](https://github.com/dwmkerr/mock-llm/commit/f4518a7dfea3df156fc02ae376e83c08befcf962)), closes [#57](https://github.com/dwmkerr/mock-llm/issues/57)


### Bug Fixes

* update MCP server test to match new MCPServerInfo structure ([8a1b095](https://github.com/dwmkerr/mock-llm/commit/8a1b095b420f26d6ca7a16d33b800f90bda8210c))

## [0.1.19](https://github.com/dwmkerr/mock-llm/compare/v0.1.18...v0.1.19) (2025-10-31)


### Bug Fixes

* fixed /messages endpoint on sse transport ([ef26e25](https://github.com/dwmkerr/mock-llm/commit/ef26e25e5b2045386726448e24129a07065d58a8))
* fixed /messages endpoint on sse transport ([299c90f](https://github.com/dwmkerr/mock-llm/commit/299c90fb165a013347f433b19ec11906fa5ecd42))

## [0.1.18](https://github.com/dwmkerr/mock-llm/compare/v0.1.17...v0.1.18) (2025-10-31)


### Features

* added configurable transport on MCPServer manifest ([60482cc](https://github.com/dwmkerr/mock-llm/commit/60482cc913f8bc6e710ca043a4d7cca05bc3ed35))


### Bug Fixes

* sse endpoints, added configurable transport on MCPServer manifest ([a5135b1](https://github.com/dwmkerr/mock-llm/commit/a5135b1b2269e103763e1547ebb86b5c1d60491c))

## [0.1.17](https://github.com/dwmkerr/mock-llm/compare/v0.1.16...v0.1.17) (2025-10-31)


### Features

* add LLM streaming support for testing ([8cb3da4](https://github.com/dwmkerr/mock-llm/commit/8cb3da4fd7ed516ab5e8e04bf2924548160e93f8))
* add LLM streaming support for testing ([381895e](https://github.com/dwmkerr/mock-llm/commit/381895ee0b4969589373ad5d4abc65bbd0b8447e))
* **mcp:** add SSE transport with session init/stream/send/close and tests ([987e727](https://github.com/dwmkerr/mock-llm/commit/987e727d9d0c99a7dc2e3614c200624d22b4a2a4))
* **mcp:** integrate SSE transport into MCP HTTP server ([5b74ef9](https://github.com/dwmkerr/mock-llm/commit/5b74ef98f30a5bb5f30b1844fa05aad7720d8fff))
* **sse:** add mock SSE provider at /sse/mock with tests; wire into server ([3c72342](https://github.com/dwmkerr/mock-llm/commit/3c72342d2aec702de4142397f1ce8b237e1038c6))
* **tests:** token usage test ([f729df2](https://github.com/dwmkerr/mock-llm/commit/f729df2fcfdd4e375c66377ca013c19ece15ee37))


### Bug Fixes

* enhance test pod security context to address guardrails findings ([a14e898](https://github.com/dwmkerr/mock-llm/commit/a14e89872c552b08f89197c1eefbdb4d481b9868))
* **mcp:** remove unused imports and obsolete test file ([944760a](https://github.com/dwmkerr/mock-llm/commit/944760a4899dea4ac07ac1f8686a5e5bdb29dbb1))
* properly close SSE connections in tests to prevent timeout ([b23c084](https://github.com/dwmkerr/mock-llm/commit/b23c0848bdb366f7b934a9a351af43fc1130e087))
* remove async from afterAll hooks to fix TypeScript errors ([bf67c4a](https://github.com/dwmkerr/mock-llm/commit/bf67c4a99a21559db0136d62cc11a7b88f9d115e))
* update MCP sample script to parse Streamable HTTP responses ([3d51389](https://github.com/dwmkerr/mock-llm/commit/3d51389f1b8dda640878c34ab8adb6ff83badab9))

## [0.1.16](https://github.com/dwmkerr/mock-llm/compare/v0.1.15...v0.1.16) (2025-10-27)


### Features

* exposing mock mcp-server with echo tool ([63336e0](https://github.com/dwmkerr/mock-llm/commit/63336e05e8089f65ee565a529bc9389e884766d9))


### Bug Fixes

* return 404 AgentNotFound for missing A2A agents ([95ece40](https://github.com/dwmkerr/mock-llm/commit/95ece400e76dedaeec0ecc7e0c9640a13dcdf51d))
* return 404 AgentNotFound for missing A2A agents ([ab0ecee](https://github.com/dwmkerr/mock-llm/commit/ab0ecee7b65dddd762e840476ad1005e306bfc1b))

## [0.1.15](https://github.com/dwmkerr/mock-llm/compare/v0.1.14...v0.1.15) (2025-10-22)


### Features

* add message-counter-agent for contextId demonstration ([450f75c](https://github.com/dwmkerr/mock-llm/commit/450f75c004d2b19028e663f0dd76817a5ce616c1))
* add message-counter-agent for contextId demonstration ([5b91b23](https://github.com/dwmkerr/mock-llm/commit/5b91b2364411a388aad7a061435bf96b521b4b6e))

## [0.1.14](https://github.com/dwmkerr/mock-llm/compare/v0.1.13...v0.1.14) (2025-10-17)


### Features

* add negative number validation to countdown agent ([a13cdc6](https://github.com/dwmkerr/mock-llm/commit/a13cdc630c5410614f52f82b65e2c8442031828d))

## [0.1.13](https://github.com/dwmkerr/mock-llm/compare/v0.1.12...v0.1.13) (2025-10-17)


### ⚠ BREAKING CHANGES

* createServer now requires host and port parameters

### Features

* add A2A protocol support with countdown agent ([04a3c04](https://github.com/dwmkerr/mock-llm/commit/04a3c049cc1dacd3a0127293b854dbd03199839c))
* add A2A protocol support with countdown agent ([d908bec](https://github.com/dwmkerr/mock-llm/commit/d908bec45ff0a634689bae2a44731b19b0d6d9d3))
* add Ark A2AServer CRD support for A2A agents ([adec0f6](https://github.com/dwmkerr/mock-llm/commit/adec0f63dac2dbaba1ee7ffceebe7130a0eb2756))
* add devspace config and K8s E2E tests ([70c7660](https://github.com/dwmkerr/mock-llm/commit/70c76604bd07f612311137d73c1571089b7d6b52))
* add devspace config and K8s E2E tests ([76225e2](https://github.com/dwmkerr/mock-llm/commit/76225e27030b4d4321e33b88e37eed9ac4b26cfc))
* add DISABLE_START_SERVER env var for testing against deployed services ([921bf31](https://github.com/dwmkerr/mock-llm/commit/921bf31e7bb05d75d0eecea065d3c6cc750b3632))
* add echo agent and A2AAgent interface ([c1206e8](https://github.com/dwmkerr/mock-llm/commit/c1206e80065836556559965612bff534caa7fe89))
* add echo agent and A2AAgent interface ([a132bae](https://github.com/dwmkerr/mock-llm/commit/a132baec70c5508ba230ac055db25dd0102d59d3))
* add printConfigSummary helper with improved logging ([e2fcd49](https://github.com/dwmkerr/mock-llm/commit/e2fcd49dfc36a6c11025331f461a545b94aa4982))
* change port to 6556 (MLLM on dialpad) ([00246ac](https://github.com/dwmkerr/mock-llm/commit/00246ac821114ffba9f08e20560709df6a85fed6))
* show rule numbers in config logging ([77d1636](https://github.com/dwmkerr/mock-llm/commit/77d1636da5a28a7b5aa50b02ffda74b18c503c9c))


### Bug Fixes

* use correct devspace installation method ([7667d70](https://github.com/dwmkerr/mock-llm/commit/7667d7096c29cd7260332e73732ceb7740447513))
* use import() instead of require() in main.spec.ts ([f2f66d7](https://github.com/dwmkerr/mock-llm/commit/f2f66d7a81e855cddc79b9a39bcfd91abe4686ec))
* use serviceRef for A2AServer address ([38e0701](https://github.com/dwmkerr/mock-llm/commit/38e0701ff185ea62cb06f0b844be89365bf2d611))


### Miscellaneous Chores

* release 0.1.13 ([625a020](https://github.com/dwmkerr/mock-llm/commit/625a020146d1b6a0ea2735a827c7558ba4e7bc38))

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
