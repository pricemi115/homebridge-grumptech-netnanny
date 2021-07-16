/* ==========================================================================
   File:               main.js
   Description:	       Homebridge integration for Net Nanny
   Copyright:          Mar 2021
   ========================================================================== */
'use strict';

const _debug = require('debug')('homebridge');
// eslint-disable-next-line no-unused-vars
import { version as PLUGIN_VER }      from '../package.json';
import { config_info as CONFIG_INFO } from '../package.json';

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
import { NetworkTarget as _NetworkTarget,
         PEAK_TYPES as _TARGET_PEAK_TYPES,
         DATA_BUFFER_TYPES as _TARGET_DATA_BUFFER_TYPES,
         ALERT_BITMASK as _TARGET_ALERT_BITMASK } from './networkTarget.js';

// Configuration constants.
const PLUGIN_NAME   = CONFIG_INFO.plugin;
const PLATFORM_NAME = CONFIG_INFO.platform;

// Internal Constants
// History:
//      v1: Initial Release
//      v2: Latency and Jitter
const ACCESSORY_VERSION = 2;

const SERVICE_INFO = {
    POWER   : {uuid:`B3D9583F-2050-43B6-A179-9D453B494220`, name:`Ping Control`,    udst:`PingControl`},
    LATENCY : {uuid:`9B838A70-8F81-4B76-BED5-3729F8F34F33`, name:`Latency`,         udst:`PingLatency`, peak:_TARGET_PEAK_TYPES.LATENCY,    data_buffer:_TARGET_DATA_BUFFER_TYPES.LATENCY,  alert_mask: _TARGET_ALERT_BITMASK.LATENCY},
    JITTER  : {uuid:`67434B8C-F3CC-44EA-BBE9-15B4E7A2CEBF`, name:`Jitter`,          udst:`PingJitter`,  peak:_TARGET_PEAK_TYPES.JITTER,     data_buffer:_TARGET_DATA_BUFFER_TYPES.JITTER,   alert_mask: _TARGET_ALERT_BITMASK.JITTER},
    LOSS    : {uuid:`9093B0DE-078A-4B19-8081-2998B26A9017`, name:`Packet Loss`,     udst:`PacketLoss`,  peak:_TARGET_PEAK_TYPES.LOSS,       data_buffer:_TARGET_DATA_BUFFER_TYPES.LOSS,     alert_mask: _TARGET_ALERT_BITMASK.LOSS}
}

// Accessory must be created from PlatformAccessory Constructor
let _PlatformAccessory  = undefined;
// Service and Characteristic are from hap-nodejs
let _hap                = undefined;

/* Default Export Function for integrating with Homebridge */
/* ========================================================================
   Description: Exported default function for Homebridge integration.

   Parameters:  homebridge: reference to the Homebridge API.

   Return:      None
   ======================================================================== */
export default (homebridgeAPI) => {
    _debug(`homebridge API version: v${homebridgeAPI.version}`);

    // Accessory must be created from PlatformAccessory Constructor
    _PlatformAccessory  = homebridgeAPI.platformAccessory;
    if (!Object.prototype.hasOwnProperty.call(_PlatformAccessory, "PlatformAccessoryEvent")) {
        // Append the PlatformAccessoryEvent.IDENTITY enum to the platform accessory reference.
        // This allows us to not need to import anything from 'homebridge'.
        const platformAccessoryEvent = {
            IDENTIFY: "identify",
        }

        _PlatformAccessory.PlatformAccessoryEvent = platformAccessoryEvent;
    }

    // Cache the reference to hap-nodejs
    _hap                = homebridgeAPI.hap;

    // Register the paltform.
    _debug(`Registering platform: ${PLATFORM_NAME}`);
    homebridgeAPI.registerPlatform(PLATFORM_NAME, NetworkPerformanceMonitorPlatform);
};

/* ==========================================================================
   Class:              NetworkPerformanceMonitorPlatform
   Description:	       Homebridge platform for managing the Network Performance Monitor
   Copyright:          Jan 2021
   ========================================================================== */
