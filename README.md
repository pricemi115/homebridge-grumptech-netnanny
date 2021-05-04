# Homebridge Net Nanny

[Homebridge Net Nanny](https://github.com/pricemi115/homebridge-grumptech-netnanny), by [GrumpTech](https://github.com/pricemi115/), is a [Homebridge](https://homebridge.io) dynamic platform plug-in that publishes metrics measuring the health of a network.
This plugin was inspired by [Dave Hamilton's](https://twitter.com/DaveHamilton), of [the Mac Observer](https://www.macobserver.com), 3-Ping strategy for evaluating network health.

## Installation

This plug-in is intended to be used with the [homebridge-config-ui-x](https://www.npmjs.com/package/homebridge-config-ui-x) homebridge management tool. If using _homebridge-config-ui-x_, simply search for _homebridge-grumptech-netnanny_ for installation, plug-in management, and configuration.

To install the plugin manually:
<br>_`npm install -g homebridge-grumptech-netnanny`_

## Configuration
### _homebridge-config-ui-x_
This plugin is best experienced when running as a module installed and managed by the [_homebridge-config-ui-x_](https://www.npmjs.com/package/homebridge-config-ui-x) plugin. When running under homebridge-config-ui-x, visiting the plugin settings will allow you to change the polling interval and the low space alarm threshold, as shown below.<br/>
<img src="./assets/config-ui-x_settings.png"
     alt="homebridge-config-ui-x plugin settings screen for Net Nanny"
     style="padding:2px 2px 2px 2px; border:2px solid; margin:0px 10px 0px 0px; vertical-align:top;"
     width="40%">
<img src="./assets/config-ui-x_configjson.png"
     alt="homebridge-config-ui-x plugin configuration JSON settings for Net Nanny"
     style="padding:2px 2px 2px 2px; border:2px solid; margin:0px 10px 0px 0px; vertical-align:top;"
     width="31.5%">

| Setting | Description | Data Type | Units | Default | Minimum | Maximum |
| :------: | :------: | :------: | :------: | :------: | :------: | :------: |

<br/>

Additionally, especially if this system will be running other homebridge modules, it is strongly encouraged to run this plugin as an isolated child bridge. This setting page can be found by clicking on the _wrench_ icon on the plugin and then selecting _Bridge Settings_. With the child bridge enabled, revisiting the setting page after homebridge is rebooted will show a QR code for pairing to the child bridge. The username (mac address) and port are randomly generaged by homebridge-config-ui-x.<br/>
<img src="./assets/config-ui-x_bridgesettings_disabled.png"
     alt="homebridge-config-ui-x plugin configuration showing the child bridge disabled"
     style="padding:2px 2px 2px 2px; border:2px solid; margin:0px 10px 0px 0px; vertical-align:top;"
     width="51.5%">
<img src="./assets/config-ui-x_bridgesettings_enabled.postreboot.png"
     alt="homebridge-config-ui-x plugin configuration showing the child bridge active (unpaired)"
     style="padding:2px 2px 2px 2px; border:2px solid; margin:0px 10px 0px 0px; vertical-align:top;"
     width="30%">

### Manual Configuration
If you would rather manually configure and run the plugin, you will find a sample _config.json_ file in the `./config` folder. It is left to the user to get the plugin up and running within homebridge. Refer to the section above for specifics on the configuration parameters.

## Usage
The plugin will create, or restore, a dynamic accessory for each network target specified in the comfiguration. Each accessory will advertise four services: (1) switch, and (3) carbon dioxide sensors. All of the data presented for the carbon dioxide sensors is the result of passing the ping results through a moving average. In an effort to keep outliers from affecting the reported values, a user-specified number of outliers will be excluded from the moving average computation. The outliners that are excluded alternate between the highest then lowest values until the number of values to exclude has been reached.

- **Power**: A switch, with the name of the Target Destination, that controls the active state of the network performance target.
- **Time**: The average ping time, in milliseconds. The peak value is also displayed.
- **Standard Deviation**: The standard deviation of this ping results, in milliseconds. The peak value is also displayed.
- **Packet Loss**: The packet loss, in percent. The peak value is also displayed.

When the current value for any of the carbon dioxide sensors exceeds the user-specified expected limits, the sensor’s alert will be set. When the value continues to exceed the limits beyond a user configurable threshold, the sensor’s _Detected_ value will be set to abnormal levels.

When the accessory is inactive, the _Active_ and _Low Battery Status_ are set. 

## Restrictions
This module operates by using shell commands to the `ping` and `route` programs. At this time, the plugin assumes macOS output when parsing the results. While the `ping` output is consistent across operating systems, the `route` output is operating system specific. As a result, the `gateway/router` type selection is limited to macOS.

## Known Issues and Planned Enhancements
Refer to the bugs and enhancements listed [here](https://github.com/pricemi115/homebridge-grumptech-volmon/issues)

## Contributing
1. Fork it!
2. Create your feature/fix branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Credits
Many thanks to all the folks contributing to [Homebridge](https://homebridge.io) and to [oznu](https://github.com/oznu) for [homebridge-config-ui-x](https://www.npmjs.com/package/homebridge-config-ui-x), allowing for the possibility of this sort of fun and learning.<br/>
Special thanks to [Dave Hamilton's](https://twitter.com/DaveHamilton), [John F. Braun](https://twitter.com/johnfbraun), and the [MacGeekGab](https://twitter.com/MacObserver) podcast for inspiring the idea for this plugin.

## License

Refer to [LICENSE.md](./LICENSE.md) for information regarding licensincg of this source code.