/**
 * @description Stores network performance data.
 * @copyright 2023
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module NetworkTargetModule
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */

// External dependencies and imports.
import _is from 'is-it-check';

/**
 * @description Class for recording network data
 */
export class DataTable {
    /**
     * @description Constructor
     * @param {object} config - Configuration data
     * @param {Date=} config.date - Date/Time of the event. Will default to now.
     * @param {number} config.error - Bitmask of the fault(s) observed.
     * @param {number} config.packet_loss - Packet loss
     * @param {number} config.jitter - Jitter
     * @param {number} config.latency - Latency
     * @throws {TypeError} - thrown if the configuration is undefined or any parameters are not of the expected type.
     * @throws {RangeError} - thrown if the configuration parameters are out of bounds.
     * @private
     */
    constructor(config) {
        if (_is.undefined(config) || _is.not.object(config) ||
            _is.undefined(config.error) || _is.not.number(config.error) ||
            _is.undefined(config.packet_loss) || _is.not.number(config.packet_loss) ||
            _is.undefined(config.jitter) || _is.not.number(config.jitter) ||
            _is.undefined(config.latency) || _is.not.number(config.latency) ||
            (_is.not.undefined(config.date) && !(config.date instanceof Date))) {
            // Invalid configuration
            throw new TypeError(`Data table configuration is invalid.`);
        }
        if (_is.under(config.packet_loss, 0.0) || _is.above(config.packet_loss, 100.0) ||
            _is.under(config.jitter, 0.0) || _is.under(config.latency, 0.0)) {
            throw new RangeError(`Data table data out of range.`);
        }

        this._error = config.error;
        this._packetLoss = config.packet_loss;
        this._jitter = config.jitter;
        this._latency = config.latency;

        this._date = config.date;
        if (_is.undefined(config.date)) {
            // Default to now, in UTC
            const now = new Date();
            /* eslint-disable indent */
            this._date = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
                                  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
           /* eslint-enable indent */
        }
    }

    /**
     * @description Read Property accessor for the history date
     * @returns {Date} - Date of history entry
     * @private
     */
    get Date() {
        return this._date;
    }

    /**
     * @description Read Property accessor for the history error
     * @returns {number} - error bitmask
     * @private
     */
    get Error() {
        return this._error;
    }

    /**
     * @description Read Property accessor for the history packet loss
     * @returns {number} - Packet Loss
     * @private
     */
    get PacketLoss() {
        return this._packetLoss;
    }

    /**
     * @description Read Property accessor for the history jitter
     * @returns {number} - Jitter
     * @private
     */
    get Jitter() {
        return this._jitter;
    }

    /**
     * @description Read Property accessor for the history latency
     * @returns {number} - Latency
     * @private
     */
    get Latency() {
        return this._latency;
    }
}
