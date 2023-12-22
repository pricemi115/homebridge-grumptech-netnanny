/* eslint-disable jsdoc/valid-types */
/**
 * @description Homebridge integration for Net Nanny
 * @copyright 2021
 * @author Mike Price <dev.grumptech@gmail.com>
 * @module NetNannyModule
 * @requires debug
 * @see {@link https://github.com/debug-js/debug#readme}
 * @requires fs
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/fs.html#file-system}
 * @requires url
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/url.html}
 * @requires path
 * @see {@link https://nodejs.org/dist/latest-v16.x/docs/api/path.html}
 * @requires is-it-check
 * @see {@link https://github.com/evdama/is-it-check}
 */
/* eslint-enable jsdoc/valid-types */

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The import block below may seem like we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the import statement below MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * and used to access all exported variables and classes from HAP-NodeJS.
 */
/*
import {
    API,
    APIEvent,
    CharacteristicEventTypes,
    CharacteristicSetCallback,
    CharacteristicValue,
    DynamicPlatformPlugin,
    HAP,
    Logging,
    PlatformAccessory,
    PlatformAccessoryEvent,
    PlatformConfig,
  } from "homebridge";
*/

// Internal dependencies
/* eslint-disable indent */
import {NetworkTarget as _NetworkTarget,
        PEAK_TYPES as _TARGET_PEAK_TYPES,
        DATA_BUFFER_TYPES as _TARGET_DATA_BUFFER_TYPES,
        ALERT_BITMASK as _TARGET_ALERT_BITMASK,
        NETWORK_TARGET_EVENTS as _NETWORK_TARGET_EVENTS} from './networkTarget.mjs';
/* eslint-enable indent */
import {DataTable} from './tableData.mjs';
import {InfoTable} from './tableInfo.mjs';

// External dependencies and imports.
import _debugModule from 'debug';
import {writeFile as _writeFile, access as _access, mkdir as _mkdir, constants as _fsConstants, readdir as _readdir, stat as _stat, rm as _rm} from 'node:fs';
import {EOL as _EOL} from 'node:os';
import {join as _join} from 'node:path';
import _is from 'is-it-check';

/**
 * @private
 * @description Debugging function pointer for runtime related diagnostics.
 */
const _debug = _debugModule('homebridge');

// Internal Constants
// History:
//      v1: Initial Release
//      v2: Latency and Jitter
/**
 * @description Accessory Version
 * v1: Initial Release,
 * v2: Latency, Jitter, and Packet Loss
 * @private
 * @readonly
 */
const ACCESSORY_VERSION = 2;

/**
 * @description Package Information
 */
const _PackageInfo = {CONFIG_INFO: PLACEHOLDER_CONFIG_INFO, PLUGIN_VER: 'PLACEHOLDER_VERSION'};

/**
 * @description Enumeration of accessory types.
 * @readonly
 * @private
 * @enum {number}
 * @property {number} NETWORK_TARGET - Accessory for network targets.
 * @property {number} OTHER - Accesory for other/general purpose services.
 */
const ACCESSORY_TYPES = {
    /* eslint-disable key-spacing */
    NETWORK_TARGET : 0,
    OTHER          : 1,
    /* eslint-enable key-spacing */
};

/**
 * @description Accessory information for the General Purpoe Switch Colleciton
 * @private
 * @type {object}
 * @property {string} uuid - Unique identifier for the general purpose switch collection accessory.
 * @property {string} name - Name for the general pupose switch collection accessory.
 * @readonly
 */
const GENERAL_PURPOSE_SWITCH_COLLECTION = {
    uuid: '38E010FD-1F45-4C8D-AF2A-D777538D120C',
    name: 'NetNanny Switches',
};

/**
 * @description Service identification information
 * @readonly
 * @private
 * @enum {object}
 * @property {object} POWER - Service information for the power (control) switch for each network target.
 * @property {string} POWER.uuid - Unique identifier for the power (control) switch.
 * @property {string} POWER.name - Name of the power (control) switch.
 * @property {string} POWER.udst - User defined subtype for the power (control) switch.
 * @property {object} LATENCY - Service information for the latency sensor.
 * @property {string} LATENCY.uuid - Unique identifier for the latency sensor.
 * @property {string} LATENCY.name - Name of the latency sensor.
 * @property {string} LATENCY.udst - User defined subtype for the latency sensor.
 * @property {_TARGET_PEAK_TYPES} LATENCY.peak - Peak type for the latency sensor.
 * @property {_TARGET_DATA_BUFFER_TYPES} LATENCY.data_buffer - Buffer for the latency sensor.
 * @property {_TARGET_ALERT_BITMASK} LATENCY.alert_mask - Alert bitmask for the latency sensor.
 * @property {object} JITTER - Service information for the jitter sensor.
 * @property {string} JITTER.uuid - Unique identifier for the jitter sensor.
 * @property {string} JITTER.name - Name of the jitter sensor.
 * @property {string} JITTER.udst - User defined subtype for the jitter sensor.
 * @property {_TARGET_PEAK_TYPES} JITTER.peak - Peak type for the jitter sensor.
 * @property {_TARGET_DATA_BUFFER_TYPES} JITTER.data_buffer - Buffer for the jitter sensor.
 * @property {_TARGET_ALERT_BITMASK} JITTER.alert_mask - Alert bitmask for the jitter sensor.
 * @property {object} LOSS - Service information for the packet loss sensor.
 * @property {string} LOSS.uuid - Unique identifier for the packet loss sensor.
 * @property {string} LOSS.name - Name of the packet loss sensor.
 * @property {string} LOSS.udst - User defined subtype for the packet loss sensor.
 * @property {_TARGET_PEAK_TYPES} LOSS.peak - Peak type for the packet loss sensor.
 * @property {_TARGET_DATA_BUFFER_TYPES} LOSS.data_buffer - Buffer for the packet loss sensor.
 * @property {_TARGET_ALERT_BITMASK} LOSS.alert_mask - Alert bitmask for the packet loss sensor.
 * @property {object} EXPORT - Service information for the export switch.
 * @property {string} EXPORT.uuid - Unique identifier for the export switch.
 * @property {string} EXPORT.name - Name of the export switch.
 * @property {string} EXPORT.udst - User defined subtype for the export switch.
 */
const SERVICE_INFO = {
    /* eslint-disable key-spacing, max-len */
    POWER   : {uuid:`B3D9583F-2050-43B6-A179-9D453B494220`, name:`Ping Control`,    udst:`PingControl`},
    LATENCY : {uuid:`9B838A70-8F81-4B76-BED5-3729F8F34F33`, name:`Latency`,         udst:`PingLatency`, peak:_TARGET_PEAK_TYPES.LATENCY,    data_buffer:_TARGET_DATA_BUFFER_TYPES.LATENCY,  alert_mask: _TARGET_ALERT_BITMASK.LATENCY},
    JITTER  : {uuid:`67434B8C-F3CC-44EA-BBE9-15B4E7A2CEBF`, name:`Jitter`,          udst:`PingJitter`,  peak:_TARGET_PEAK_TYPES.JITTER,     data_buffer:_TARGET_DATA_BUFFER_TYPES.JITTER,   alert_mask: _TARGET_ALERT_BITMASK.JITTER},
    LOSS    : {uuid:`9093B0DE-078A-4B19-8081-2998B26A9017`, name:`Packet Loss`,     udst:`PacketLoss`,  peak:_TARGET_PEAK_TYPES.LOSS,       data_buffer:_TARGET_DATA_BUFFER_TYPES.LOSS,     alert_mask: _TARGET_ALERT_BITMASK.LOSS},
    EXPORT  : {uuid:`E570C0EB-7B9E-4808-8AE1-FA882061057A`, name:`Export History`,  udst:`ExportHistory`},
    /* eslint-enable key-spacing, max-len */
};

