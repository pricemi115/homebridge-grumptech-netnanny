/* ==========================================================================
   File:               networkTarget.js
   Class:              Network Target
   Description:	       Monitors network performance for a target based on
                       ping results.
   Copyright:          Mar 2021
   ========================================================================== */
'use strict';

// External dependencies and imports.
const _debug    = require('debug')('network_target');
import EventEmitter from 'events';
import * as modCrypto from 'crypto';

// Internal dependencies.
import { SpawnHelper } from './spawnHelper.js';

// Bind debug to console.log
_debug.log = console.log.bind(console);

// Helpful constants and conversion factors.
const DEFAULT_PERIOD_SEC            = 10.0;
const DEFAULT_PING_COUNT            = 5;
const MIN_PING_COUNT                = 3; // Need at least 3 to compute a standard deviation
const DEFAULT_PING_INTERVAL         = 1;
const MIN_PING_INTERVAL             = 1;
const MIN_PERIOD_SEC                = (2.0*MIN_PING_INTERVAL*MIN_PING_COUNT);
const MIN_PACKET_SIZE               = 56;
const DEFAULT_PACKET_SIZE           = MIN_PACKET_SIZE;
const CONVERT_SEC_TO_MS             = 1000.0;
const INVALID_TIMEOUT_ID            = -1;
const MIN_LOSS_LIMIT                = 0.0;
const MAX_LOSS_LIMIT                = 100.0;
const DEFAULT_PEAK_EXPIRATION_MS    = 43200000; // 12-hours converted to milliseconds.

/* Enumeration for target types */
export const TARGET_TYPES = {
    URI         : 'uri',
    IPV4        : 'ipv4',
    IPV6        : 'ipv6',
    GATEWAY     : 'gateway',
    CABLE_MODEM : 'cable_modem'
};

/* Enumeration for peak types */
export const PEAK_TYPES = {
    TIME       : 'peak_time',
    STDEV      : 'peak_stddev',
    LOSS       : 'peak_packet_loss'
};

/* ==========================================================================
   Class:              NetworkTarget
   Description:	       Monitors network performance via ping.
   Copyright:          Mar 2021

   @event 'ready' => function({object})
   @event_param {<NetworkTarget>} [sender]      - Reference to the sender of the event.
   @event_param {bool}            [error]       - Flag indicating is there is an error with the ping.
   @event_param {number}          [packet_loss] - Packet Loss (percent)
   @event_param {number}          [ping_time_ms]- Ping Time (average) in milliseconds.
   @event_param {number}          [ping_stdev]  - Standard Deviation of the ping times.

   Event emmitted when the (periodic) ping completes
   ========================================================================== */
