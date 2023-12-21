/**
 * @description Monitors network performance for a target based on ping results.
 * @copyright 2021
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module NetworkTargetModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires events
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/events}
 * @requires crypto
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/crypto.html}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 * @requires grumptech-spawn-helper
 * @see {@link https://github.com/pricemi115/grumptech-spawn-helper#readme}
 */

// External dependencies and imports.
import _debugModule from 'debug';
import EventEmitter from 'events';
import * as modCrypto from 'crypto';
import _is from 'is-it-check';
import {default as _SpawnHelper, SPAWN_HELPER_EVENTS as _SPAWN_HELPER_EVENTS} from 'grumptech-spawn-helper';

/**
 * @description Debugging function pointer for runtime related diagnostics.
 * @private
 */
const _debug = _debugModule('network_target');
// Bind debug to console.log
_debug.log = console.log.bind(console);

// Helpful constants and conversion factors.
/**
 * @description Default time, in seconds, for initiating a set of ping requests.
 * @private
 */
const DEFAULT_PERIOD_SEC            = 20.0;
/**
 * @description Default number of ping operations for each set.
 * @private
 */
const DEFAULT_PING_COUNT            = 5;
/**
 * @description Minimum number of ping operations for each set.
 * @private
 */
const MIN_PING_COUNT                = 3; // Need at least 3 to compute a standard deviation
/**
 * @description Default time, in seconds, between each ping operation within a set.
 * @private
 */
const DEFAULT_PING_INTERVAL         = 1;
/**
 * @description Minimim time, in seconds, between each ping operation within a set.
 * @private
 */
const MIN_PING_INTERVAL             = 1;
/**
 * @description Minimum time, in seconds, between sets of ping requests.
 * @private
 */
const MIN_PERIOD_SEC                = (2.0*MIN_PING_INTERVAL*MIN_PING_COUNT);
/**
 * @description Minimum size, in bytes, for the packets of each ping request.
 * @private
 */
const MIN_PACKET_SIZE               = 56;
/**
 * @description Default size, in bytes, for the packets of each ping request.
 * @private
 */
const DEFAULT_PACKET_SIZE           = MIN_PACKET_SIZE;
/**
 * @description Conversion factor to go from secods to milliseconds.
 * @private
 */
const CONVERT_SEC_TO_MS             = 1000.0;
/**
 * @description Flag value for an invalid timeout
 * @private
 */
const INVALID_TIMEOUT_ID            = -1;
/**
 * @description Default limit of packet loss before declaring an error.
 * @private
 */
const DEFAULT_PACKET_LOSS_LIMIT     = 5.0;
/**
 * @description Minimum limit of packet loss.
 * @private
 */
const MIN_LOSS_LIMIT                = 0.0;
/**
 * @description Maximum limit of packet loss.
 * @private
 */
const MAX_LOSS_LIMIT                = 100.0;
/**
 * @description Default time, in milliseconds, for expiring a peak result.
 * @private
 */
const DEFAULT_PEAK_EXPIRATION_MS    = 43200000; // 12-hours converted to milliseconds.
/**
 * @description Default time, in seconds, for filtering the ping results.
 * @private
 */
const DEFAULT_DATA_FILTER_TIME_SEC  = 180.0;

/**
 * @description Enumeration for target types
 * @readonly
 * @private
 * @enum {string}
 * @property {string} URI - Target type for a URI/URL
 * @property {string} IPV4 - Target type for an IPV4 ip address
 * @property {string} IPV6 - Target type for an IPV6 ip address
 * @property {string} GATEWAY - Target type for a cable modem gateway (192.168.100.1)
 * @property {string} ROUTER - Target type for the router
 */