/**
 * @description Default time for exporting the database to a CSV file (once per day).
 * @private
 * @readonly
 */
const DEFAULT_DB_EXPORT_TIME_MS = 86400000/* milliseconds */;

/**
 * @description Maximum number of records in the history tables.
 * @private
 * @readonly
 */
const DEFAULT_MAX_HISTORY_RECORDS = 250000;

/**
 * @description Default period, in milliseconds, for retaining log files.
 * @private
 * @readonly
 */
const DEFAULT_RETENTION_PERIOD_MS = (30.0 * 24.0 * 60.0 * 60.0 * 1000.0);
/**
 * @description Initial value for the cached last export time.
 * @private
 * @readonly
 */
const INVALID_LAST_EXPORT_TIME = -1;

/**
 * @description Flag value for an invalid timeout
 * @private
 * @readonly
 */
const INVALID_TIMEOUT_ID = -1;

/**
 * @description Homebridge API Version
 * @private
 */
let _HomebridgeAPIVersion;

/**
 * @description Homebridge Server Version
 * @private
 */
let _HomebridgeServerVersion;

/**
 * @description Platform accessory reference
 * @private
 */
let _PlatformAccessory  = undefined;
/**
 * @description Reference to the NodeJS Homekit Applicaiton Platform.
 * @private
 */
let _hap                = undefined;

/**
 * @description Root path for custom storage.
 * @private
 */
let _pathStorageRoot = '';

/**
 * @description Homebridge platform for managing the Net Nanny
 * @private
 */