class NetworkPerformanceMonitorPlatform {
 /* ========================================================================
    Description:    Constructor

    @param {object} [log]      - Object for logging in the Homebridge Context
    @param {object} [config]   - Object for the platform configuration (from config.json)
    @param {object} [api]      - Object for the Homebridge API.

    @return {object}  - Instance of VolumeInterrogatorPlatform
    ======================================================================== */
    constructor(log, config, api) {

        /* Cache the arguments. */
        this._log     = log;
        this._config  = config;
        this._api     = api;

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
        this._bindDestructorNormal          = this._destructor.bind(this, {cleanup:true});
        this._bindDestructorAbnormal        = this._destructor.bind(this, {exit:true});

        /* Log our creation */
        this._log(`Creating NetworkPerformanceMonitorPlatform`);

        /* Create an empty map for our accessories */
        this._accessories = new Map();
        /* Create an empty map for our network performance targets. */
        this._networkPerformanceTargets = new Map();

        // Check for Settings
        if (theSettings != undefined) {
            let commonTargetConfig = {};
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
                    let targetConfig = commonTargetConfig;

                    if (typeof(itemConfig) === 'object') {
                        /* Get the Target Type */
                        if ((Object.prototype.hasOwnProperty.call(itemConfig, 'target_type')) && (typeof(itemConfig.target_type) === 'string')) {
                            targetConfig.target_type = itemConfig.target_type;
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

        // Register for the Did Finish Launching event
        this._api.on('didFinishLaunching', this._bindDoInitialization);
        this._api.on('shutdown', this._bindDestructorNormal);

        // Register for shutdown events.
        //do something when app is closing
        process.on('exit', this._bindDestructorNormal);
        //catches uncaught exceptions
        process.on('uncaughtException', this._bindDestructorAbnormal);

    }

 /* ========================================================================
    Description: Destructor

    @param {object} [options]  - Typically containing a "cleanup" or "exit" member.
    @param {object} [err]      - The source of the event trigger.
    ======================================================================== */
    // eslint-disable-next-line no-unused-vars
    async _destructor(options, err) {
        // Is there an indication that the system is either exiting or needs to
        // be cleaned up?
        if ((options.exit) || (options.cleanup)) {
            // Cleanup the network performance objects.
        }
        // Lastly eliminate myself.
        delete this;
    }

 /* ========================================================================
    Description: Event handler when the system has loaded the platform.

    @throws {TypeError}  - thrown if the 'polling_interval' configuration item is not a number.
    @throws {RangeError} - thrown if the 'polling_interval' configuration item is outside the allowed bounds.

    @remarks:     Opportunity to initialize the system and publish accessories.
    ======================================================================== */
    async _doInitialization() {

        // Some network performance targets may still we waiting to complete initialization
        // (i.e. Gateways). Ensure that all npt's are not pending. If any are, then defer initialization.
        let defer = false;
        for (const target of this._networkPerformanceTargets.values()) {
            if (target.IsTargetSestinationPending) {
                // Give a bit
                this._log(`Target ${target.ID} is pending. Defer initialization..`);
                defer = true;
                // No need to continue looking.
                break;
            }
        }

        if (defer)
        {
            // Try again later.
            setTimeout(this._doInitialization.bind(this), 100);
        }
        else {
            this._log(`Homebridge Plug-In ${PLATFORM_NAME} has finished launching.`);

            // Flush any accessories that are not from this version or are orphans (no corresponding network performance target).
            const accessoriesToRemove = [];
            for (const accessory of this._accessories.values()) {
                if (!Object.prototype.hasOwnProperty.call(accessory.context, 'VERSION') ||
                    (accessory.context.VERSION !== ACCESSORY_VERSION)) {
                    this._log(`Accessory ${accessory.displayName} has accessory version ${accessory.context.VERSION}. Version ${ACCESSORY_VERSION} is expected.`);
                    // This accessory needs to be replaced.
                    accessoriesToRemove.push(accessory);
                }
                else if (!this._networkPerformanceTargets.has(accessory.context.ID)) {
                    // Orphan accessory
                    this._log(`Accessory ${accessory.displayName} is an orphan and should be purged.`);
                    // This accessory needs to be replaced.
                    accessoriesToRemove.push(accessory);
                }
            }
            // Perform the cleanup.
            accessoriesToRemove.forEach(accessory => {
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
                target.on('ready', this._bindPingReady);

                // Get the accessory to see if it is active or not.
                const accessory = this._accessories.get(target.ID);
                // Is the accessory active?
                if (this._getAccessorySwitchState(accessory)) {
                    // Start the Network Performance Target.
                    target.Start();
                }
            }
        }
    }

 /* ========================================================================
    Description: Event handler for the Ping Ready event

    @param {object} [results] - Ping 'readt' event results.
    @event_param {<NetworkTarget>} [results.sender]         - Reference to the sender of the event.
    @event_param {boolean}         [results.error]          - Flag indicating is there is an error with the ping.
    @event_param {number}          [results.packet_loss]    - Packet Loss (percent)
    @event_param {number}          [results.ping_latency_ms]- Ping Latency in milliseconds.
    @event_param {number}          [results.ping_sjitter    - Ping Jitter in milliseconds.

    @throws {TypeError}  - thrown if the 'results' is not an object having the expected values.
    @throws {Error}      - thrown if there is no accessory with a matching id as the sender.
    ======================================================================== */
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
            if (accessory !== undefined) {
                // Get the buffer filled flags.
                const latencyBufferFilled   = results.sender.IsBufferFilled(SERVICE_INFO.LATENCY.data_buffer);
                const jitterBufferFilled     = results.sender.IsBufferFilled(SERVICE_INFO.JITTER.data_buffer);
                const lossBufferFilled      = results.sender.IsBufferFilled(SERVICE_INFO.LOSS.data_buffer);

                // Compute the fault statuses
                const threshold     = (3.0*results.sender.ExpectedJitter);
                const latencyFault  = (results.error || (latencyBufferFilled  && (results.ping_latency_ms > (results.sender.ExpectedJitter + threshold))));
                const jitterFault   = (results.error || (jitterBufferFilled && (results.ping_jitter > results.sender.ExpectedJitter)));
                const lossFault     = ((lossBufferFilled && (results.packet_loss > results.sender.TolerableLoss)) ? true : false);

                // Determine if the peaks have expired.
                const resetPeakLatency  = results.sender.IsPeakExpired(SERVICE_INFO.LATENCY.peak);
                const resetPeakJitter   = results.sender.IsPeakExpired(SERVICE_INFO.JITTER.peak);
                const resetPeakLoss     = results.sender.IsPeakExpired(SERVICE_INFO.LOSS.peak);

                // Update the values.
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LATENCY,{level:results.ping_latency_ms, fault:latencyFault, resetPeak:resetPeakLatency, active:true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.JITTER, {level:results.ping_jitter,     fault:jitterFault,  resetPeak:resetPeakJitter,  active:true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LOSS,   {level:results.packet_loss,     fault:lossFault,    resetPeak:resetPeakLoss,    active:true});
            }
        }
        else {
            this._log.debug(`No accessory for sender ID: ${id}`);
            throw new Error(`No accessory for sender ID: ${id}`);
        }
    }

 /* ========================================================================
    Description: Homebridge API invoked after restoring cached accessorues from disk.

    @param {PlatformAccessory} [accessory] - Accessory to be configured.

    @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
    ======================================================================== */
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
            try
            {
                this._configureAccessory(accessory);
            }
            catch (error)
            {
                this._log(`Unable to configure accessory ${accessory.displayName}. Version:${accessory.context.VERSION}. Error:${error}`);
                // We don't know where the exception happened. Ensure that the accessory is in the map.
                const id = accessory.context.ID;
                if (!this._accessories.has(id)){
                    // Update our accessory listing
                    this._accessories.set(id, accessory);
                }
            }
        }
    }

 /* ========================================================================
    Description: Create and register an accessory for the network performance target.

    @param {string} [id] - identifier for the accessory.

    @throws {TypeError} - Thrown when 'id' is not a string.
    @throws {RangeError} - Thrown when 'id' length is 0
    @throws {Error} - Thrown when an accessory with 'name' is already registered.
    @throws {Error} - Thrown when there is no matching network performance target.
    ======================================================================== */
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

        // uuid must be generated from a unique but not changing data source, theName should not be used in the most cases. But works in this specific example.
        const uuid = _hap.uuid.generate(id);
        const accessory = new _PlatformAccessory(target.TargetDestination, uuid);

        // Add the identifier to the accessory's context. Used for remapping on depersistence.
        accessory.context.ID = id;
        // Mark the version of the accessory. This is used for depersistence
        accessory.context.VERSION = ACCESSORY_VERSION;
        // Create accessory persisted settings
        accessory.context.SETTINGS = {SwitchState:true};

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

        this._api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
   }