export const TARGET_TYPES = {
    /* eslint-disable key-spacing */
    URI         : 'uri',
    IPV4        : 'ipv4',
    IPV6        : 'ipv6',
    GATEWAY     : 'gateway',
    CABLE_MODEM : 'cable_modem',
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration for peak types
 * @readonly
 * @private
 * @enum {string}
 * @property {string} LATENCY - Latency peak type
 * @property {string} JITTER - Jitter peak type
 * @property {string} LOSS - Packet loss peak type
 */
export const PEAK_TYPES = {
    /* eslint-disable key-spacing */
    LATENCY    : 'peak_latency',
    JITTER     : 'peak_jitter',
    LOSS       : 'peak_packet_loss',
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration for buffer types
 * @readonly
 * @private
 * @enum {string}
 * @property {string} LATENCY - Latency buffer type
 * @property {string} JITTER - Jitter buffer type
 * @property {string} LOSS - Packet loss buffer type
 */
export const DATA_BUFFER_TYPES = {
    /* eslint-disable key-spacing */
    LATENCY    : 'data_latency',
    JITTER     : 'data_jitter',
    LOSS       : 'data_packet_loss',
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration for Alert Types (Bitmask)
 * @readonly
 * @private
 * @enum {number}
 * @property {number} NONE - No alerts
 * @property {number} LATENCY - Latency alert only
 * @property {number} LOSS - Packet Loss alert only
 * @property {number} JITTER - Jitter alert only
 * @property {number} ALL - All alerts (Latency, Packet Loss, & Jitter)
 */
export const ALERT_BITMASK = {
    /* eslint-disable key-spacing */
    NONE    : 0,
    LATENCY : 1,
    LOSS    : 2,
    JITTER  : 4,
    ALL     : 7,
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration for Standard Deviation Types. Used to set the offset when computing the result.
 * @readonly
 * @private
 * @enum {number}
 * @property {number} POPULATION = Standard deviation algorithm for population data.
 * @property {number} SAMPLE = Standard deviation algorithm for a fzed-size sample.
 */
const STANDARD_DEV_TYPE = {
    /* eslint-disable key-spacing */
    POPULATION : 0,
    SAMPLE     : 1,
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration of published events.
 * @readonly
 * @private
 * @enum {string}
 * @property {string} EVENT_READY - Identification for the event published when scanning completes.
 */
export const NETWORK_TARGET_EVENTS = {
    /* eslint-disable key-spacing */
    EVENT_READY    : 'ready',
    /* eslint-enable key-spacing */
};

/**
 * @description Enumeration of supported operating systems for finding the gateway.
 * @readonly
 * @private
 * @enum {string}
 * @property {string} OS_DARWIN - macOS
 * @property {string} OS_LINUX - Linux
 */
const SUPPORTED_GATEWAY_OPERATING_SYSTEMS = {
    /* eslint-disable key-spacing */
    OS_DARWIN: 'darwin',
    OS_LINUX:  'linux',
    OS_WINDOWS:'windows',
    /* eslint-enable key-spacing */
};

/**
 * @description Network Target ready notification
 * @event module:NetworkTargetModule#event:ready
 * @type {object}
 * @param {NetworkTarget} e.sender - Reference to the sender of the event.
 * @param {boolean} e.error -Flag indicating is there is an error with the ping.
 * @param {number} e.packet_loss - Packet Loss (percent)
 * @param {number} e.ping_latency_ms - Ping Latency in milliseconds.
 * @param {number} e.ping_jitter - Ping Jitter in milliseconds.
 * @private
 */
/**
 * @description Class for performing network performance monitoring
 * @augments EventEmitter
 */
export class NetworkTarget extends EventEmitter {
    /**
     * @description Constructor
     * @param {object} config - Configuration data
     * @param {string=} config.target_type - Type of target
     * @param {string=} config.target_dest - Destination of the target
     * @param {string=} config.loss_lmit - Percentage of lost packets that is tolerable.
     * @param {string=} config.packet_size - Size, in bytes, of the ping packet
     * @param {string=} config.ping_count - Number of pings to perform
     * @param {string=} config.peak_expiration - Time (in hours) after which an unchanged peak should be reset
     * @param {string=} config.expected_latency - Time (in milliseconds) for the expected ping latency.
     * @param {string=} config.expected_jitter - Expected ping jitter (in milliseconds).
     * @param {string=} config.data_filter_time_window - Data filter time period
     * @param {string=} config.alert_mask - Bitmask indicating which CO2 sensor alerts are active.
     * @throws {TypeError} - thrown if the configuration is undefined or any parameters are not of the expected type.
     * @throws {RangeError} - thrown if the configuration parameters are out of bounds.
     * @private
     */
    constructor(config) {
        // Set local defaults
        let pingCount       = DEFAULT_PING_COUNT;
        let pingPeriod      = DEFAULT_PERIOD_SEC;
        let pingInterval    = DEFAULT_PING_INTERVAL;
        let targetType      = TARGET_TYPES.URI;
        let targetDest      = 'localhost';
        let expectedLatency = 10.0;
        let expectedJitter  = 1.0;
        let packetSize      = DEFAULT_PACKET_SIZE;
        let lossLimit       = DEFAULT_PACKET_LOSS_LIMIT;
        let peakExpirationTime = DEFAULT_PEAK_EXPIRATION_MS;
        let dataFilterTime  = DEFAULT_DATA_FILTER_TIME_SEC;
        let alertBitmask    = ALERT_BITMASK.ALL;
        // Check for expected types
        if (config !== undefined) {
            if (                                                   (typeof(config) !== 'object')                          ||
                ((config.target_type !== undefined)             && (typeof(config.target_type) !== 'string'))             ||
                ((config.target_dest !== undefined)             && (typeof(config.target_dest) !== 'string'))             ||
                ((config.loss_limit !== undefined)              && (typeof(config.loss_limit) !== 'number'))              ||
                ((config.packet_size !== undefined)             && (typeof(config.packet_size) !== 'number'))             ||
                ((config.ping_period !== undefined)             && (typeof(config.ping_period) !== 'number'))             ||
                ((config.ping_interval !== undefined)           && (typeof(config.ping_count) !== 'number'))              ||
                ((config.ping_count !== undefined)              && (typeof(config.ping_count) !== 'number'))              ||
                ((config.peak_expiration !== undefined)         && (typeof(config.peak_expiration) !== 'number'))         ||
                ((config.expected_latency !== undefined)        && (typeof(config.expected_latency) !== 'number'))        ||
                ((config.expected_jitter !== undefined)         && (typeof(config.expected_jitter) !== 'number'))         ||
                ((config.data_filter_time_window !== undefined) && (typeof(config.data_filter_time_window) !== 'number')) ||
                ((config.alert_mask !== undefined)              && (typeof(config.alert_mask) !== 'number'))                ) {
                throw new TypeError(`Configuration is invalid: ${config.toString()}`);
            }
            // Check for expected values.
            if (config.target_type) {
                let found = false;
                for (const item in TARGET_TYPES) {
                    if (config.target_type.toLowerCase() === TARGET_TYPES[item]) {
                        targetType = config.target_type.toLowerCase();
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new RangeError(`config.target_type is invalid: ${config.target_type}`);
                }
            }
            if (config.target_dest) {
                if (config.target_dest.length > 0) {
                    if ((targetType !== TARGET_TYPES.ROUTER) &&
                        (targetType !== TARGET_TYPES.CABLE_MODEM)) {
                        targetDest = config.target_dest;
                    }
                    else {
                        throw new Error(`Target destination is not valid. type:${targetType} dest:${config.target_dest}`);
                    }
                }
                else {
                    throw new RangeError(`config.target_dest is invalid: ${config.target_dest}`);
                }
            }
            if (config.loss_limit) {
                if ((config.loss_limit >= MIN_LOSS_LIMIT) && (config.loss_limit <= MAX_LOSS_LIMIT)) {
                    lossLimit = config.loss_limit;
                }
                else {
                    throw new RangeError(`Packet Loss limit is undefined or is outside the allowed range. ${config.loss_limit}`);
                }
            }
            if (config.packet_size) {
                if (config.packet_size >= MIN_PACKET_SIZE) {
                    packetSize = config.packet_size;
                }
                else {
                    throw new RangeError(`Ping packet size is undefined or is less than the minimum. ${config.packet_size}`);
                }
            }
            if (config.ping_period) {
                if (config.ping_period >= MIN_PERIOD_SEC) {
                    pingPeriod = config.ping_period;
                }
                else {
                    throw new RangeError(`Ping period is undefined or is less than the minimum. ${config.ping_period}`);
                }
            }
            if (config.ping_interval) {
                if (config.ping_interval >= MIN_PING_INTERVAL) {
                    pingInterval = config.ping_interval;
                }
                else {
                    throw new RangeError(`Ping interval is undefined or is less than the minimum. ${config.ping_interval}`);
                }
            }
            if (config.ping_count) {
                if (config.ping_count >= MIN_PING_COUNT) {
                    pingCount = config.ping_count;
                }
                else {
                    throw new RangeError(`Ping count is undefined or is less than the minimum. ${config.ping_count}`);
                }
            }
            if (config.peak_expiration) {
                if (config.peak_expiration >= 0) {
                    // Convert the expiration time provided from hours to milliseconds.
                    peakExpirationTime = config.peak_expiration * (3600/* sec/hr */*1000/* milliseconds/sec */);
                }
                else {
                    throw new RangeError(`Ping expiration time is undefined or is less than the minimum. ${config.peak_expiration}`);
                }
            }
            if (config.expected_latency) {
                if (config.expected_latency > 0) {
                    expectedLatency = config.expected_latency;
                }
                else {
                    throw new RangeError(`config.expected_latency is invalid: ${config.expected_latency}`);
                }
            }
            if (config.expected_jitter) {
                if (config.expected_jitter > 0) {
                    expectedJitter = config.expected_jitter;
                }
                else {
                    throw new RangeError(`config.expected_jitter is invalid: ${config.expected_jitter}`);
                }
            }
            if (config.data_filter_time_window) {
                if (config.data_filter_time_window > pingPeriod) {
                    dataFilterTime = config.data_filter_time_window;
                }
                else {
                    dataFilterTime = pingPeriod;
                }
            }
            if (config.alert_mask) {
                if ((config.alert_mask >= ALERT_BITMASK.NONE) && (config.alert_mask <= ALERT_BITMASK.ALL)) {
                    alertBitmask = config.alert_mask;
                }
                else {
                    throw new RangeError(`config.alert_mask is invalid: ${config.alert_mask}`);
                }
            }
        }

        // Initialize the base class.
        super();

        // Set internal members.
        this._target_type               = targetType;
        this._target_dest               = targetDest;
        this._ping_count                = pingCount;
        this._loss_limit                = lossLimit;
        this._ping_packet_size          = packetSize;
        this._ping_interval             = pingInterval;
        this._ping_period               = pingPeriod;
        this._peak_expiration           = peakExpirationTime;
        this._data_buffer_size          = Math.floor(dataFilterTime/pingPeriod);
        this._expected_latency          = expectedLatency;
        this._expected_jitter           = expectedJitter;
        this._alertMask                 = alertBitmask;
        this._timeoutID                 = INVALID_TIMEOUT_ID;
        this._pingInProgress            = false;
        this._destination_pending       = false;

        // Create a map of Date objects for tracking when the peaks
        // were last set.
        const now = Date.now();
        /* eslint-disable indent */
        this._peakTime = new Map([[PEAK_TYPES.LATENCY,  now],
                                  [PEAK_TYPES.JITTER,   now],
                                  [PEAK_TYPES.LOSS,     now]]);
        /* eslint-enable indent */
        // Create a map of data buffers for the numeric results.
        /* eslint-disable indent */
        this._dataBuffers = new Map([[DATA_BUFFER_TYPES.LATENCY, []],
                                     [DATA_BUFFER_TYPES.JITTER,  []],
                                     [DATA_BUFFER_TYPES.LOSS,    []]]);
        /* eslint-enable indent */

        // Callbacks bound to this object.
        this._CB__initiateCheck     = this._on_initiateCheck.bind(this);
        this._CB__ping              = this._on_process_ping.bind(this);
        this._CB__findGatewayAddr   = this._on_find_gateway_address.bind(this);

        // Special handling of target types.
        switch (this._target_type) {
            case TARGET_TYPES.CABLE_MODEM:
            {
                // Set the type to IPV4 and the destination to the common
                // address ued for cable modems.
                this._target_type = TARGET_TYPES.IPV4;
                this._target_dest = '192.168.100.1';

                break;
            }

            case TARGET_TYPES.GATEWAY:
            {
                this._target_dest = '';
                // Spawn a request to determine the address of the router.
                const ping = new _SpawnHelper();
                ping.on(_SPAWN_HELPER_EVENTS.EVENT_COMPLETE, this._CB__findGatewayAddr);
                // eslint-disable-next-line new-cap
                ping.Spawn({command: 'route', arguments: this._routeArguments});

                this._destination_pending = true;

                break;
            }

            case TARGET_TYPES.URI:
            {
                const prefixHTTPS = `https://`;
                const prefixHTTP  = `http://`;
                let target = this.TargetDestination.toLowerCase();
                if (_is.not.startWith(target, prefixHTTP) &&
                    _is.not.startWith(target, prefixHTTPS)) {
                    // Append the HTTPS prefix
                    target = prefixHTTPS + target;
                }

                // is-it-check requires URLs to start with 'http://' or 'https://'
                // Ensure that the destination in indeed a URI/URL.
                if (_is.not.url(target) &&
                    (this.TargetDestination.toLowerCase() !== 'localhost')) {
                    throw new RangeError(`Target Destination is not a URI/URL. ${this.TargetDestination}`);
                }

                break;
            }

            case TARGET_TYPES.IPV4:
            {
                // Ensure that the destination in indeed an IPV4.
                if (_is.not.ipv4(this.TargetDestination)) {
                    throw new RangeError(`Target Destination is not an IPV4. ${this.TargetDestination}`);
                }

                break;
            }

            case TARGET_TYPES.IPV6:
            {
                // Ensure that the destination in indeed an IPV6.
                if (_is.not.ipv6(this.TargetDestination)) {
                    throw new RangeError(`Target Destination is not an IPV6. ${this.TargetDestination}`);
                }

                break;
            }

            default:
            {
                // Should never happen.
                throw new RangeError(`Unknwon target type. ${this._target_type}`);

                // eslint-disable-next-line no-unreachable
                break;
            }
        }

        // Create an identifier based on the target type & destination.
        const hash = modCrypto.createHash('sha256');
        hash.update(this._target_type);
        hash.update(this._target_dest);
        this._id = hash.digest('hex');
    }

    /**
     * @description Read Property accessor for the identification
     * @returns {string} - Identiy string
     * @private
     */
    get ID() {
        return this._id;
    }

    /**
     * @description Read Property accessor for the number of ping requests per set.
     * @returns {number} - Number of pings
     * @private
     */
    get PingCount() {
        return this._ping_count;
    }

    /**
     * @description Read Property accessor for the limit (in percent) for packet loss
     * @returns {number} - Packet loss percent that is tolerated.
     * @private
     */
    get TolerableLoss() {
        return this._loss_limit;
    }

    /**
     * @description Read Property accessor for the size (in bytes) of each ping.
     * @returns {number} - Number of bytes in each ping.
     * @private
     */
    get PacketSize() {
        return this._ping_packet_size;
    }

    /**
     * @description Read Property accessor for the ping interval
     * @returns {number} - Time in seconds between ping requests.
     * @private
     */
    get PingInterval() {
        return this._ping_interval;
    }

    /**
     * @description Read Property accessor for the ping period
     * @returns {number} - Time in seconds between ping requests.
     * @private
     */
    get PingPeriod() {
        return this._ping_period;
    }

    /**
     * @description Read Property accessor for the target destination
     * @returns {string} - destination for the ping.
     * @private
     */
    get TargetDestination() {
        return this._target_dest;
    }

    /**
     * @description Read Property accessor for the target type
     * @returns {TARGET_TYPES} - type of target
     * @private
     */
    get TargetType() {
        return this._target_type;
    }

    /**
     * @description Read Property accessor for the expected ping latency
     * @returns {number} - time, in milliseconds, expected for the ping latency.
     * @private
     */
    get ExpectedLatency() {
        return this._expected_latency;
    }

    /**
     * @description Read Property accessor for the expected jitter of the ping time
     * @returns {number} - expected jitter of the ping (in milliseconds)
     * @private
     */
    get ExpectedJitter() {
        return this._expected_jitter;
    }

    /**
     * @description Read Property accessor for determining if the TargetDestination is pending (used for the Gateway type)
     * @returns {boolean} - true if pending, false otherwise.
     * @private
     */
    get IsTargetDestinationPending() {
        return this._destination_pending;
    }

    /* eslint-disable camelcase */
    /**
     * @description Determines if the specified data buffer is completely filled.
     * @param {DATA_BUFFER_TYPES} buffer_type - Type of the data buffer being querried
     * @returns {boolean} - true if the data buffer has been filled.
     * @throws {TypeError} - Thrown if 'buffer_type' is not a DATA_BUFFER_TYPES value.
     * @private
     */
    IsBufferFilled(buffer_type) {
        // Validate arguments
        if ((buffer_type === undefined) || (typeof(buffer_type) !== 'string') ||
            (Object.values(DATA_BUFFER_TYPES).indexOf(buffer_type) < 0)) {
            throw new TypeError(`buffer_type not a member of DATA_BUFFER_TYPES. ${buffer_type}`);
        }

        // Determine if the data buffer is filled.
        const filled = (this._dataBuffers.get(buffer_type).length >= this._data_buffer_size);

        return filled;
    }
    /* eslint-enable camelcase */

    /* eslint-disable camelcase */
    /**
     * @description Determines if the specified peak has expired
     * @param {PEAK_TYPES} peak_type - Type of the peak being querried
     * @returns {boolean} - true if the peak has not been updated in more than the allowable time.
     * @throws {TypeError} - Thrown if 'peak_type' is not a PEAK_TYPES value.
     * @private
     */
    IsPeakExpired(peak_type) {
        // Validate arguments
        if ((peak_type === undefined) || (typeof(peak_type) !== 'string') ||
            (Object.values(PEAK_TYPES).indexOf(peak_type) < 0)) {
            throw new TypeError(`peak_type not a member of PEAK_TYPES. ${peak_type}`);
        }

        // Determine the elapsed time (in milliseconds)
        const delta = Date.now() - this._peakTime.get(peak_type);
        // Has the specified peak expired?
        const expired = (delta > this._peak_expiration);

        return expired;
    }
    /* eslint-enable camelcase */

    /* eslint-disable camelcase */
    /**
     * @description Update the time that the specified peak was updated
     * @param {PEAK_TYPES} peak_type - Type of the peak being querried
     * @returns {void}
     * @throws {TypeError} - Thrown if 'peak_type' is not a PEAK_TYPES value.
     * @private
     */
    UpdatePeakTime(peak_type) {
        // Validate arguments
        if ((peak_type === undefined) || (typeof(peak_type) !== 'string') ||
            (Object.values(PEAK_TYPES).indexOf(peak_type) < 0)) {
            throw new TypeError(`peak_type not a member of PEAK_TYPES. ${peak_type}`);
        }

        // Update the reference time for the specified peak.
        this._peakTime.set(peak_type, Date.now());
    }
    /* eslint-enable camelcase */

    /* eslint-disable camelcase */
    /**
     * @description Determines if the specified peak has expired
     * @param {ALERT_BITMASK} alert_mask - Bitmask of the alerts being checked
     * @returns {boolean} - true if all of the alerts specified in 'alert_mask' is/are active
     * @throws {TypeError} - Thrown if 'alert_mask' is not a ALERT_BITMASK value
     * @private
     */
    IsAlertActive(alert_mask) {
        // Validate arguments
        if ((alert_mask === undefined) || (typeof(alert_mask) !== 'number') ||
            (Object.values(ALERT_BITMASK).indexOf(alert_mask) < 0)) {
            throw new TypeError(`alert_mask not a member of ALERT_BITMASK. ${alert_mask}`);
        }

        // Determine is the alert(s) is(are) active.
        const active = ((alert_mask & this._alertMask) === alert_mask);

        return active;
    }
    /* eslint-enable camelcase */

    /**
     * @description Start/Restart the network performance process
     * @returns {void}
     * @private
     */
    Start() {
        // Stop the interrogation in case it is running.
        // eslint-disable-next-line new-cap
        this.Stop();

        // Reset the internal data
        this._reset();

        // Perform a check now.
        this._on_initiateCheck();
    }

    /**
     * @description Stop the network performance process, if running.
     * @returns {void}
     * @private
     */
    Stop() {
        if (this._timeoutID !== INVALID_TIMEOUT_ID) {
            clearTimeout(this._timeoutID);
        }
    }

    /**
     * @description Helper to reset the raw data buffers and the peak data
     * @returns {void}
     * @private
     */
    _reset() {
        // Flush the data buffers.
        for (const dataBufferKey of this._dataBuffers.keys()) {
            do {/* nothing */} while (typeof(this._dataBuffers.get(dataBufferKey).shift()) !== 'undefined');
        }
        // Reset the peaks
        for (const peakKey of this._peakTime.keys()) {
            this._peakTime.set(peakKey, Date.now());
        }
    }

    /**
     * @description Helper function used to initiate a performance check of the network target. Called periodically by a timeout timer.
     * @returns {void}
     * @private
     */
    _on_initiateCheck() {
        // Default to a 1ms delay for the next notification.
        // If a ping is not in progress, the desired delay will be used instead.
        let delay = 1.0;

        if (!this._pingInProgress &&
            (this.TargetDestination.length > 0)) {
            // Mark that the check is in progress.
            this._pingInProgress = true;

            // Spawn a 'ping' to determine the performance of the network target
            const ping = new _SpawnHelper();
            ping.on(_SPAWN_HELPER_EVENTS.EVENT_COMPLETE, this._CB__ping);
            // eslint-disable-next-line new-cap
            ping.Spawn({command: 'ping', arguments: [`-c${this.PingCount}`, `-i${this.PingInterval}`, `-s${this.PacketSize}`, this.TargetDestination]});

            // Update the delay
            delay = this.PingPeriod * CONVERT_SEC_TO_MS;
        }

        // Queue another check
        this._timeoutID = setTimeout(this._CB__initiateCheck, delay);
    }

    /**
     * @description Event handler for the SpawnHelper 'complete' Notification
     * @param {object} response - Spawn response.
     * @param {boolean} response.valid - Flag indicating if the spoawned process was completed successfully.
     * @param {Buffer | string | any } response.result - Result or Error data provided by the spawned process.'
     * @param {_SpawnHelper} response.source - Reference to the SpawnHelper that provided the results.
     * @returns {void}
     * @private
     */
    _on_process_ping(response) {
        _debug(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug(response.result);

        // Default values used for publishing to listeners
        let err             = true;
        // Map for tracking which buffers to trim (from the left)
        /* eslint-disable indent */
        const removeOld = new Map([[DATA_BUFFER_TYPES.LATENCY,  true],
                                 [DATA_BUFFER_TYPES.JITTER, true],
                                 [DATA_BUFFER_TYPES.LOSS,  true]]);
        /* eslint-disable indent */

        if (response.valid &&
            (response.result !== undefined)) {
            const lines = response.result.toString().split('\n');

            // Parse the results
            // -------------------
            // Find the raw ping data and statistics
            const RAW_PING_SEQ_TAG = 'icmp_seq=';
            const rawPingTime = [];
            let rawPingLossCount = 0;
            for (let index=0; index<lines.length; index++) {
                // Search for lines that provide raw ping results.
                if (lines[index].toLowerCase().includes(RAW_PING_SEQ_TAG)) {
                    const RAW_PING_TIME_PREFIX = 'time=';
                    const RAW_PING_TIME_SUFFIX = ' ms';
                    // This is a line with a raw reading. It is assumed these come before the statistics line.
                    /* eslint-disable camelcase */
                    const raw_ping_time_start = lines[index].indexOf(RAW_PING_TIME_PREFIX);
                    if (raw_ping_time_start >= 0) {
                        const raw_ping_time = lines[index].slice((raw_ping_time_start+RAW_PING_TIME_PREFIX.length), (lines[index].length-RAW_PING_TIME_SUFFIX.length));
                        rawPingTime.push(Number.parseFloat(raw_ping_time));
                    }
                    else {
                        // The RAW_PING_TIME_PREFIX tag was not found in the raw reading. This indicates packet loss.
                        rawPingLossCount += 1;
                    }
                    /* eslint-enable camelcase */
                }
            }

            // Compute and Record the Ping results.
            const totalReadings = (rawPingLossCount + rawPingTime.length);
            err = (totalReadings <= 0);
            if (!err) {
                // Compute and Record Packet Loss.
                const loss = (rawPingLossCount / totalReadings) * 100.0;
                this._dataBuffers.get(DATA_BUFFER_TYPES.LOSS).push(loss);
                // Compute and Record Jitter
                try {
                    const jitter = this._computeJitter(rawPingTime);
                    this._dataBuffers.get(DATA_BUFFER_TYPES.JITTER).push(jitter);
                }
                catch (e) {
                    // Ignore.
                }
                // Compute and Record Latency
                try {
                    const stats = this._computeStats(rawPingTime, STANDARD_DEV_TYPE.SAMPLE);
                    this._dataBuffers.get(DATA_BUFFER_TYPES.LATENCY).push(stats.mean);
                }
                catch (e) {
                    // Ignore.
                }

                // Determine if the buffers need to be purged.
                this._dataBuffers.forEach((value, key) => {
                    if ((value.length < this._data_buffer_size)) {
                        // Mark this buffer as not needing to be removed.
                        removeOld.set(key, false);
                    }
                });
            }
        }

        // Purge old data, as needed
        this._dataBuffers.forEach((value, key) => {
            if (removeOld.get(key)) {
                // Purge the data. Ok if the buffer is already empty.
                value.shift();
            }
        });

        // Raise an event informing interested parties of the results.
        try {
            // Get the results
            const avtLatency   = this._computeAVT(DATA_BUFFER_TYPES.LATENCY);
            const avtJitter    = this._computeAVT(DATA_BUFFER_TYPES.JITTER);
            const avtLoss      = this._computeAVT(DATA_BUFFER_TYPES.LOSS);

            this.emit(NETWORK_TARGET_EVENTS.EVENT_READY, {sender: this, error: err, packet_loss: avtLoss, ping_latency_ms: avtLatency, ping_jitter: avtJitter});
        }
        catch (e) {
            _debug(`Error encountered raising 'ready' event. ${e}`);
        }

        // Clear the ping in proces
        this._pingInProgress = false;
    }

    /**
     * @description Event handler for the SpawnHelper 'complete' Notification
     * @param {object} response - Spawn response.
     * @param {boolean} response.valid - Flag indicating if the spoawned process was completed successfully.
     * @param {Buffer | string | any } response.result - Result or Error data provided by the spawned process.'
     * @param {_SpawnHelper} response.source - Reference to the SpawnHelper that provided the results.
     * @returns {void}
     * @throws {Error} - thrown for various error conditions.
     * @private
     */
    _on_find_gateway_address(response) {
        _debug(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug(response.result);

        // Regardless of the result, the target destination is no longer pending.
        this._destination_pending = false;

        if (TARGET_TYPES.GATEWAY === this._target_type) {
            if (response.valid &&
                (response.result !== undefined)) {
                const lines = response.result.toString().split('\n');

                const operatingSystem = process.platform;
                switch (operatingSystem.toLowerCase()) {
                    case SUPPORTED_GATEWAY_OPERATING_SYSTEMS.OS_DARWIN: {
                        this._target_dest = this._extractGatewayOnDarwin(lines);
                        _debug(`Gateway identified: ${this.TargetDestination}`);
                        break;
                    }

                    case SUPPORTED_GATEWAY_OPERATING_SYSTEMS.OS_LINUX: {
                        this._target_dest = this._extractGatewayOnLinux(lines);
                        _debug(`Gateway identified: ${this.TargetDestination}`);
                        break;
                    }

                    default: {
                        _debug(`Operating system '${operatingSystem} not supported.`);
                        // eslint-disable-next-line no-unreachable
                        break;
                    }
                }
            }
            else {
                _debug(`Gateway not identified: valid=${response.valid} result=${response.result}`);
            }
        }
        else {
            _debug(`Target is not a gateway: type=${this._target_type}`);
        }
    }

    /**
     * @description Helper to extract the gateway address from the route response on Darwin operating systems.
     * @param {string[]} routeResponse - Array of strings comprising the response to the route command request
     * @returns {string | undefined} - Network target address.
     * @private
     */
    _extractGatewayOnDarwin(routeResponse) {
        const GATEWAY_HEADER = 'gateway: ';

        let targetAddr = undefined;

        if (_is.array(routeResponse)) {
            for (const line of routeResponse) {
                if (line.includes(GATEWAY_HEADER)) {
                    const startIndex = line.indexOf(GATEWAY_HEADER);

                    if ((startIndex >= 0) &&
                        (line.length > (startIndex + GATEWAY_HEADER.length))) {
                        // set the destination to the gateway.
                        targetAddr = line.substring(startIndex + GATEWAY_HEADER.length);
                        break;
                    }
                }
            }
        }

        return targetAddr;
    }

    /**
     * @description Helper to extract the gateway address from the route response on Darwin operating systems.
     * @param {string[]} routeResponse - Array of strings comprising the response to the route command request
     * @returns {string | undefined} - Network target address.
     * @private
     */
    _extractGatewayOnLinux(routeResponse) {
        const DESTINATION_HEADER = 'Destination';
        const GATEWAY_HEADER = 'Gateway';
        const DEFAULT_IPV4_GATEWAY = '0.0.0.0';
        const rowHeaderIndex = 1;

        let targetAddr = undefined;

        if (_is.array(routeResponse)) {
            if (routeResponse.length > (rowHeaderIndex+1)) {
                const regNpWhSp = /\s+/;
                // Break up the header row into fields.
                const headerFields = routeResponse[rowHeaderIndex].split(regNpWhSp);
                if (_is.array(headerFields) && (headerFields.length > 2)) {
                    // Determine the columns for the Destination and Gateway fields
                    const colDestination = headerFields.findIndex((item) => {
                        return _is.equal(item, DESTINATION_HEADER);
                    });
                    const colGateway = headerFields.findIndex((item) => {
                        return _is.equal(item, GATEWAY_HEADER);
                    });

                    if ((colDestination >= 0) && (colGateway >= 0)) {
                        const routes = routeResponse.slice(rowHeaderIndex+1);

                        // Search the routes looking for the default gateway.
                        for (const route of routes) {
                            const routeFields = route.split(regNpWhSp);
                            if (_is.array(routeFields) && (routeFields.length === headerFields.length)) {
                                if (_is.equal(routeFields[colDestination], DEFAULT_IPV4_GATEWAY)) {
                                    // set the destination to the gateway.
                                    targetAddr = routeFields[colGateway];
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return targetAddr;
    }

    /**
     * @typedef {object} statistics
     * @property {number} mean - average value
     * @property {number} median - median value
     * @property {number} stddev - standard deviation
     * @private
     */
    /**
     * @description Helper to compute the statistics of the data provided
     * @param {number[]} data - Array of numbers from which to compute the statistics.
     * @param {STANDARD_DEV_TYPE=} type - Type of standard deviation to compute: Population or Sample.
     * @returns {statistics} - computed statistics
     * @throws {TypeError} - thrown if 'data' is not an array of numbers or if 'type' is not valid
     * @private
     */
    _computeStats(data, type) {
        // Validate arguments
        if ((data === undefined) || (!Array.isArray(data)) ||
            (data.length < 0)) {
            throw new TypeError(`data is not an array of numbers.`);
        }
        for (const val of data) {
            if (typeof(val) !== 'number') {
                throw new TypeError(`data contains non-numeric items.`);
            }
        }
        if ((type !== undefined) &&
            ((typeof(type) !== 'number') || (Object.values(STANDARD_DEV_TYPE).indexOf(type) < 0))) {
            throw new TypeError(`type is not an valid.`);
        }

        // Make a deep copy of the buffer
        const theData = [].concat(data);

        // Sort the data in ascending order.
        theData.sort((a, b) => a - b);

        // Perform Welford’s method to compute the mean and variance
        let mean = 0;
        let s = 0;
        let max = Number.NEGATIVE_INFINITY;
        let min = Number.POSITIVE_INFINITY;
        for (let index=0; index < theData.length; index++) {
            const val = theData[index];
            const lastMean = mean;

            mean += ((val-mean)/(index+1));
            s += ((val-mean)*(val-lastMean));

            // Update the minimum and maximum as well.
            if (val < min) {
                min = val;
            }
            if (val > max) {
                max = val;
            }
        }
        // Compute the standard deviatiation
        const offset = ((type === STANDARD_DEV_TYPE.POPULATION) ? 0 : 1);
        /* eslint-disable camelcase */
        const std_dev = (theData.length > offset) ? (Math.sqrt(s/(theData.length-offset))) : Number.NaN;

        // Determine the median
        // Note: Using Math.floor() biased us to not report false/premature issues/errors.
        const medianIndex = Math.floor(theData.length/2);
        const median = (theData.length > medianIndex) ? theData[medianIndex] : 0;

        const result = {mean: mean, stddev: std_dev, median: median, min: min, max: max, size: theData.length};
        _debug(`Stats Report:`);
        _debug(result);
        /* eslint-enablew camelcase */

        return result;
    }

    /**
     * @description Helper to compute the AVT (Antonyan Vardan Transform ) filter algotithm.
     * @param {string} buffer_type - The requested buffer type for statistics.
     * @returns {number} - the filtered value of the requested buffer.
     * @throws {TypeError} - thrown if 'buffer_type' is not a DATA_BUFFER_TYPES value.
     * @private
     */
    _computeAVT(buffer_type) {
        // Validate arguments
        if ((buffer_type === undefined) || (typeof(buffer_type) !== 'string') ||
            (Object.values(DATA_BUFFER_TYPES).indexOf(buffer_type) < 0)) {
            throw new TypeError(`buffer_type not a member of DATA_BUFFER_TYPES. ${buffer_type}`);
        }

        // Make a deep copy of the buffer
        const buffer = [].concat(this._dataBuffers.get(buffer_type));

        // Compute the statistics of the data.
        const stats = this._computeStats(buffer, STANDARD_DEV_TYPE.POPULATION);

        // Default to the median of the unfiltered stats.
        let result = stats.median;

        // Filter the data.
        if (stats.stddev !== Number.NaN) {
            // Compute the AVT bounds: median +/- stddev
            const boundMin = stats.median - stats.stddev;
            const boundMax = stats.median + stats.stddev;
            const filteredData = [];
            // Perform the AVT filter, excluding the outliers.
            for (const val of buffer) {
                if ((val >= boundMin) && (val <= boundMax)) {
                    filteredData.push(val);
                }
            }

            // Determine the filtered result.
            const filteredStats = this._computeStats(filteredData, STANDARD_DEV_TYPE.POPULATION);
            result = filteredStats.median;
        }

        return result;
    }

    /**
     * @description Helper to compute the jitter of the data provided. 'data' is assumed to contain the latency values.
     * @param {number[]} data - Array of numbers from which to compute jitter.
     * @returns {number} - computed jitter
     * @throws {TypeError} - thrown if 'data' is not an array of numbers.
     * @private
     */
    _computeJitter(data) {
        // Validate arguments
        if ((data === undefined) || (!Array.isArray(data)) ||
            (data.length <= 0)) {
            throw new TypeError(`data is not an array of numbers or there is not enough data.`);
        }
        for (const val of data) {
            if (typeof(val) !== 'number') {
                throw new TypeError(`data contains non-numeric items.`);
            }
        }

        let sum = 0;
        for (let index=1; index < data.length; index++) {
            // Sum the difference
            sum += Math.abs(data[index] - data[index-1]);
        }

        // Compute the jitter
        const jitter = ((data.length > 1) ? (sum / (data.length - 1)) : 0 );

        return jitter;
    }

    /**
     * @description Read-only accessor for the `operating system` specific arguments to the `route` command
     * @returns {string[]} - Array of strings containing the `route` arguments.
     * @private
     */
    get _routeArguments() {
        const operatingSystem = process.platform;

        let args = undefined;
        switch (operatingSystem.toLowerCase()) {
            case SUPPORTED_GATEWAY_OPERATING_SYSTEMS.OS_DARWIN: {
                args = [`get`, `default`];
                break;
            }

            case SUPPORTED_GATEWAY_OPERATING_SYSTEMS.OS_LINUX: {
                args = [`-n`];
                break;
            }

            case SUPPORTED_GATEWAY_OPERATING_SYSTEMS.OS_WINDOWS: {
                args = [`print`, `0.0.0.0`];
                break;
            }

            default: {
                _debug(`Operating system '${operatingSystem} not supported.`);
                // eslint-disable-next-line no-unreachable
                break;
            }
        }

        return args;
    }
}