class NetworkPerformanceMonitorPlatform {
    /**
     * @description Constructor
     * @param {object} log - Regerence to the log for logging in the Homebridge Context
     * @param {object} config - Reference to the platform configuration (from config.json)
     * @param {object} api - Reference to the Homebridge API
     * @throws {TypeError} - thrown if the configuration is invalid.
     * @private
     */
    constructor(log, config, api) {
        /* Cache the arguments. */
        this._log     = log;
        this._config  = config;
        this._api     = api;

        // Cached last export.
        this._lastExportTime = INVALID_LAST_EXPORT_TIME;

        // Flag indicating if an export is in progress.
        this._exportInProgres = false;

        /* My local data */
        this._name = this._config['name'];

        let theSettings = undefined;
        if (Object.prototype.hasOwnProperty.call(this._config, 'settings')) {
            // Get the system configuration,
            theSettings = this._config.settings;
        }

        // Reference to the "Refresh" accessory switch.
        this._switchRefresh = undefined;

        /* Bind Handlers */
        this._bindDoInitialization          = this._doInitialization.bind(this);
        this._bindPingReady                 = this._processPingReady.bind(this);
        this._bindDestructorNormal          = this._destructor.bind(this, {cleanup: true});
        this._bindDestructorAbnormal        = this._destructor.bind(this, {exit: true});
        this._bindExportDatabase            = this._on_export_database.bind(this);
        this._bindResetHistory              = this._handleResetDatabase.bind(this);

        /* Log our creation */
        this._log(`Creating NetworkPerformanceMonitorPlatform`);

        /* Create an empty map for our accessories */
        this._accessories = new Map();
        /* Create an empty map for our network performance targets. */
        this._networkPerformanceTargets = new Map();

        /* History Logging */
        this._enableHistoryLogging = true;
        this._historyLoggingPeriod = DEFAULT_DB_EXPORT_TIME_MS;
        this._maximumHistorySize   = DEFAULT_MAX_HISTORY_RECORDS;
        this._retentionThreshold   = DEFAULT_RETENTION_PERIOD_MS;

        // Check for Settings
        if (theSettings != undefined) {
            /* Get the History Logging settings */
            /* Get history logging enabled */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'enable_history_logging')) && (typeof(theSettings.enable_history_logging) === 'boolean')) {
                this._enableHistoryLogging = theSettings.enable_history_logging;
            }
            /* Get the history logging settings  */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'history_logging')) && (typeof(theSettings.history_logging) === 'object')) {
                /* Get the history reporting period */
                if ((Object.prototype.hasOwnProperty.call(theSettings.history_logging, 'reporting_period')) && (typeof(theSettings.history_logging.reporting_period) === 'number')) {
                    // The value from the settings is in days. Convert to milliseconds.
                    this._historyLoggingPeriod = (theSettings.history_logging.reporting_period * (24.0 * 3600000));
                }
                /* Get the maximum history reporting size */
                if ((Object.prototype.hasOwnProperty.call(theSettings.history_logging, 'maximum_history_size')) && (typeof(theSettings.history_logging.maximum_history_size) === 'number')) {
                    this._maximumHistorySize = theSettings.history_logging.maximum_history_size;
                }
                /* Get the retention period (in days) */
                if ((Object.prototype.hasOwnProperty.call(theSettings.history_logging, 'retention_period')) && (typeof(theSettings.history_logging.retention_period) === 'number')) {
                    this._retentionThreshold = theSettings.history_logging.retention_period * (24.0 * 60.0 * 60.0 * 1000.0);
                }
            }

            const commonTargetConfig = {};
            /* Get the ping count */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'ping_count')) && (typeof(theSettings.ping_count) === 'number')) {
                commonTargetConfig.ping_count = theSettings.ping_count;
            }
            /* Get the packet size */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'packet_size')) && (typeof(theSettings.packet_size) === 'number')) {
                commonTargetConfig.packet_size = theSettings.packet_size;
            }
            /* Get the ping period */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'ping_period')) && (typeof(theSettings.ping_period) === 'number')) {
                commonTargetConfig.ping_period = theSettings.ping_period;
            }
            /* Get the ping interval */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'ping_interval')) && (typeof(theSettings.ping_interval) === 'number')) {
                commonTargetConfig.ping_interval = theSettings.ping_interval;
            }

            /* Ping Target Specific configuration settings */
            if ((Object.prototype.hasOwnProperty.call(theSettings, 'ping_targets')) && (Array.isArray(theSettings.ping_targets))) {
                for (const itemConfig of  theSettings.ping_targets) {
                    // Start with the common configs.
                    const targetConfig = commonTargetConfig;

                    if (typeof(itemConfig) === 'object') {
                        /* Get the Target Type */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'target_type')) && (typeof(itemConfig.target_type) === 'string')) {
                            targetConfig.target_type = itemConfig.target_type;
                        }
                        /* Get the Modem Type */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'modem_type')) && (typeof(itemConfig.modem_type) === 'string')) {
                            targetConfig.modem_type = itemConfig.modem_type;
                        }
                        /* Get the Target Destination */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'target_dest')) && (typeof(itemConfig.target_dest) === 'string')) {
                            targetConfig.target_dest = itemConfig.target_dest;
                        }
                        /* Get the nominal ping latency */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'expected_latency')) && (typeof(itemConfig.expected_latency) === 'number')) {
                            targetConfig.expected_latency = itemConfig.expected_latency;
                        }
                        /* Get the nominal ping stamdard deviation */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'expected_jitter')) && (typeof(itemConfig.expected_jitter) === 'number')) {
                            targetConfig.expected_jitter = itemConfig.expected_jitter;
                        }
                        /* Get the packet loss limit */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'loss_limit')) && (typeof(itemConfig.loss_limit) === 'number')) {
                            targetConfig.loss_limit = itemConfig.loss_limit;
                        }
                        /* Get the peak reset time (hr) */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'peak_expiration')) && (typeof(itemConfig.peak_expiration) === 'number')) {
                            targetConfig.peak_expiration = itemConfig.peak_expiration;
                        }
                        /* Get the data filter time window (sec) */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'data_filter_time_window')) && (typeof(itemConfig.data_filter_time_window) === 'number')) {
                            targetConfig.data_filter_time_window = itemConfig.data_filter_time_window;
                        }
                        /* Get the sensor alert mask */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'sensor_alert_mask')) && (typeof(itemConfig.sensor_alert_mask) === 'number')) {
                            targetConfig.alert_mask = itemConfig.sensor_alert_mask;
                        }

                        /* Create the network target. */
                        const networkTarget = new _NetworkTarget(targetConfig);
                        this._networkPerformanceTargets.set(networkTarget.ID, networkTarget);
                    }
                }
            }
        }

        // Create an in-memory SQLite database for tracking performance history.
        this._infoTable = undefined;
        this._historyData = undefined;
        if (this._enableHistoryLogging) {
            /* eslint-disable indent */
            /* eslint-disable new-cap */
            this._infoTable = new InfoTable({plugin_version: _PackageInfo.PLUGIN_VER,
                                             homebridge_api_version: _HomebridgeAPIVersion, homebridge_server_version: _HomebridgeServerVersion,
                                             hap_library_version: _hap.HAPLibraryVersion(),
                                             accessory_version: ACCESSORY_VERSION});
            /* eslint-enable new-cap */
            /* eslint-enable indent */
            this._historyData = new Map();
        }

        // Timer for exporting the database.
        this._timeoutIDExportDB = INVALID_TIMEOUT_ID;

        // Register for the Did Finish Launching event
        this._api.on('didFinishLaunching', this._bindDoInitialization);
        this._api.on('shutdown', this._bindDestructorNormal);

        // Register for shutdown events.
        // do something when app is closing
        process.on('exit', this._bindDestructorNormal);
        // catches uncaught exceptions
        process.on('uncaughtException', this._bindDestructorAbnormal);
    }

    /**
     * @description Destructor
     * @param {object} options - Typically containing a "cleanup" or "exit" member.
     * @param {object} err - The source of the event trigger.
     * @returns {void}
     * @async
     * @private
     */
    async _destructor(options, err) {
        console.log(`Shutdown`);
        // Is there an indication that the system is either exiting or needs to
        // be cleaned up?
        if ((options.exit) || (options.cleanup)) {
            // Cleanup the network performance objects.
            clearTimeout(this._timeoutIDExportDB);
        }

        // Lastly eliminate myself.
        delete this;
    }

    /**
     * @description Event handler when the system has loaded the platform.
     * @returns {void}
     * @throws {TypeError} - thrown if the 'polling_interval' configuration item is not a number.
     * @throws {RangeError} - thrown if the 'polling_interval' configuration item is outside the allowed bounds.
     * @async
     * @private
     */
    async _doInitialization() {
        // Some network performance targets may still we waiting to complete initialization
        // (i.e. Gateways). Ensure that all npt's are not pending. If any are, then defer initialization.
        let defer = false;
        for (const target of this._networkPerformanceTargets.values()) {
            if (target.IsTargetDestinationPending) {
                // Give a bit
                this._log(`Target ${target.ID} is pending. Defer initialization..`);
                defer = true;
                // No need to continue looking.
                break;
            }
        }

        if (defer) {
            // Try again later.
            setTimeout(this._doInitialization.bind(this), 100);
        }
        else {
            this._log(`Homebridge Plug-In ${_PackageInfo.CONFIG_INFO.plugin} has finished launching.`);

            // Flush any accessories that are not from this version, are runtime-only accessories, or are orphans (no corresponding network performance target).
            const accessoriesToRemove = [];
            for (const accessory of this._accessories.values()) {
                if (!Object.prototype.hasOwnProperty.call(accessory.context, 'VERSION') ||
                    (accessory.context.VERSION !== ACCESSORY_VERSION)) {
                    this._log(`Accessory ${accessory.displayName} has accessory version ${accessory.context.VERSION}. Version ${ACCESSORY_VERSION} is expected.`);
                    // This accessory needs to be replaced.
                    accessoriesToRemove.push(accessory);
                }
                else if (!this._networkPerformanceTargets.has(accessory.context.ID)) {
                    // Check for orphaned network target accessory.
                    if (!Object.prototype.hasOwnProperty.call(accessory.context, 'TYPE') ||
                        (accessory.context.TYPE == ACCESSORY_TYPES.NETWORK_TARGET)) {
                        // Orphan Network Target accessory
                        this._log(`Accessory ${accessory.displayName} is an orphan and should be purged.`);
                        // This accessory needs to be removed.
                        accessoriesToRemove.push(accessory);
                    }
                }
            }
            // Perform the cleanup.
            accessoriesToRemove.forEach((accessory) => {
                this._removeAccessory(accessory);
            });

            // Start the network performance targets
            for (const target of this._networkPerformanceTargets.values()) {
                // Is this network performance target new?
                if (!this._accessories.has(target.ID)) {
                    // There is no matching accessory for this network performance target.
                    // Create and register an accessory.
                    this._addNetworkPerformanceAccessory(target.ID);
                }

                // Register for the 'ready' event.
                target.on(_NETWORK_TARGET_EVENTS.EVENT_READY, this._bindPingReady);

                // Get the accessory to see if it is active or not.
                const accessory = this._accessories.get(target.ID);

                // Add this network target to the g history map, if logging is enabled.
                if (_is.not.undefined(this._historyData)) {
                    if (!this._historyData.has(target.ID)) {
                        this._historyData.set(target.ID, []);
                    }
                }

                // Is the accessory active?
                if (this._getAccessorySwitchState(accessory)) {
                    // Start the Network Performance Target.
                    // eslint-disable-next-line new-cap
                    target.Start();
                }
            }

            // Manage general purpose accessories and services.
            this._manageGeneralPurposeAccessories();

            // Manage History Logging specific items
            if (this._enableHistoryLogging) {
                // Start the timer for the periodic incremental database export.
                this._timeoutIDExportDB = setTimeout(this._bindExportDatabase, this._historyLoggingPeriod, false);
            }
        }
    }

    /**
     * @description Event handler for the Ping Ready event
     * @param {object} results - Ping 'read' event results.
     * @param {_NetworkTarget} results.sender         - Reference to the sender of the event.
     * @param {boolean}        results.error          - Flag indicating is there is an error with the ping.
     * @param {number}         results.packet_loss    - Packet Loss (percent)
     * @param {number}         results.ping_latency_ms- Ping Latency in milliseconds.
     * @param {number}         results.ping_sjitter   - Ping Jitter in milliseconds.
     * @returns {void}
     * @throws {TypeError} - thrown if the 'results' is not an object having the expected values.
     * @throws {Error} - thrown if there is no accessory with a matching id as the sender.
     * @private
     */
    _processPingReady(results) {
        if ((results === undefined) || (typeof(results) !== 'object')                               ||
            (!Object.prototype.hasOwnProperty.call(results, 'sender')) || !(results.sender instanceof _NetworkTarget)      ||
            (!Object.prototype.hasOwnProperty.call(results, 'error')) || (typeof(results.error) !== 'boolean')             ||
            (!Object.prototype.hasOwnProperty.call(results, 'packet_loss')) || (typeof(results.packet_loss) !== 'number')  ||
            (!Object.prototype.hasOwnProperty.call(results, 'ping_latency_ms')) || (typeof(results.ping_latency_ms) !== 'number')||
            (!Object.prototype.hasOwnProperty.call(results, 'ping_jitter')) || (typeof(results.ping_jitter) !== 'number')      ) {
            const errText = (results === undefined) ? 'undefined' : results.toString();
            throw new TypeError(`Ping 'ready' results are invalid: ${errText}`);
        }

        this._log.debug(`Ping results: Target:${results.sender.TargetDestination} Error:${results.error} Loss:${results.packet_loss} Latency:${results.ping_latency_ms} Jitter:${results.ping_jitter}`);

        // Update the accessory with the data provided.
        // Get the id for the accessory
        const id = results.sender.ID;
        // Validate that an accessory exists for this id.
        if (this._accessories.has(id)) {
            const accessory = this._accessories.get(id);
            if (_is.not.undefined(accessory)) {
                // Get the buffer filled flags.
                /* eslint-disable new-cap */
                const latencyBufferFilled   = results.sender.IsBufferFilled(SERVICE_INFO.LATENCY.data_buffer);
                const jitterBufferFilled     = results.sender.IsBufferFilled(SERVICE_INFO.JITTER.data_buffer);
                const lossBufferFilled      = results.sender.IsBufferFilled(SERVICE_INFO.LOSS.data_buffer);
                /* eslint-enable new-cap */

                // Compute the fault statuses
                const threshold     = (3.0*results.sender.ExpectedJitter);
                const latencyFault  = (results.error || (latencyBufferFilled && (results.ping_latency_ms > (results.sender.ExpectedJitter + threshold))));
                const jitterFault   = (results.error || (jitterBufferFilled && (results.ping_jitter > results.sender.ExpectedJitter)));
                const lossFault     = (results.error || (lossBufferFilled && (results.packet_loss > results.sender.TolerableLoss)));

                // Determine if the peaks have expired.
                /* eslint-disable new-cap */
                const resetPeakLatency  = results.sender.IsPeakExpired(SERVICE_INFO.LATENCY.peak);
                const resetPeakJitter   = results.sender.IsPeakExpired(SERVICE_INFO.JITTER.peak);
                const resetPeakLoss     = results.sender.IsPeakExpired(SERVICE_INFO.LOSS.peak);
                /* eslint-enable new-cap */


                // Update the values.
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LATENCY, {level: results.ping_latency_ms, fault: latencyFault, resetPeak: resetPeakLatency, active: true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.JITTER,  {level: results.ping_jitter,     fault: jitterFault,  resetPeak: resetPeakJitter,  active: true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LOSS,    {level: results.packet_loss,     fault: lossFault,    resetPeak: resetPeakLoss,    active: true});

                // Log the data
                if (_is.not.undefined(this._historyData)) {
                    // Get the timestap for this record.
                    const timestamp = Date.now();

                    // Compute the fault code bitmask. Uses the same bitmask as the sensor alerts.
                    const faultCode = ((latencyFault ? _TARGET_ALERT_BITMASK.LATENCY : _TARGET_ALERT_BITMASK.NONE) |
                                       (jitterFault  ? _TARGET_ALERT_BITMASK.JITTER  : _TARGET_ALERT_BITMASK.NONE) |
                                       (lossFault    ? _TARGET_ALERT_BITMASK.LOSS    : _TARGET_ALERT_BITMASK.NONE));

                    // Handle a possible rollover of the date.
                    if (timestamp < this._lastExportTime) {
                        this._lastExportTime = timestamp[Symbol.toPrimitive]('number');
                    }

                    if (this._historyData.has(id)) {
                        // Record the data.
                        const entry = new DataTable({error: faultCode, latency: results.ping_latency_ms, jitter: results.ping_jitter, packet_loss: results.packet_loss});
 
                        // Save the data
                        const data = this._historyData.get(id);
                        if (_is.array(data)) {
                            data.push(entry);
                        }
                    }
                    else {
                        this._log.debug(`Target ${id} is not registered.`);
                    }
                }
            }
        }
        else {
            this._log.debug(`No accessory for sender ID: ${id}`);
            throw new Error(`No accessory for sender ID: ${id}`);
        }
    }

    /**
     * @description Homebridge API invoked after restoring cached accessorues from disk.
     * @param {_PlatformAccessory} accessory - Accessory to be configured.
     * @returns {void}
     * @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
     * @private
     */
    configureAccessory(accessory) {
        // Validate the argument(s)
        if ((accessory === undefined) ||
            (!(accessory instanceof _PlatformAccessory))) {
            throw new TypeError(`accessory must be a PlatformAccessory`);
        }

        // Is this accessory already registered?
        let found = false;
        for (const acc of this._accessories.values()) {
            if (acc === accessory) {
                found = true;
                break;
            }
        }
        if (!found) {
            // Configure the accessory (also registers it.)
            try {
                this._configureAccessory(accessory);
            }
            catch (error) {
                this._log(`Unable to configure accessory ${accessory.displayName}. Version:${accessory.context.VERSION}. Error:${error}`);
                // We don't know where the exception happened. Ensure that the accessory is in the map.
                const id = accessory.context.ID;
                if (!this._accessories.has(id)) {
                    // Update our accessory listing
                    this._accessories.set(id, accessory);
                }
            }
        }
    }

    /**
     * @description Create and register an accessory for the network performance target.
     * @param {string} id identifier for the accessory.
     * @returns {void}
     * @throws {TypeError} - thrown when 'id' is not a string.
     * @throws {RangeError} - thrown when 'id' length is 0
     * @throws {Error} - thrown when an accessory with 'id' is already registered.
     * @throws {Error} - thrown when there is no matching network performance target.
     * @private
     */
    _addNetworkPerformanceAccessory(id) {
        // Validate arguments
        if ((id === undefined) || (typeof(id) !== 'string')) {
            throw new TypeError(`id must be a string`);
        }
        if (id.length <= 0) {
            throw new RangeError(`id must be a non-zero length string.`);
        }
        if (this._accessories.has(id)) {
            throw new Error(`Accessory '${id}' is already registered.`);
        }
        if (!this._networkPerformanceTargets.has(id)) {
            throw new Error(`No Network Performance Target with id '${id}`);
        }

        // Get the network performance target with this 'id'.
        const target = this._networkPerformanceTargets.get(id);

        this._log.debug(`Adding new accessory: id:'${id}' target:${target.TargetDestination}`);

        // Create the platform accesory
        // uuid must be generated from a unique but not changing data source, 'id' should not be used in the most cases. But works in this specific example.
        const uuid = _hap.uuid.generate(id);
        const accessory = new _PlatformAccessory(target.TargetDestination, uuid);

        // Add the identifier to the accessory's context. Used for remapping on depersistence.
        accessory.context.ID = id;
        // Mark the version of the accessory. This is used for depersistence
        accessory.context.VERSION = ACCESSORY_VERSION;
        // Set the type of accessory.
        accessory.context.TYPE = ACCESSORY_TYPES.NETWORK_TARGET;
        // Create accessory persisted settings
        accessory.context.SETTINGS = {SwitchState: true};

        // Create our services.
        accessory.addService(_hap.Service.Switch,               SERVICE_INFO.POWER.uuid,   SERVICE_INFO.POWER.udst);
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.LATENCY.uuid, SERVICE_INFO.LATENCY.udst);
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.JITTER.uuid,  SERVICE_INFO.JITTER.udst);
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.LOSS.uuid,    SERVICE_INFO.LOSS.udst);

        try {
            // Configure the accessory
            this._configureAccessory(accessory);
        }
        catch (error) {
            this._log.debug(`Error when configuring accessory.`);
            this._log.debug(error);
        }

        this._api.registerPlatformAccessories(_PackageInfo.CONFIG_INFO.plugin, _PackageInfo.CONFIG_INFO.platform, [accessory]);
    }

    /**
     * @description Create and register an accessory for the general purpose switch collection
     * @returns {void}
     * @throws {Error} - thrown when an accessory with 'name' is already registered.
     * @private
     */
    _addGeneralPurposeSwitchCollectionAccessory() {
        if (this._accessories.has(GENERAL_PURPOSE_SWITCH_COLLECTION.uuid)) {
            throw new Error(`Accessory '${GENERAL_PURPOSE_SWITCH_COLLECTION.uuid}' is already registered.`);
        }

        this._log.debug(`Adding new accessory for a colleciton of general purpose switches: id:'${GENERAL_PURPOSE_SWITCH_COLLECTION.uuid}'`);

        // Create the platform accesory
        const accessory = new _PlatformAccessory(GENERAL_PURPOSE_SWITCH_COLLECTION.name, GENERAL_PURPOSE_SWITCH_COLLECTION.uuid);

        // Add the identifier to the accessory's context. Used for remapping on depersistence.
        accessory.context.ID = GENERAL_PURPOSE_SWITCH_COLLECTION.uuid;
        // Mark the version of the accessory. This is used for depersistence
        accessory.context.VERSION = ACCESSORY_VERSION;
        // Set the type of accessory.
        accessory.context.TYPE = ACCESSORY_TYPES.OTHER;
        // Create accessory persisted settings. Default the switch state to off.
        accessory.context.SETTINGS = {SwitchState: false};

        // Create our services.
        accessory.addService(_hap.Service.Switch, SERVICE_INFO.EXPORT.uuid, SERVICE_INFO.EXPORT.udst);

        try {
            // Configure the accessory
            this._configureAccessory(accessory);
        }
        catch (error) {
            this._log.debug(`Error when configuring the general purpose switch collection accessory.`);
            this._log.debug(error);
        }

        this._api.registerPlatformAccessories(_PackageInfo.CONFIG_INFO.plugin, _PackageInfo.CONFIG_INFO.platform, [accessory]);
    }

    /**
     * @description Helper for managing the general purpose accessories and services.
     * @returns {void}
     * @private
     */
    _manageGeneralPurposeAccessories() {
        // Check for the general purpose switch collection.
        if (!this._accessories.has(GENERAL_PURPOSE_SWITCH_COLLECTION.uuid)) {
            // There is no matching accessory for this.
            // Create and register an accessory.
            this._addGeneralPurposeSwitchCollectionAccessory();
        }
    }

    /**
     * @description Performs accessory configuration and internal 'registration' (appending to our list).
     *              Opportunity to setup event handlers for characteristics and update values (as needed).
     * @param {_PlatformAccessory} accessory - Accessory to be configured/registered
     * @returns {void}
     * @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
     * @private
     */
    _configureAccessory(accessory) {
        if ((accessory === undefined) ||
            (!(accessory instanceof _PlatformAccessory))) {
            throw new TypeError(`accessory must be a PlatformAccessory`);
        }

        this._log.debug('Configuring accessory %s', accessory.displayName);

        // Get the accessory identifier from the context.
        const id = accessory.context.ID;

        // Determine if this is a Network Target accessory or not.
        const isNetworkTarget = (!Object.prototype.hasOwnProperty.call(accessory.context, 'TYPE') ||
                                 (accessory.context.TYPE === ACCESSORY_TYPES.NETWORK_TARGET));

        // Register to handle the Identify request for the accessory.
        accessory.on(_PlatformAccessory.PlatformAccessoryEvent.IDENTIFY, () => {
            this._log('%s identified!', accessory.displayName);
        });

        // Does this accessory have a Switch service?
        let switchState = true;
        const serviceSwitch = accessory.getService(_hap.Service.Switch);
        if ((serviceSwitch !== undefined) &&
            (serviceSwitch instanceof _hap.Service.Switch)) {
            // Set the switch to the stored setting (the default is on).
            const theSettings = accessory.context.SETTINGS;
            if ((theSettings !== undefined) &&
                (typeof(theSettings) === 'object') &&
                (Object.prototype.hasOwnProperty.call(theSettings, 'SwitchState') &&
                (typeof(theSettings.SwitchState) === 'boolean'))) {
                // Modify the settings
                switchState = theSettings.SwitchState;
            }
            serviceSwitch.updateCharacteristic(_hap.Characteristic.On, switchState);

            // Also, if this is a Network Target, update the name, so it is recognizable in the Home app.
            if (isNetworkTarget) {
                serviceSwitch.updateCharacteristic(_hap.Characteristic.Name, `Power (${accessory.displayName})`);
            }
            else if (id === GENERAL_PURPOSE_SWITCH_COLLECTION.uuid) {
                serviceSwitch.updateCharacteristic(_hap.Characteristic.Name, `Export`);
            }

            // Get the 'On' characteristic for the switch.
            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            // Register for the "get" event notification.
            charOn.on('get', this._handleOnGet.bind(this, id));
            // Register for the "set" event notification.
            if (GENERAL_PURPOSE_SWITCH_COLLECTION.uuid == id) {
                // Event handler for exporting and resetting the databae.
                charOn.on('set', this._handleResetDatabase.bind(this, id));
            }
            else {
                // Event handler for network target 'power' (enable) state changes.
                charOn.on('set', this._handleOnSet.bind(this, id));
            }
        }

        // Network Target specific.
        if (isNetworkTarget) {
            // Update the names of each service.
            const infoItems = [SERVICE_INFO.LATENCY, SERVICE_INFO.JITTER, SERVICE_INFO.LOSS];
            for (const item of infoItems) {
                const service = accessory.getServiceById(item.uuid, item.udst);
                if (service !== undefined) {
                    service.updateCharacteristic(_hap.Characteristic.Name, `${item.name}-(${accessory.displayName})`);
                }
            }

            // Initialize the Carbon Dioxide Sensors
            this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.LATENCY, {level: 0.0, fault: false, resetPeak: true, active: switchState});
            this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.JITTER,  {level: 0.0, fault: false, resetPeak: true, active: switchState});
            this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.LOSS,    {level: 0.0, fault: false, resetPeak: true, active: switchState});
        }

        // Update the accessory information
        this._updateAccessoryInfo(accessory, {model: 'GrumpTech Network Performance', serialnum: id});

        // Is this accessory new to us?
        if (!this._accessories.has(id)) {
            // Update our accessory listing
            this._log.debug(`Adding accessory '${accessory.displayName} to the accessories list. Count:${this._accessories.size}`);
            this._accessories.set(id, accessory);
        }
    }

    /**
     * @description Internal function to perform accessory configuration for Carbon Dioxide Sensor services.
     * @param {_PlatformAccessory} accessory - Accessory to be configured.
     * @param {object} serviceInfo - Name information of the service to be configured.
     * @param {string} serviceInfo.uuid   - UUID of the service
     * @param {string} serviceInfo.name   - Name of the service.
     * @param {string} serviceInfo.udst   - User Defined Sub-Type of the service.
     * @param {string} serviceInfo.peak   - Name of the 'peak'. Used to update the target when the peak is updated.
     * @param {string} serviceInfo.alert  - Name of the 'alert'. Used to update the target when a fault is set or cleared.
     * @param {object} values             - Object containing the values being set.
     * @param {number  | Error} values.level       - Value to be reported as the CO Level
     * @param {boolean | Error} values.fault       - true if a fault exists.
     * @param {boolean | Error} values.active      - specifies the low battery status
     * @param {boolean | Error} values.resetPeak   - true if the peak level should be reset.
     * @returns {void}
     * @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
     * @throws {TypeError} - thrown if 'serviceInfo' does not conform to a serviceInfo item.
     * @throws {TypeError} - thrown if 'values' is not an object or does not contain the expected fields.
     * @throws {Error} - thrown if the service for the serviceName is not a Carbon Dioxide Sensor.
     * @private
     */
    _updateCarbonDioxideSensorService(accessory, serviceInfo, values) {
        if ((accessory === undefined) ||
            (!(accessory instanceof _PlatformAccessory))) {
            throw new TypeError(`accessory must be a PlatformAccessory`);
        }
        if ((serviceInfo === undefined) ||
            (typeof(serviceInfo) != 'object') ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'uuid')         || (typeof(serviceInfo.uuid)         !== 'string') || (serviceInfo.uuid.length <= 0)        ) ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'name')         || (typeof(serviceInfo.name)         !== 'string') || (serviceInfo.name.length <= 0)        ) ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'udst')         || (typeof(serviceInfo.udst)         !== 'string') || (serviceInfo.udst.length <= 0)        ) ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'peak')         || (typeof(serviceInfo.peak)         !== 'string') || (serviceInfo.peak.length <= 0)        ) ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'data_buffer')  || (typeof(serviceInfo.data_buffer)  !== 'string') || (serviceInfo.data_buffer.length <= 0) ) ||
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'alert_mask')   || (typeof(serviceInfo.alert_mask)   !== 'number')                                          )   ) {
            throw new TypeError(`serviceName does not conform to a SERVICE_INFO item.`);
        }
        if ((values === undefined) || (typeof(values) !== 'object') ||
            (!Object.prototype.hasOwnProperty.call(values, 'level'))     || ((typeof(values.level) !== 'number')       || (values.level instanceof Error)) ||
            (!Object.prototype.hasOwnProperty.call(values, 'fault'))     || ((typeof(values.fault) !== 'boolean')      || (values.fault instanceof Error)) ||
            (!Object.prototype.hasOwnProperty.call(values, 'active'))    || ((typeof(values.active) !== 'boolean')     || (values.active instanceof Error)) ||
            (!Object.prototype.hasOwnProperty.call(values, 'resetPeak')) || ((typeof(values.resetPeak) !== 'boolean')  || (values.resetPeak instanceof Error)) ) {
            throw new TypeError(`values must be an object with properties named 'level' (number or Error) and 'fault' (boolean or Error) and 'resetPeak' (boolean or Error)`);
        }

        // Attempt to get the named service and validate that it is a Carbon Dioxie Sensor
        const serviceCO2Ping = accessory.getServiceById(serviceInfo.uuid, serviceInfo.udst);
        if ((serviceCO2Ping !== undefined) &&
            (serviceCO2Ping instanceof _hap.Service.CarbonDioxideSensor)) {
            try {
                // Get the network performance target for this accessory
                const target = this._networkPerformanceTargets.get(accessory.context.ID);

                // Determine the fault code and CO2 Level
                /* eslint-disable max-len */
                const faultCode = (values.fault ? _hap.Characteristic.StatusFault.GENERAL_FAULT                 : _hap.Characteristic.StatusFault.NO_FAULT);
                // eslint-disable-next-line new-cap
                const co2Level  = ((target.IsAlertActive(serviceInfo.alert_mask) && values.fault) ? _hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL : _hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
                /* eslint-enable max-len */
                // Determine the low battery status based on being active or not.
                const batteryStatus = (values.active ? _hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : _hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxideDetected, co2Level);
                if (values.level >= 0.0) {
                    serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxideLevel, values.level);
                }
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.StatusFault, faultCode);
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.StatusLowBattery, batteryStatus);
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.StatusActive, values.active);

                // Get the current peak.
                const currentPeak = serviceCO2Ping.getCharacteristic(_hap.Characteristic.CarbonDioxidePeakLevel).value;
                // Set the Peak Values if necessary,
                if ((values.resetPeak) ||
                    (values.level > currentPeak)) {
                    serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxidePeakLevel, values.level);
                    // Update the peak time reference.
                    if (target !== undefined) {
                        // eslint-disable-next-line new-cap
                        target.UpdatePeakTime(serviceInfo.peak);
                    }
                }
            }
            catch (err) {
                this._log.debug(`Error setting characteristics for ${accessory.displayName}. Error: ${err}`);
            }
        }
        else {
            this._log.debug(`No service: Accessory ${accessory.displayName}`);
            throw new Error(`Accessory ${accessory.displayName} does not have a valid ${serviceInfo.uuid}:${serviceInfo.udst} service`);
        }
    }

    /**
     * @description Remove/destroy an accessory
     * @param {_PlatformAccessory} accessory - accessory to be removed.
     * @returns {void}
     * @throws {TypeError} - Thrown when 'accessory' is not an instance of _PlatformAccessory.
     * @throws {RangeError} - Thrown when a 'accessory' is not registered.
     * @private
     */
    _removeAccessory(accessory) {
        // Validate arguments
        if ((accessory === undefined) || !(accessory instanceof _PlatformAccessory)) {
            throw new TypeError(`Accessory must be a PlatformAccessory`);
        }
        if (!this._accessories.has(accessory.context.ID)) {
            throw new RangeError(`Accessory '${accessory.displayName}' is not registered.`);
        }

        this._log.debug(`Removing accessory '${accessory.displayName}'`);

        // Get the identification of the accessory.
        const id = accessory.context.ID;

        // Event Handler cleanup.
        accessory.removeAllListeners(_PlatformAccessory.PlatformAccessoryEvent.IDENTIFY);
        // Does this accessory have a Switch service?
        const serviceSwitch = accessory.getService(_hap.Service.Switch);
        if (serviceSwitch !== undefined) {
            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            // Unregister for the "get" event notification.
            charOn.off('get', this._handleOnGet.bind(this, id));
            // Unregister for the "get" event notification.
            if (GENERAL_PURPOSE_SWITCH_COLLECTION.uuid == id) {
                // Event handler for exporting and resetting the databae.
                charOn.off('set', this._handleResetDatabase.bind(this, id));
            }
            else {
                // Event handler for network target 'power' (enable) state changes.
                charOn.off('set', this._handleOnSet.bind(this, id));
            }
        }

        /* Unregister the accessory */
        this._api.unregisterPlatformAccessories(_PackageInfo.CONFIG_INFO.plugin, _PackageInfo.CONFIG_INFO.platform, [accessory]);
        /* remove the accessory from our mapping */
        this._accessories.delete(id);
    }

    /**
     * @description Update common information for an accessory
     * @param {_PlatformAccessory} accessory - accessory to be updated.
     * @param {object} info - accessory information.
     * @param {string | Error} info.model - accessory model number
     * @param {string | Error} info.serialnum - accessory serial number.
     * @returns {void}
     * @throws {TypeError} - Thrown when 'accessory' is not an instance of _PlatformAccessory.
     * @throws {TypeError} - Thrown when 'info' is not undefined, does not have the 'model' or
     *                       'serialnum' properties or the properties are not of the expected type.
     * @private
     */
    _updateAccessoryInfo(accessory, info) {
        // Validate arguments
        if ((accessory === undefined) || !(accessory instanceof _PlatformAccessory)) {
            throw new TypeError(`Accessory must be a PlatformAccessory`);
        }
        if ((info === undefined) ||
            (!Object.prototype.hasOwnProperty.call(info, 'model'))     || ((typeof(info.model)      !== 'string') || (info.model instanceof Error)) ||
            (!Object.prototype.hasOwnProperty.call(info, 'serialnum')) || ((typeof(info.serialnum)  !== 'string') || (info.serialnum instanceof Error))   ) {
            throw new TypeError(`info must be an object with properties named 'model' and 'serialnum' that are eother strings or Error`);
        }

        /* Get the accessory info service. */
        const accessoryInfoService = accessory.getService(_hap.Service.AccessoryInformation);
        if (accessoryInfoService != undefined) {
            /* Manufacturer */
            accessoryInfoService.updateCharacteristic(_hap.Characteristic.Manufacturer, `GrumpTech`);

            /* Model */
            accessoryInfoService.updateCharacteristic(_hap.Characteristic.Model, info.model);

            /* Serial Number */
            accessoryInfoService.updateCharacteristic(_hap.Characteristic.SerialNumber, info.serialnum);

            /* Software Version */
            accessoryInfoService.updateCharacteristic(_hap.Characteristic.SoftwareRevision, `v${accessory.context.VERSION}`);
        }
    }

    /**
     * @description Event handler for the "get" event for the Switch.On characteristic.
     * @param {string} id - id of the accessory switch service being querried.
     * @param {Function} callback - Function callback for homebridge.
     * @returns {void}
     * @throws {TypeError} - thrown when 'id' is not a non-zero string.
     * @throws {Error} - Thrown when there is no accessory keyed with 'id'
     * @private
     */
    _handleOnGet(id, callback) {
        // Validate arguments
        if ((id === undefined) ||
            (typeof(id) !== 'string') || (id.length <= 0)) {
            throw new TypeError(`id must be a non-zero length string.`);
        }

        let status = null;
        let result = new Error('not handled');
        if (this._accessories.has(id)) {
            // Get the accessory for this id.
            const accessory = this._accessories.get(id);

            // Get the accessory for this id.
            this._log.debug(`Ping Power '${accessory.displayName}' Get Request.`);

            try {
                result = this._getAccessorySwitchState(accessory);
            }
            catch (err) {
                this._log.debug(`  Unexpected error encountered: ${err.message}`);
                result = false;
                status = new Error(`Accessory ${accessory.displayName} is not ressponding.`);
            }
        }
        else {
            throw new Error(`id:${id} has no matching accessory`);
        }

        // Invoke the callback function with our result.
        callback(status, result);
    }

    /**
     * @description Event handler for the "set" event for the Switch.On characteristic.
     * @param {string} id - id of the accessory switch service being set.
     * @param {boolean} value - new/requested state of the switch
     * @param {Function} callback - Function callback for homebridge.
     * @returns {void}
     * @throws {TypeError} - thrown when 'id' is not a non-zero string.
     * @throws {Error} - Thrown when there is no accessory keyed with 'id'
     * @private
     */
    _handleOnSet(id, value, callback) {
        // Validate arguments
        if ((id === undefined) ||
            (typeof(id) !== 'string') || (id.length <= 0)) {
            throw new TypeError(`id must be a non-zero length string.`);
        }

        let status = null;
        if (this._accessories.has(id)) {
            const accessory = this._accessories.get(id);
            this._log.debug(`Ping Power '${accessory.displayName}' Set Request. New state:${value}`);

            // Determine if this event is from a network target accessory.
            const isNetworkTarget = this._networkPerformanceTargets.has(id);

            // Store the state of the switch so that when the plugin is restarted, we will restore the
            // switch state as it was last set. But only do this for Network Targets.
            if (isNetworkTarget) {
                const theSettings = accessory.context.SETTINGS;
                if ((theSettings !== undefined) &&
                    (typeof(theSettings) === 'object') &&
                    (Object.prototype.hasOwnProperty.call(theSettings, 'SwitchState')) &&
                    (typeof(theSettings.SwitchState) === 'boolean')) {
                    // Modify the settings
                    theSettings.SwitchState = value;
                }
                // Store the updated settings.
                accessory.context.SETTINGS = theSettings;
            }

            try {
                // Is there a matching network performance target for this 'id'?
                if (isNetworkTarget) {
                    const target = this._networkPerformanceTargets.get(id);
                    if (target !== undefined) {
                        // Update/reinitialize the accessory data (including the peak, as needed)
                        const theLevel = (value ? 0.0 : -1.0);
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LATENCY, {level: theLevel, fault: false, resetPeak: value, active: value});
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.JITTER,  {level: theLevel, fault: false, resetPeak: value, active: value});
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LOSS,    {level: theLevel, fault: false, resetPeak: value, active: value});

                        /* eslint-disable new-cap */
                        if (value) {
                            // Turn the Ping Power On !!
                            target.Start();
                        }
                        else {
                            // Note: Even after turning the ping power off, there may be one more result coming in.
                            target.Stop();
                        }
                        /* eslint-enable new-cap */
                    }
                }
                else {
                    throw new Error(`id:${id} has no matching network performance target nor any other accessories.`);
                }
            }
            catch (err) {
                this._log.debug(`  Unexpected error encountered: ${err.message}`);

                status = new Error(`Accessory ${accessory.displayName} is not ressponding.`);
            }
        }
        else {
            throw new Error(`id:${id} has no matching accessory`);
        }

        callback(status);
    }

    /**
     * @description Event handler for the "set" event for the Switch.On characteristic of the database reset.
     * @param {string} id - unique identifier for the accessory
     * @param {boolean} value - new/rewuested state of the switch
     * @param {Function} callback - Function callback for homebridge.
     * @returns {void}
     * @private
     */
    _handleResetDatabase(id, value, callback) {
        this._log.debug(`Reset Database New state:${value}`);

        if (GENERAL_PURPOSE_SWITCH_COLLECTION.uuid == id) {
            // Get the accessory.
            const accessory = this._accessories.get(GENERAL_PURPOSE_SWITCH_COLLECTION.uuid);

            // Get the current state of the switch.
            const serviceSwitch = accessory.getService(_hap.Service.Switch);
            const currentValue = this._getAccessorySwitchState(accessory);

            if (this._enableHistoryLogging) {
                if (_is.boolean(value)) {
                    // Ensure that an export is not currently in progress.
                    if (!this._exportInProgres) {
                        if (value && !currentValue) {
                            // Stop the existing export timer.
                            clearTimeout(this._timeoutIDExportDB);

                            // Reset the cashed last export time so that all exting gata will be exported.
                            this._lastExportTime = INVALID_LAST_EXPORT_TIME;

                            // Immediately queue an export.
                            this._timeoutIDExportDB = setImmediate(this._bindExportDatabase, true);

                            // Decouple setting the switch back off.
                            setTimeout((theService) => {
                                if (!_is.null(theService)) {
                                    this._log.debug(`Switch '${theService.displayName}' forcing off`);
                                    theService.updateCharacteristic(_hap.Characteristic.On, false);
                                }
                            }, 500, serviceSwitch);
                        }
                    }
                    else {
                        if (value) {
                            // Export is in progress. Defer the request to reset the history.
                            this._log.debug(`Export in progres. Ignoring the request to reset the database.`);

                            // Decouple setting the switch back off.
                            setTimeout((theService) => {
                                if (!_is.null(theService)) {
                                    this._log.debug(`Switch '${theService.displayName}' forcing off`);
                                    theService.updateCharacteristic(_hap.Characteristic.On, false);
                                }
                            }, 500, serviceSwitch);
                        }
                    }

                    callback(null);
                }
                else {
                    callback(new TypeError(`value is invalid.`));
                }
            }
            else {
                // Logging not active. Force switch off if present
                if ((value)) {
                    // Decouple setting the switch back off.
                    setTimeout((theService) => {
                        if (!_is.null(theService)) {
                            this._log.debug(`Switch '${theService.displayName}' forcing off`);
                            theService.updateCharacteristic(_hap.Characteristic.On, false);
                        }
                    }, 500, serviceSwitch);
                }
                callback(null);
            }
        }
        else {
            // Unexpected call.
            callback(new RangeError(`id is invalid.`));
        }
    }

    /**
     * @description Get the value of the Service.Switch.On characteristic value
     * @param {object} accessory - accessory being querried.
     * @returns {boolean} the value of the On characteristic (true or false)
     * @throws {TypeError} - TThrown when 'accessory' is not an instance of _PlatformAccessory.
     * @throws {Error}  - Thrown when the On characteristic cannot be found on the accessory.
     * @private
     */
    _getAccessorySwitchState(accessory) {
        // Validate arguments
        if ((accessory === undefined) || !(accessory instanceof _PlatformAccessory)) {
            throw new TypeError(`Accessory must be a PlatformAccessory`);
        }

        let result = false;
        const serviceSwitch = accessory.getService(_hap.Service.Switch);
        if (serviceSwitch !== undefined) {
            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            if (charOn !== undefined) {
                result = charOn.value;
            }
            else {
                throw new Error(`The Switch service of accessory ${accessory.displayName} does not have an On charactristic.`);
            }
        }
        else {
            throw new Error(`Accessory ${accessory.displayName} does not have a Switch service.`);
        }

        return result;
    }

    /**
     * @description Helper to maintaiin a reasonable amount of data in the history tables.
     * @param {number} recordLimit - Maximum number of rows for the data tables.
     * @returns {void}
     * @private
     */
    _trimHistoryTables(recordLimit) {
        if (_is.integer(recordLimit) && _is.gt(recordLimit, 0) &&
            _is.not.undefined(this._historyData)) {
            // Iterate through all the items in the map.
            this._historyData.foreach((data, key, map) => {
                // Get the number of rows in the 'data' table.
                const rows = data.length;
                if (rows > recordLimit) {
                    // Compute the number of rows to be trimmed and add a 2% buffer.
                    const trimSize =  Math.ceil((rows - recordLimit) * 1.02);

                    // Trim the data.
                    const trimmedData = data.toSpliced(0, trimSize);

                    // Replace the data
                    map.push(key, trimmedData);
                }
            });
        }
    }

    /**
     * @description Event handler for the timer indicating that a dataexport is needed.
     * @param {boolean} flushHistory - Flag indicating that the history data should be reset.
     * @returns {void}
     * @throws {TypeError} - thrown if 'resetDB' is not a boolean.
     * @private
     */
    async _on_export_database(flushHistory) {
        const FILENAME_BASE = `History_`;
        const FILENAME_EXT  = `.csv`;

        if (_is.not.boolean(flushHistory)) {
            throw new TypeError(`'flushHistory' must be a boolean.`);
        }

        // Get list of existing files.
        _readdir(_pathStorageRoot, (err, files) => {
            if (_is.null(err)) {
                if (_is.array(files)) {
                    files.forEach((file) => {
                        // Ensure that the file is a log entry.
                        if (_is.string(file) &&
                            _is.startWith(file, FILENAME_BASE) &&
                            _is.endWith(file, FILENAME_EXT)) {
                            // Construct the full path
                            const fullPath = _join(_pathStorageRoot, file);

                            // Determine the stats of the file. (To get the age.)
                            _stat(fullPath, (err, status) => {
                                if (_is.null(err)) {
                                    // Get the file age.
                                    const age = Date.now() - status.mtimeMs;

                                    // Delete the file if too old.
                                    if (age > this._retentionThreshold) {
                                        // Remove the file.
                                        this._log.debug(`Removing file: ${file}`);
                                        _rm(fullPath, (err) => {
                                            if (_is.not.null(err)) {
                                                this._log.debug(`Error removing file: ${file}`);
                                                this._log.debug(err);
                                            }
                                        });
                                    }
                                }
                                else {
                                    this._log.debug(`Error encountered (status):`);
                                    this._log.debug(err);
                                }
                            });
                        }
                    });
                }
            }
            else {
                this._log.debug(`Error encountered (readdir):`);
                this._log.debug(err);
            }
        });

        if (_is.not.undefined(this._historyData)) {
            // Get the current timestamp
            const timestamp = new Date(Date.now());

            this._exportInProgres = true;

            // Build the path for the log file.
            const fileName = _join(_pathStorageRoot, `${FILENAME_BASE}${timestamp.getTime()}${FILENAME_EXT}`);

            this._log.debug(`Exporting database: ${fileName}`);
            let historyContent = '';

            // Append 'info' header
            historyContent += `timestamp:,${timestamp.toDateString()} @ ${timestamp.toTimeString()}${_EOL}`;
            historyContent += `plugin version:,${this._infoTable.PlugInVersion}${_EOL}`;
            historyContent += `homebridge api version:,${this._infoTable.HomebridgeAPIVersion}${_EOL}`;
            historyContent += `homebridge server version:,${this._infoTable.HomebridgeServerVersion}${_EOL}`;
            historyContent += `hap library version:,${this._infoTable.HAPLibraryVersion}${_EOL}`;
            historyContent += `node.js version:,${process.versions.node}${_EOL}`;
            historyContent += `accessory version:,${this._infoTable.AccessoryVersion}${_EOL}`;
            historyContent += _EOL;

            // Build a flat array of all the entries.
            const history = [];
            this._historyData.forEach((data, key) => {
                if (this._networkPerformanceTargets.has(key)) {
                    if (_is.not.undefined(data)) {
                        data.forEach((entry) => {
                            if (entry.Date > this._lastExportTime) {
                                const target = this._networkPerformanceTargets.get(key);
                                /* eslint-disable indent */
                                history.push({date: entry.Date,
                                            // eslint-disable-next-line indent
                                            name: target.TargetDestination, type: target.TargetType,
                                            latency: entry.Latency, jitter: entry.Jitter, loss: entry.PacketLoss, fault: entry.Error});
                                /* eslint-enable indent */
                            }
                        });
                    }
                    else {
                        this._log.debug(`Export - No Data: ${key}`);
                    }
                }
                else {
                    this._log.debug(`Export - Unknown target: ${key}`);
                }
            });
            // Sort based on time.
            history.sort((a, b) => {
                return (a.date - b.date);
            });

            if (history.length > 0) {
                // Append the 'history' header
                historyContent += `date,raw time (ms),name,type,latency (ms),jitter (ms),loss,fault code (bitmask)${_EOL}`;

                // Export the data.
                history.forEach((entry) => {
                    // Append the data
                    // eslint-disable-next-line max-len
                    const date = new Date(entry.date);
                    historyContent += `${date.toDateString()} @ ${date.toTimeString()},${entry.date},${entry.name},${entry.type},${entry.latency},${entry.jitter},${entry.loss},${entry.fault}${_EOL}`;
                });

                // Write the file.
                _writeFile(fileName, historyContent, (err) => {
                    if (!_is.null(err)) {
                        this._log.debug(`Error exporting history:`);
                        this._log.debug(err);
                    }
                });

                // Update the timestamp of the most recent record exported.
                this._lastExportTime = history[history.length - 1].date;

                // If requested, flush the history from the database.
                if (flushHistory) {
                    this._historyData.forEach((data) => {
                        // Reset
                        data.splice(0, data.length);
                    });
                }
            }
            // The export is complete.
            this._exportInProgres = false;

            // Restart the timer for an incremental export.
            this._timeoutIDExportDB = setTimeout(this._bindExportDatabase, this._historyLoggingPeriod, false);
        }
    }
}