 /* ========================================================================
    Description: Internal function to perform accessory configuration and internal 'registration' (appending to our list)

    @param {PlatformAccessory} [accessory] - Accessory to be configured.

    @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory

    @remarks:     Opportunity to setup event handlers for characteristics and update values (as needed).
    ======================================================================== */
    _configureAccessory(accessory) {

        if ((accessory === undefined) ||
            (!(accessory instanceof _PlatformAccessory))) {
            throw new TypeError(`accessory must be a PlatformAccessory`);
        }

        this._log.debug("Configuring accessory %s", accessory.displayName);

        // Get the accessory identifier from the contect.
        const id = accessory.context.ID;

        // Register to handle the Identify request for the accessory.
        accessory.on(_PlatformAccessory.PlatformAccessoryEvent.IDENTIFY, () => {
            this._log("%s identified!", accessory.displayName);
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

            // Also update the name, so it is recognizable in the Home app
            serviceSwitch.updateCharacteristic(_hap.Characteristic.Name, `Power (${accessory.displayName})`);

            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            // Register for the "get" event notification.
            charOn.on('get', this._handleOnGet.bind(this, id));
            // Register for the "set" event notification.
            charOn.on('set', this._handleOnSet.bind(this, id));
        }

        // Update the names of each service.
        const infoItems = [SERVICE_INFO.LATENCY, SERVICE_INFO.JITTER, SERVICE_INFO.LOSS];
        for (const name_info of infoItems) {
            const service = accessory.getServiceById(name_info.uuid, name_info.udst);
            if (service !== undefined) {
                service.updateCharacteristic(_hap.Characteristic.Name, `${name_info.name}-(${accessory.displayName})`);
            }
        }

        // Initialize the Carbon Dioxide Sensors
        this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.LATENCY,{level:0.0, fault:false, resetPeak:true, active:switchState});
        this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.JITTER, {level:0.0, fault:false, resetPeak:true, active:switchState});
        this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.LOSS,   {level:0.0, fault:false, resetPeak:true, active:switchState});

        // Update the accessory information
        this._updateAccessoryInfo(accessory, {model:"GrumpTech Network Performance", serialnum:id});

        // Is this accessory new to us?
        if (!this._accessories.has(id)){
            // Update our accessory listing
            this._log.debug(`Adding accessory '${accessory.displayName} to the accessories list. Count:${this._accessories.size}`);
            this._accessories.set(id, accessory);
        }
    }

 /* ========================================================================
    Description: Internal function to perform accessory configuration for Carbon Dioxide Sensor services.

    @param {PlatformAccessory} [accessory]          - Accessory to be configured.
    @param {object}            [serviceInfo]        - Name information of the service to be configured.
    @param {string}            [serviceInfo.uuid]   - UUID of the service
    @param {string}            [serviceInfo.name]   - Name of the service.
    @param {string}            [serviceInfo.udst]   - User Defined Sub-Type of the service.
    @param {string}            [serviceInfo.peak]   - Name of the 'peak'. Used to update the target when the peak is updated.
    @param {string}            [serviceInfo.alert]  - Name of the 'alert'. Used to update the target when a fault is set or cleared.
    @paran {object}            [values]             - Object containing the values being set.
    @param {number  | Error}   [values.level]       - Value to be reported as the CO Level
    @param {boolean | Error}   [values.fault]       - true if a fault exists.
    @param {boolean | Error}   [values.resetPeak]   - true if the peak level should be reset.

    @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
    @throws {TypeError} - thrown if 'serviceInfo' does not conform to a serviceInfo item.
    @throws {TypeError} - thrown if 'values' is not an object or does not contain the expected fields.
    @throws {Error}     - thrown if the service for the serviceName is not a Carbon Dioxide Sensor.

    @remarks:     Opportunity to setup event handlers for characteristics and update values (as needed).
    ======================================================================== */
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
            (!Object.prototype.hasOwnProperty.call(serviceInfo, 'alert_mask')   || (typeof(serviceInfo.alert_mask)   !== 'number')                                          )   )
        {
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
                const faultCode = (values.fault                                                   ? _hap.Characteristic.StatusFault.GENERAL_FAULT                 : _hap.Characteristic.StatusFault.NO_FAULT);
                const co2Level  = ((target.IsAlertActive(serviceInfo.alert_mask) && values.fault) ? _hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL : _hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
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

 /* ========================================================================
    Description: Remove/destroy an accessory

    @param {object} [accessory] - accessory to be removed.

    @throws {TypeError} - Thrown when 'accessory' is not an instance of _PlatformAccessory.
    @throws {RangeError} - Thrown when a 'accessory' is not registered.
    ======================================================================== */
    _removeAccessory(accessory) {
        // Validate arguments
        if ((accessory === undefined) || !(accessory instanceof _PlatformAccessory)) {
            throw new TypeError(`Accessory must be a PlatformAccessory`);
        }
        if (!this._accessories.has(accessory.context.ID)) {
            throw new RangeError(`Accessory '${accessory.displayName}' is not registered.`);
        }

        this._log.debug(`Removing accessory '${accessory.displayName}'`);

        // Event Handler cleanup.
        accessory.removeAllListeners(_PlatformAccessory.PlatformAccessoryEvent.IDENTIFY);
        // Does this accessory have a Switch service?
        const serviceSwitch = accessory.getService(_hap.Service.Switch);
        if (serviceSwitch !== undefined) {
            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            // Register for the "get" event notification.
            charOn.off('get', this._handleOnGet.bind(this, accessory));
            // Register for the "get" event notification.
            charOn.off('set', this._handleOnSet.bind(this, accessory));
        }

        /* Unregister the accessory */
        this._api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        /* remove the accessory from our mapping */
        this._accessories.delete(accessory.context.ID);
    }

 /* ========================================================================
    Description: Update an accessory

    @param {object} [accessory] - accessory to be updated.

    @param {object} [info]                      - accessory information.
    @param {string | Error} [info.model]        - accessory model number
    @param {string | Error} [info.serialnum]    - accessory serial number.

    @throws {TypeError} - Thrown when 'accessory' is not an instance of _PlatformAccessory..
    @throws {TypeError} - Thrown when 'info' is not undefined, does not have the 'model' or 'serialnum' properties
                          or the properties are not of the expected type.
    ======================================================================== */
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
        if (accessoryInfoService != undefined)
        {
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

 /* ========================================================================
    Description: Event handler for the "get" event for the Switch.On characteristic.

    @param {string} [id] - identification of the accessory being querried.

    @param {function} [callback] - Function callback for homebridge.

    @throws {TypeError} - Thrown when 'id' is not a non-zero string.
    @throws {Error}     - Thrown when there is no accessory keyed with 'id'
    ======================================================================== */
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

 /* ========================================================================
    Description: Event handler for the "set" event for the Switch.On characteristic.

    @param {stirng} [id] - identification of the accessory being commanded.
    @param {bool} [value] - new/rewuested state of the switch
    @param {function} [callback] - Function callback for homebridge.

    @throws {TypeError} - Thrown when 'id' is not a non-zero string.
    @throws {Error}     - Thrown when there is no accessory or networt performance target keyed with 'id'
    ======================================================================== */
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

            // Store the state of the switch so that when the plugin is restarted, we will restore the
            // switch state as it was last set.
            let theSettings = accessory.context.SETTINGS;
            if ((theSettings !== undefined) &&
                (typeof(theSettings) === 'object') &&
                (Object.prototype.hasOwnProperty.call(theSettings, 'SwitchState')) &&
                (typeof(theSettings.SwitchState) === 'boolean')) {
                // Modify the settings
                theSettings.SwitchState = value;
            }
            // Store the updated settings.
            accessory.context.SETTINGS = theSettings;

            try {
                // Is there a matching network performance target for this 'id'?
                if (this._networkPerformanceTargets.has(id)) {
                    const target = this._networkPerformanceTargets.get(id);
                    if (target !== undefined) {
                        // Update/reinitialize the accessory data (including the peak, as needed)
                        const theLevel = (value ? 0.0 : -1.0);
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LATENCY,{level:theLevel, fault:false, resetPeak:value, active:value});
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.JITTER, {level:theLevel, fault:false, resetPeak:value, active:value});
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LOSS,   {level:theLevel, fault:false, resetPeak:value, active:value});

                        if (value) {
                            // Turn the Ping Power On !!
                            target.Start();
                        }
                        else {
                            // Note: Even after turning the ping power off, there may be one more result coming in.
                            target.Stop();
                        }
                    }
                }
                else {
                    throw new Error(`id:${id} has no matching network performance target.`);
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

 /* ========================================================================
    Description: Get the value of the Service.Switch.On characteristic value

    @param {object} [accessory] - accessory being querried.

    @return - the value of the On characteristic (true or false)

    @throws {TypeError} - Thrown when 'accessory' is not an instance of _PlatformAccessory.
    @throws {Error}     - Thrown when the switch service or On characteristic cannot
                          be found on the accessory.
    ======================================================================== */
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
}
