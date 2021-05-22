# Change Log
Change history for _homebridge-grumptech-netnanny_

---
---
## [1.3.0] - 2021-MAY-19
### What's new
- [Issue #12](https://github.com/pricemi115/homebridge-grumptech-netnanny/issues/12): Added a mechanism to specify which Carbon Dioxise senors issue _carbond dioxide detected_ alerts when a fault is detected.

## [1.2.0] - 2021-MAY-14
### What's new
- The moving average of ping results was replaced with filtering the data using the [AVT (Antonyan Vardan Transform)](https://en.wikipedia.org/wiki/AVT_Statistical_filtering_algorithm) algorithm.

### Fixes
- Ensure that the buffers are full before issuing Carbon Dioxide alerts.
- Theshold for detecting issues with the Ping Standard Deviation were three times higer than what was specified in the configuration.

## [1.0.0] - 2021-MAY-10
### What's new
- Updated documentation

### Fixes
- Fixed minor issues with the configuration schema for use with _homebridge-config-ui-x_

## [0.0.2] (Beta 2) - 2021-APR-27
### Fixes
- Fixed crash/race-condition when network target was set to 'Gateway' in the configuration.

## [0.0.1] (Beta 1) - 2021-APR-27
### What's new
- Initial release

