# Changelog

## [0.2.1](https://github.com/mrogan/cv-worlds-worst-website/compare/v0.2.0...v0.2.1) (2026-10-12)


### Bug Fixes

* **app:** serve requests concurrently with no fixed hold ([#69](https://github.com/mrogan/cv-worlds-worst-website/issues/69)) ([94e8cce](https://github.com/mrogan/cv-worlds-worst-website/commit/94e8ccec5be230b4e12ba4d9bcdbe10d59578c60))
* **contact:** accept capitals, plus tags and long TLDs in email ([#61](https://github.com/mrogan/cv-worlds-worst-website/issues/61)) ([64f6f0a](https://github.com/mrogan/cv-worlds-worst-website/commit/64f6f0ac9d0f5379e6036a5e0bc5a115d992f0c0))
* **search:** match names, summaries and notes regardless of case ([#66](https://github.com/mrogan/cv-worlds-worst-website/issues/66)) ([6a9b3ee](https://github.com/mrogan/cv-worlds-worst-website/commit/6a9b3ee17eea8de5493ca06ca95b570b487fcc25))

## [0.2.0](https://github.com/mrogan/cv-worlds-worst-website/compare/v0.1.0...v0.2.0) (2026-10-12)


### Features

* **deploy:** judge each step of a release by the factory's analysis ([#34](https://github.com/mrogan/cv-worlds-worst-website/issues/34)) ([15daac1](https://github.com/mrogan/cv-worlds-worst-website/commit/15daac157b8c5914eefe8de95cf5a7660ad7c071))
* **deploy:** release the shop as a canary with Argo Rollouts ([#33](https://github.com/mrogan/cv-worlds-worst-website/issues/33)) ([e27d5fb](https://github.com/mrogan/cv-worlds-worst-website/commit/e27d5fb5e5339144b1e72675c0e65323a4c0eb82))


### Bug Fixes

* **home:** stop logging a missing greeting as an error on / ([#50](https://github.com/mrogan/cv-worlds-worst-website/issues/50)) ([8255dac](https://github.com/mrogan/cv-worlds-worst-website/commit/8255dac58a659bdac70ee82a18cdccdcdd4cda97))
* **home:** stop logging an error for a missing hourly greeting ([#46](https://github.com/mrogan/cv-worlds-worst-website/issues/46)) ([bd0f972](https://github.com/mrogan/cv-worlds-worst-website/commit/bd0f97252e9a68937b2bb4c6c741b3eb85788f38))
* **home:** stop logging an error on every hundredth visit to / ([#54](https://github.com/mrogan/cv-worlds-worst-website/issues/54)) ([5f08f55](https://github.com/mrogan/cv-worlds-worst-website/commit/5f08f551b4a18c4d8b130dae0aa2f5027797bd57))
* **products:** redirect /departments/:slug to its product list ([#17](https://github.com/mrogan/cv-worlds-worst-website/issues/17)) ([f56e343](https://github.com/mrogan/cv-worlds-worst-website/commit/f56e343c079d53a561b9ac65d501d7815222ac02))
* **search:** decode the search query only once ([#25](https://github.com/mrogan/cv-worlds-worst-website/issues/25)) ([a1a660c](https://github.com/mrogan/cv-worlds-worst-website/commit/a1a660c9fc30d323686ce45b31d68945252a8c31))
* **telemetry:** keep a monitoring client's requests out of the request metrics ([#58](https://github.com/mrogan/cv-worlds-worst-website/issues/58)) ([6a8d63d](https://github.com/mrogan/cv-worlds-worst-website/commit/6a8d63d9267a560bc121d782ac3d35807f7d5297))


### Reverts

* serialise every request behind one lock (canary drill) ([#37](https://github.com/mrogan/cv-worlds-worst-website/issues/37)) ([464cd31](https://github.com/mrogan/cv-worlds-worst-website/commit/464cd31ecdd5517f8aaae65ab64d805e62663437))
* serialise every request behind one lock again (canary drill) ([#41](https://github.com/mrogan/cv-worlds-worst-website/issues/41)) ([680c351](https://github.com/mrogan/cv-worlds-worst-website/commit/680c351fe17b033293f353ea7b7d5d84978dbead))

## 0.1.0 (2026-10-02)


### Features

* open the shop ([7d3353a](https://github.com/mrogan/cv-worlds-worst-website/commit/7d3353a10f3847284a24ab09cc5db9781f338ecc))
