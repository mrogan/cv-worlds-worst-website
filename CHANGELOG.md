# Changelog

## [0.2.0](https://github.com/mrogan/cv-worlds-worst-website/compare/v0.1.0...v0.2.0) (2026-10-10)


### Features

* **deploy:** judge each step of a release by the factory's analysis ([#34](https://github.com/mrogan/cv-worlds-worst-website/issues/34)) ([15daac1](https://github.com/mrogan/cv-worlds-worst-website/commit/15daac157b8c5914eefe8de95cf5a7660ad7c071))
* **deploy:** release the shop as a canary with Argo Rollouts ([#33](https://github.com/mrogan/cv-worlds-worst-website/issues/33)) ([e27d5fb](https://github.com/mrogan/cv-worlds-worst-website/commit/e27d5fb5e5339144b1e72675c0e65323a4c0eb82))


### Bug Fixes

* **products:** redirect /departments/:slug to its product list ([#17](https://github.com/mrogan/cv-worlds-worst-website/issues/17)) ([f56e343](https://github.com/mrogan/cv-worlds-worst-website/commit/f56e343c079d53a561b9ac65d501d7815222ac02))
* **search:** decode the search query only once ([#25](https://github.com/mrogan/cv-worlds-worst-website/issues/25)) ([a1a660c](https://github.com/mrogan/cv-worlds-worst-website/commit/a1a660c9fc30d323686ce45b31d68945252a8c31))


### Reverts

* serialise every request behind one lock (canary drill) ([#37](https://github.com/mrogan/cv-worlds-worst-website/issues/37)) ([464cd31](https://github.com/mrogan/cv-worlds-worst-website/commit/464cd31ecdd5517f8aaae65ab64d805e62663437))

## 0.1.0 (2026-10-02)


### Features

* open the shop ([7d3353a](https://github.com/mrogan/cv-worlds-worst-website/commit/7d3353a10f3847284a24ab09cc5db9781f338ecc))
