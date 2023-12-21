/**
 * @description Stores information on the plug-in
 * @copyright 2023
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module InfoTable
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _is from 'is-it-check';

/**
 * @description Class for storing plug-in information
 */
export class InfoTable {
    /**
     * @description Constructor
     * @param {object} config - Configuration data
     * @param {string} config.plugin_version - Plug-in version.
     * @param {string} config.homebridge_api_version - Homebridge API version.
     * @param {string} config.homebridge_server_version - Homebridge Server version.
     * @param {string} config.hap_library_version - HAP Library version.
     * @param {number} config.accessory_version - Accessory version.
     * @throws {TypeError} - thrown if the configuration is undefined or any parameters are not of the expected type.
     * @throws {RangeError} - thrown if the configuration parameters are out of bounds.
     * @private
     */
    constructor(config) {
        if (_is.undefined(config) || _is.not.object(config) ||
            _is.undefined(config.plugin_version) || _is.not.string(config.plugin_version) ||
            _is.undefined(config.homebridge_api_version) || _is.not.number(config.homebridge_api_version) ||
            _is.undefined(config.homebridge_server_version) || _is.not.string(config.homebridge_server_version) ||
            _is.undefined(config.hap_library_version) || _is.not.string(config.hap_library_version) ||
            _is.undefined(config.accessory_version) || _is.not.number(config.accessory_version)) {
            // Invalid configuration
            throw new TypeError(`Info table configuration is invalid.`);
        }
        if (_is.under(config.accessory_version, 1)) {
            throw new RangeError(`Info table data out of range.`);
        }

        this._verPlugIn = config.plugin_version;
        this._verHomebridgeAPI = config.homebridge_api_version;
        this._verHomebridgeServer = config.homebridge_server_version;
        this._verHAPLibrary = config.hap_library_version;
        this._verAccessory = config.accessory_version;
    }

    /**
     * @description Read Property accessor for the plug-in version
     * @returns {string} - Plug-in version
     * @private
     */
    get PlugInVersion() {
        return this._verPlugIn;
    }

    /**
     * @description Read Property accessor for the Homebridge API version
     * @returns {string} - Homebridge API version
     * @private
     */
    get HomebridgeAPIVersion() {
        return this._verHomebridgeAPI;
    }

    /**
     * @description Read Property accessor for the Homebridge Server version
     * @returns {string} - Homebridge API version
     * @private
     */
    get HomebridgeServerVersion() {
        return this._verHomebridgeServer;
    }

    /**
     * @description Read Property accessor for the HAP Library version
     * @returns {string} - HAP Library version
     * @private
     */
    get HAPLibraryVersion() {
        return this._verHAPLibrary;
    }

    /**
     * @description Read Property accessor for the Accessory version
     * @returns {string} - Accessory version
     * @private
     */
    get AccessoryVersion() {
        return this._verAccessory;
    }
}