export class NetworkTarget extends EventEmitter {
/*  ========================================================================
    Description:    Constructor

    @param {object} [config]                  - The settings to use for creating the object.
    @param {string} [config.id]               - *Optional* Identification for this object
    @param {string} [config.target_type]      - *Optional* The type of target.
    @param {string} [config.target_dest]      - *Optional* The destination of target.
    @param {number} [config.loss_lmit]        - *Optional* The percentage of lost packets that is tolerable.
    @param {number} [config.packet_size]      - *Optional* The size, in bytes, of the ping packet.
    @param {number} [config.ping_count]       - *Optional* The number of pings to perform.
    @param {number} [config.expected_nominal] - *Optional* The time (in seconds) for the expected ping time.
    @param {number} [config.expected_stdev]   - *Optional* The standard deviation of the ping times.

    @return {object}  - Instance of the NetworkTarget class.

    @throws {TypeError}  - thrown if the configuration is undefined or any parameters are
                           not of the expected type.
    @throws {RangeError} - thrown if the configuration parameters are out of bounds.
    ======================================================================== */
    constructor(config) {

        // Set local defaults
        let pingCount       = DEFAULT_PING_COUNT;
        let pingPeriod      = DEFAULT_PERIOD_SEC;
        let pingInterval    = DEFAULT_PING_INTERVAL;
        let targetType      = TARGET_TYPES.IPV4;
        let targetDest      = "localhost";
        let expectedNominal = 0.05;
        let expectedStDev   = 0.005;
        let packetSize      = DEFAULT_PACKET_SIZE;
        let lossLimit       = 0.0;
        let peakExpirationTime = DEFAULT_PEAK_EXPIRATION_MS;
        // Check for expected types
        if (config !== undefined) {
            if (                                            (typeof(config) !== 'object')                   ||
                ((config.target_type !== undefined)      && (typeof(config.target_type) !== 'string'))      ||
                ((config.target_dest !== undefined)      && (typeof(config.target_dest) !== 'string'))      ||
                ((config.loss_limit !== undefined)       && (typeof(config.loss_limit) !== 'number'))       ||
                ((config.packet_size !== undefined)      && (typeof(config.packet_size) !== 'number'))      ||
                ((config.ping_period !== undefined)      && (typeof(config.ping_period) !== 'number'))      ||
                ((config.ping_interval !== undefined)    && (typeof(config.ping_count) !== 'number'))       ||
                ((config.ping_count !== undefined)       && (typeof(config.ping_count) !== 'number'))       ||
                ((config.peak_expiration !== undefined)  && (typeof(config.peak_expiration) !== 'number'))  ||
                ((config.expected_nominal !== undefined) && (typeof(config.expected_nominal) !== 'number')) ||
                ((config.expected_stdev !== undefined)   && (typeof(config.expected_stdev) !== 'number'))     ) {

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
            if (config.expected_nominal) {
                if (config.expected_nominal > 0) {
                    expectedNominal = config.expected_nominal;
                }
                else {
                    throw new RangeError(`config.expected_nominal is invalid: ${config.expected_nominal}`);
                }
            }
            if (config.expected_stdev) {
                if (config.expected_stdev > 0) {
                    expectedStDev = config.expected_stdev;
                }
                else {
                    throw new RangeError(`config.expected_stdev is invalid: ${config.expected_stdev}`);
                }
            }
        }

        // Initialize the base class.
        super();

        // Set internal members.
        this._target_type       = targetType;
        this._target_dest       = targetDest;
        this._ping_count        = pingCount;
        this._loss_limit        = lossLimit;
        this._ping_packet_size  = packetSize;
        this._ping_interval     = pingInterval;
        this._ping_period       = pingPeriod;
        this._peak_expiration   = peakExpirationTime;
        this._expected_nominal  = expectedNominal;
        this._expected_stdev    = expectedStDev;
        this._timeoutID         = INVALID_TIMEOUT_ID;
        this._pingInProgress    = false;

        // Create a map of Date objects for trasking when the peaks
        // were last set.
        const now = Date.now();
        this._peakTime = new Map([[PEAK_TYPES.TIME,  now],
                                  [PEAK_TYPES.STDEV, now],
                                  [PEAK_TYPES.LOSS,  now]]);

        // Callbacks bound to this object.
        this._CB__initiateCheck     = this._on_initiateCheck.bind(this);
        this._CB__ping              = this._on_process_ping.bind(this);
        this._CB__findGatewayAddr   = this._on_find_gateway_address.bind(this);

        // Special handling of target types.
        if (TARGET_TYPES.CABLE_MODEM === this._target_type) {
            // Set the type to IPV4 and the destination to the common
            // address ued for cable modems.
            this._target_type = TARGET_TYPES.IPV4;
            this._target_dest = '192.168.100.1';
        }
        else if (TARGET_TYPES.GATEWAY === this._target_type) {
            this._target_dest = '';
            // Spawn a request to determine the address of the router.
            const ping = new SpawnHelper();
            ping.on('complete', this._CB__findGatewayAddr);
            ping.Spawn({ command:'route', arguments:[`get`, `default`] });
        }

        // Create an identifier based on the target type & destination.
        const hash = modCrypto.createHash('sha256');
        hash.update(this._target_type);
        hash.update(this._target_dest);
        this._id = hash.digest('hex');
    }

/*  ========================================================================
    Description: Read Property accessor for the identification

    @return {number} - Identiy string
    ======================================================================== */
    get ID() {
        return this._id;
    }

/*  ========================================================================
    Description: Read Property accessor for the number of ping requests per set.

    @return {number} - Number of pings
    ======================================================================== */
    get PingCount() {
        return this._ping_count;
    }

/*  ========================================================================
    Description: Read Property accessor for the limit (in percent) for packet loss

    @return {number} - Packet loss percent that is tolerated.
    ======================================================================== */
    get TolerableLoss() {
        return this._loss_limit;
    }

/*  ========================================================================
    Description: Read Property accessor for the size (in bytes) of each ping.

    @return {number} - Number of bytes in each ping.
    ======================================================================== */
    get PacketSize() {
        return this._ping_packet_size;
    }

/*  ========================================================================
    Description: Read Property accessor for the ping interval

    @return {number} - Time in seconds between ping requests.
    ======================================================================== */
    get PingInterval() {
        return this._ping_interval;
    }

/*  ========================================================================
    Description: Read Property accessor for the ping period

    @return {number} - Time in seconds between ping requests.
    ======================================================================== */
    get PingPeriod() {
        return this._ping_period;
    }

/*  ========================================================================
    Description: Read Property accessor for the target destination

    @return {string} - destination for the ping.
    ======================================================================== */
    get TargetDestination() {
        return this._target_dest;
    }

/*  ========================================================================
    Description: Read Property accessor for the expected ping time

    @return {number} - time, in milliseconds, expected for the ping operation.
    ======================================================================== */
    get ExpectedNominal() {
        return this._expected_nominal;
    }

/*  ========================================================================
    Description: Read Property accessor for the expected standard deviation of
                 the ping time

    @return {number} - expected standard deviation of the ping (in milliseconds)
    ======================================================================== */
    get ExpectedStdDev() {
        return this._expected_stdev;
    }

/*  ========================================================================
    Description: Determines if the specified peak has expired.

    @param {enum:PEAK_TYPES} [peak_type] - Type of the peak being querried

    @return {boolean} - true if the peak has not been updated in more than
                        the allowable time.

    @throws {TypeError} - Thrown if 'peak_type' is not a PEAK_TYPES value.
    ======================================================================== */
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

/*  ========================================================================
    Description: Update the time that the specified peak was updated.

    @param {enum:PEAK_TYPES} [peak_type] - Type of the peak being querried.

    @throws {TypeError} - Thrown if 'peak_type' is not a PEAK_TYPES value.
    ======================================================================== */
    UpdatePeakTime(peak_type) {
        // Validate arguments
        if ((peak_type === undefined) || (typeof(peak_type) !== 'string') ||
            (Object.values(PEAK_TYPES).indexOf(peak_type) < 0)) {
            throw new TypeError(`peak_type not a member of PEAK_TYPES. ${peak_type}`);
        }

        // Update the reference time for the specified peak.
        this._peakTime.set(peak_type, Date.now());
    }

/*  ========================================================================
    Description: Start/Restart the network performance process.
    ======================================================================== */
    Start() {

        // Stop the interrogation in case it is running.
        this.Stop();

        // Perform a check now.
        this._on_initiateCheck();
    }

/*  ========================================================================
    Description: Stop the network performance process, if running.
    ======================================================================== */
    Stop() {
        if (this._timeoutID !== INVALID_TIMEOUT_ID) {
            clearTimeout(this._timeoutID);
        }
    }

/*  ========================================================================
    Description: Helper function used to initiate a performance check of the
                 network target.

    @remarks: Called periodically by a timeout timer.
    ======================================================================== */
    _on_initiateCheck() {

        // Default to a 1ms delay for the next notification.
        // If a ping is not in progress, the desired delay will be used instead.
        let delay = 1.0;

        if (!this._pingInProgress &&
            (this.TargetDestination.length > 0)) {
            // Mark that the check is in progress.
            this._pingInProgress = true;

            // Spawn a 'ping' to determine the performance of the network target
            const ping = new SpawnHelper();
            ping.on('complete', this._CB__ping);
            ping.Spawn({ command:'ping', arguments:[`-c${this.PingCount}`, `-i${this.PingInterval}`, `-s${this.PacketSize}`, '-q', this.TargetDestination] });

            // Update the delay
            delay = this.PingPeriod * CONVERT_SEC_TO_MS;
        }

        // Queue another check
        this._timeoutID = setTimeout(this._CB__initiateCheck, delay);
    }

/*  ========================================================================
    Description:    Event handler for the SpawnHelper 'complete' Notification

    @param { object }                      [response]        - Spawn response.
    @param { bool }                        [response.valid]  - Flag indicating if the spoawned process
                                                               was completed successfully.
    @param { <Buffer> | <string> | <any> } [response.result] - Result or Error data provided  by
                                                               the spawned process.
    @param { SpawnHelper }                 [response.source] - Reference to the SpawnHelper that provided the results.

    ======================================================================== */
    _on_process_ping(response) {
        _debug(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug(response.result);

        // Default values used for publishing to listeners
        let packetLoss  = 100.0;
        let avgTime     = 0.0;
        let stDevTime   = 99.0;
        let err         = true;

        if (response.valid &&
            (response.result !== undefined)) {
            const lines = response.result.toString().split('\n');

            // Parse the results
            // -------------------
            // Find the statistics
            const STATS_TAG = 'ping statistics';
            for (let index=0; index<lines.length; index++) {
                if (lines[index].toLowerCase().includes(STATS_TAG)) {
                    // We assume that the next line has the packet loss stats.
                    if ((index + 1) < lines.length) {
                        const packet_stats = lines[index+1].split(',');
                        // The packet loss is in the third element
                        if (packet_stats.length >= 3) {
                            const PACKET_LOSS_TAG = '% packet loss';
                            const packet_loss_tag_locn = packet_stats[2].toLowerCase().indexOf(PACKET_LOSS_TAG);
                            if (packet_loss_tag_locn >= 0) {
                                packetLoss = Number.parseFloat(packet_stats[2].toLowerCase().slice(0, packet_loss_tag_locn));
                            }
                        }
                    }
                    // The next line contains the stats (if we got any responses)
                    if ((index + 2) < lines.length) {
                        // Get the ping stats data.
                        const PING_STATS_PREFIX = "round-trip min/avg/max/stddev = ";
                        const PING_STATS_SUFFIX  = " ms";
                        const ping_stats = lines[index+2].slice(PING_STATS_PREFIX.length, (lines[index+2].length-PING_STATS_SUFFIX.length));
                        // Break up the data
                        const ping_stat_data = ping_stats.split('/');
                        // There should be 4 elements (min/avg/max/stddev)
                        if (ping_stat_data.length === 4) {
                            avgTime = Number.parseFloat(ping_stat_data[1]);
                            stDevTime = Number.parseFloat(ping_stat_data[3]);
                        }

                        // Clear the error flag
                        err = false;
                    }
                    // no need to keep seatching.
                    break;
                }
            }
        }

        // Raise an event informing interested parties of the results.
        try {
            this.emit('ready', {sender:this, error:err, packet_loss:packetLoss, ping_time_ms:avgTime, ping_stdev:stDevTime});
        }
        catch (e) {
            console.log(`Error encountered raising 'ready' event. ${e}`);
            _debug(`Error encountered raising 'ready' event. ${e}`);
        }

        // Clear the ping in proces
        this._pingInProgress = false;
    }

/*  ========================================================================
    Description:    Event handler for the SpawnHelper 'complete' Notification

    @param { object }                      [response]        - Spawn response.
    @param { bool }                        [response.valid]  - Flag indicating if the spoawned process
                                                               was completed successfully.
    @param { <Buffer> | <string> | <any> } [response.result] - Result or Error data provided  by
                                                               the spawned process.
    @param { SpawnHelper }                 [response.source] - Reference to the SpawnHelper that provided the results.

    @throws {Error} - thrown for various error conditions.
    ======================================================================== */
    _on_find_gateway_address(response) {
        _debug(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug(response.result);

        if (TARGET_TYPES.GATEWAY === this._target_type) {
            if (response.valid &&
                (response.result !== undefined)) {
                const GATEWAY_HEADER = 'gateway: ';

                const lines = response.result.toString().split('\n');
                for (const line of lines) {
                    if (line.includes(GATEWAY_HEADER)) {
                        const startIndex = line.indexOf(GATEWAY_HEADER);
                        console.log(`Gateway Line: index:${startIndex} ${line}`);

                        if ((startIndex >= 0) &&
                            (line.length > (startIndex + GATEWAY_HEADER.length))) {
                            // set the destination to the gateway.
                            this._target_dest = line.substr(startIndex + GATEWAY_HEADER.length);
                        }
                    }
                }
            }
            else {
                throw new Error(`Spawn response is invalid`);
            }
        }
        else {
            throw new Error(`_on_find_gateway_address() called inappropriately`);
        }
    }
}