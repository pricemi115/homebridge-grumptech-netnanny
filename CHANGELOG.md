# Change Log
Change history for _homebridge-grumptech-netnanny_

---
---

## [1.3.2] - 2021-MAY-29
### What's new
- Publish a policy regarding what versions receive updates for security vulnerabilities and how to report vulnerabilities.

### Fixes
- [Issue #11](https://github.com/pricemi115/homebridge-grumptech-netnanny/issues/11): Clear data buffers when activating an accessory.
- [Issue #15](https://github.com/pricemi115/homebridge-grumptech-netnanny/issues/15): Detect and clear orphaned accessories.
- [Issue #16](https://github.com/pricemi115/homebridge-grumptech-netnanny/issues/16): Fix documentation of the sensor alert mask.
- Update dependencies to resolve security vulnerability CVE-2021-23386.

---
## [1.3.1] - 2021-MAY-21
### Fixes
- Silly typos in the change log for v1.3.0

---
## [1.3.0] - 2021-MAY-19
### What's new
- [Issue #12](https://github.com/pricemi115/homebridge-grumptech-netnanny/issues/12): Added a mechanism to specify which Carbon Dioxide senors issue _carbon dioxide detected_ alerts when a fault is detected.

---
## [1.2.0] - 2021-MAY-14
### What's new
- The moving average of ping results was replaced with filtering the data using the [AVT (Antonyan Vardan Transform)](https://en.wikipedia.org/wiki/AVT_Statistical_filtering_algorithm) algorithm.

### Fixes
- Ensure that the buffers are full before issuing Carbon Dioxide alerts.
- Theshold for detecting issues with the Ping Standard Deviation were three times higer than what was specified in the configuration.

---
## [1.0.0] - 2021-MAY-10
### What's new
- Initial (official) release

### Fixes
- Fixed minor issues with the configuration schema for use with _homebridge-config-ui-x_