/**
 * @description Exported default function for Homebridge integration.
 * @param {object} homebridgeAPI - reference to the Homebridge API.
 * @returns {void}
 */
export default (homebridgeAPI) => {
    // Cache the homebridge API and Server versions
    _HomebridgeAPIVersion = homebridgeAPI.version;
    _HomebridgeServerVersion = homebridgeAPI.serverVersion;
    _debug(`homebridge API version: v${_HomebridgeAPIVersion}`);
    _debug(`homebridge Server version: v${_HomebridgeServerVersion}`);

    // Compute and cache the storage path.
    _pathStorageRoot = _join(homebridgeAPI.user.customStoragePath, _PackageInfo.CONFIG_INFO.platform);
    // Check access to the storage location.
    _access(_pathStorageRoot, _fsConstants.F_OK, (err) => {
        // Create the storage folder if it does not exist.
        if (!_is.null(err)) {
            _mkdir(_pathStorageRoot, (err) => {
                if (!_is.null(err)) {
                    _debug(`Unable to create plugin storage folder.`);
                    _debug(err);
                }
            });
        }
    });

    // Accessory must be created from PlatformAccessory Constructor
    _PlatformAccessory  = homebridgeAPI.platformAccessory;
    if (!Object.prototype.hasOwnProperty.call(_PlatformAccessory, 'PlatformAccessoryEvent')) {
        // Append the PlatformAccessoryEvent.IDENTITY enum to the platform accessory reference.
        // This allows us to not need to import anything from 'homebridge'.
        const platformAccessoryEvent = {
            IDENTIFY: 'identify',
        };

        _PlatformAccessory.PlatformAccessoryEvent = platformAccessoryEvent;
    }

    // Cache the reference to hap-nodejs
    _hap = homebridgeAPI.hap;

    // Register the paltform.
    _debug(`Registering platform: ${_PackageInfo.CONFIG_INFO.platform}`);
    homebridgeAPI.registerPlatform(_PackageInfo.CONFIG_INFO.platform, NetworkPerformanceMonitorPlatform);
};
