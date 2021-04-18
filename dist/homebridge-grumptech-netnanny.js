'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var modCrypto = require('crypto');

var config_info = {
	remarks: [
		"The 'plugin' and 'platform' names MUST match the names called out in the 'platforms' section of the active config.json file.",
		"If these values are changed, the module will need to be rebuilt. Run 'npm run build'."
	],
	plugin: "homebridge-grumptech-netnanny",
	platform: "GrumpTechHomebridgeNetNanny"
};

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

/* ==========================================================================
   File:               spawnHelper.js
   Class:              Spawn Helper
   Description:	       Wrapper for managing spawned tasks.
   Copyright:          Dec 2020
   ========================================================================== */

// External dependencies and imports.
const _debug$2    = require('debug')('spawn_helper');
const { spawn } = require('child_process');

// Bind debug to console.log
_debug$2.log = console.log.bind(console);

/* ==========================================================================
   Class:              SpawnHelper
   Description:	       Wrapper class for handling spawned tasks
   Copyright:          Dec 2020

   @event 'complete' => function({object})
   @event_param {bool}              [valid]  - Flag indicating if the spawned task completed successfully.
   @event_param {<Buffer>}          [result] - Buffer of the data or error returned by the spawned process.
   #event_param {<SpawnHelper>}     [source] - Reference to *this* SpawnHelper that provided the results.
   Event emmitted when the spawned task completes.
   ========================================================================== */
class SpawnHelper extends EventEmitter {
 /* ========================================================================
    Description:    Constructor

    @param {object} [config] - Not used.

    @return {object}  - Instance of the SpawnHelper class.

    @throws {TypeError}  - thrown if the configuration is not undefined.
    ======================================================================== */
    constructor(config) {
        if (config !== undefined) {
            throw new TypeError(`SpawnHelper does not use any arguments.`);
        }

        // Initialize the base class.
        super();

        // Initialize data members.
        this._command           = undefined;
        this._arguments         = undefined;
        this._options           = undefined;
        this._result_data       = undefined;
        this._error_data        = undefined;
        this._error_encountered = false;
        this._pending           = false;

        // Bound Callbacks
        this._CB__process_stdout_data   = this._process_stdout_data.bind(this);
        this._CB__process_stderror_data = this._process_stderror_data.bind(this);
        this._CB_process_message        = this._process_message.bind(this);
        this._CB_process_error          = this._process_error.bind(this);
        this._CB_process_close          = this._process_close.bind(this);
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the pending flag for this
                 item.

    @return {bool} - true if processing of this item is pending.
    ======================================================================== */
    get IsPending() {
        return ( this._pending );
    }
 
 /* ========================================================================
    Description: Read-Only Property accessor to read the valid flag for this
                 item.

    @return {bool} - true if processing completed successfully.
    ======================================================================== */
    get IsValid() {
        return ( (this._command !== undefined) && 
                 !this.IsPending && !this._error_encountered );
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the result data for this
                 item.

    @return {<Buffer>} - Data collected from the spawn process. 
                         Unreliable and/or undefined if processing was not successful.
    ======================================================================== */
    get Result() {
        return ( this._result_data );
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the error data for this
                 item.

    @return {<Buffer>} - Error data collected from the spawn process. 
                         Unreliable and/or undefined if processing completed successfully.
    ======================================================================== */
    get Error() {
        return ( this._error_data );
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the spawn command for this
                 item.

    @return {string} - Current command for the spawn process.
    ======================================================================== */
    get Command() {
        return ( this._command );
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the spawn arguments for
                 this item.

    @return {[string]]} - Current command arguments for the spawn process.
    ======================================================================== */
    get Arguments() {
        return ( this._arguments );
    }

 /* ========================================================================
    Description: Read-Only Property accessor to read the spawn options for
                 this item.

    @return {[string]]} - Current command options for the spawn process.
    ======================================================================== */
    get Options() {
        return ( this._options );
    }

 /* ========================================================================
    Description:    Initiate spawned process

    @param {object}    [request]           - Spawn command data
    @param {string}    [request.command]   - Spawn command     (required)
    @param {[string]}  [request.arguments] - Spawn arguments   (optional)
    @param {[string]}  [request.options]   - Spawn options     (optional)

    @return {bool}  - true if child process is spawned

    @throws {TypeError}  - arguments are not of the expected type. 
    @throws {Error}      - Spawn invoked when an existing spawn is still pending.
    ======================================================================== */
    Spawn(request) {

        // Ensure a spawn is not already in progress.
        if (this.IsPending) {
            throw new Error('Spawn is already in progress.');
        }

        // Validate the arguments.
        if ((request === undefined) || (typeof(request) !== 'object')) {
            throw new TypeError('request must be an obkect');
        }
        // Validate 'required' command request.
        if ( (!request.hasOwnProperty('command'))   ||
             (typeof(request.command) !== 'string') ||
             (request.command.length <= 0)            ) {
            throw new TypeError('request.command must be a non-zero length string.');
        }
        // If we got this far, then request.command mus be legit.
        this._command = request.command;

        // Validate 'optional' arguments request
        if (request.hasOwnProperty('arguments')) {
            if (!Array.isArray(request.arguments)) {
                throw new TypeError('request.arguments must be an array of strings.');
            }
            else {
                for (const arg of request.arguments) {
                    if (typeof(arg) !== 'string') {
                        throw new TypeError('request.arguments must contain only strings.');
                    }
                }
            }
            // If we got this far, then request.arguments must be legit
            this._arguments = request.arguments;
        }
        else {
            // Use default
            this._arguments = [];
        }

        // Validate 'optional' options request
        if (request.hasOwnProperty('options')) {
            if (!Array.isArray(request.options)) {
                throw new TypeError('request.options must be an array of strings.');
            }
            else {
                for (const arg of request.options) {
                    if (typeof(arg) !== 'string') {
                        throw new TypeError('request.options must contain only strings.');
                    }
                }
            }
            // If we got this far, then request.options must be legit
            this._options = request.options;
        }
        else {
            // Use default
            this._options = [];
        }

        // Reset the internal data
        this._result_data       = undefined;
        this._error_data        = undefined;
        this._error_encountered = false;
        this._pending           = true;  // Think positive :)

        // Spawn the request
        const childProcess = spawn(this._command, this._arguments, this._options);
        // Register for the stdout.data notifications
        childProcess.stdout.on('data', this._CB__process_stdout_data);
        // Register for the stderr.data notifications
        childProcess.stderr.on('data', this._CB__process_stderror_data);
        // Register for the message notification
        childProcess.on('message', this._CB_process_message);
        // Register for the error notification
        childProcess.on('error', this._CB_process_error );        
        // Register for the close notification
        childProcess.on('close', this._CB_process_close);
    }

 /* ========================================================================
    Description:    Event handler for the STDOUT Data Notification

    @param { <Buffer> | <string> | <any>} [chunk] - notification data
    ======================================================================== */
    _process_stdout_data(chunk) {
        if (this._result_data === undefined) {
            // Initialize the result data
            this._result_data = chunk;
        }
        else {
            // Otherwise, append the chunk.
            this._result_data += chunk;
        }
    }

 /* ========================================================================
    Description:    Event handler for the STDERR Data Notification

    @param { <Buffer> | <string> | <any>} [chunk] - notification data
    ======================================================================== */
    _process_stderror_data(chunk) {
        if (this._error_data === undefined) {
            // Initialize the result data
            this._error_data = chunk;
        }
        else {
            // Otherwise, append the chunk.
            this._error_data += chunk;
        }

        // Ensure that the error is recorded.
        this._error_encountered = true;
    }

 /* ========================================================================
    Description:    Event handler for the Child Process Message Notification

    @param { <Object> } [message]      - A parsed JSON object or primitive value.
    @param { <Handle> } [sendHandle]   - Handle
    ======================================================================== */
    _process_message(message, sendHandle) {
        // TODO: Not sure if I need this.
        _debug$2(`Child Process for ${this.Command}: '${message}'`);
    }

 /* ========================================================================
    Description:    Event handler for the Child Process Error Notification

    @param { <Error> } [error] - The error
    ======================================================================== */
    _process_error(error) {
        // Log the error info.
        _debug$2(`Child Process for ${this.Command}: error_num:${errror.number} error_name:${error.name} error_msg:${error.message}`);

        // Ensure that the error is recorded.
        this._error_encountered = true;
    }

 /* ========================================================================
    Description:    Event handler for the Child Process Close Notification

    @param { <number> } [code]   - The exit code if the child exited on its own.
    @param { <string> } [signal] - The signal by which the child process was terminated. 
    ======================================================================== */
    _process_close(code, signal) {
        // Log the close info.
        _debug$2(`Child Process for ${this.Command}: exit_code:${code} by signal:'${signal}'`);

        // Indicate that we are done.
        this._pending = false;

        // Notify our clients.
        const isValid = this.IsValid;
        const response = {valid:isValid, result:(isValid ? this.Result : this.Error), source:this};
        this.emit('complete', response);
    }   
}

/* ==========================================================================
   File:               networkTarget.js
   Class:              Network Target
   Description:	       Monitors network performance for a target based on
                       ping results.
   Copyright:          Mar 2021
   ========================================================================== */

// External dependencies and imports.
const _debug$1    = require('debug')('network_target');

// Bind debug to console.log
_debug$1.log = console.log.bind(console);

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
const TARGET_TYPES = {
    URI         : 'uri',
    IPV4        : 'ipv4',
    IPV6        : 'ipv6',
    GATEWAY     : 'gateway',
    CABLE_MODEM : 'cable_modem'
};

/* Enumeration for peak types */
const PEAK_TYPES = {
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
class NetworkTarget extends EventEmitter {
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
        _debug$1(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug$1(response.result);

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
            _debug$1(`Error encountered raising 'ready' event. ${e}`);
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
        _debug$1(`'${response.source.Command} ${response.source.Arguments}' Spawn Helper Result: valid:${response.valid}`);
        _debug$1(response.result);

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

/* ==========================================================================
   File:               main.js
   Description:	       Homebridge integration for Net Nanny
   Copyright:          Mar 2021
   ========================================================================== */

const _debug = require('debug')('homebridge');

// Configuration constants.
const PLUGIN_NAME   = config_info.plugin;
const PLATFORM_NAME = config_info.platform;

// Internal Constants
const ACCESSORY_VERSION = 1;

const SERVICE_INFO = {
    POWER   : {uuid:`B3D9583F-2050-43B6-A179-9D453B494220`, name:`Ping Control`,        udst:`PingControl`},
    TIME    : {uuid:`9B838A70-8F81-4B76-BED5-3729F8F34F33`, name:`Time`,                udst:`PingTime`,    peak:PEAK_TYPES.TIME},
    STDDEV  : {uuid:`67434B8C-F3CC-44EA-BBE9-15B4E7A2CEBF`, name:`Standard Deviation`,  udst:`PingStdDev`,  peak:PEAK_TYPES.STDEV},
    LOSS    : {uuid:`9093B0DE-078A-4B19-8081-2998B26A9017`, name:`Packet Loss`,         udst:`PacketLoss`,  peak:PEAK_TYPES.LOSS}
};

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
var main = (homebridgeAPI) => {
    _debug(`homebridge API version: v${homebridgeAPI.version}`);

    // Accessory must be created from PlatformAccessory Constructor
    _PlatformAccessory  = homebridgeAPI.platformAccessory;
    if (!_PlatformAccessory.hasOwnProperty('PlatformAccessoryEvent')) {
        // Append the PlatformAccessoryEvent.IDENTITY enum to the platform accessory reference.
        // This allows us to not need to import anything from 'homebridge'.
        const platformAccessoryEvent = {
            IDENTIFY: "identify",
        };

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
        if (this._config.hasOwnProperty('settings')) {
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
            if ((theSettings.hasOwnProperty('ping_count')) && (typeof(theSettings.ping_count) === 'number')) {
                commonTargetConfig.ping_count = theSettings.ping_count;
            }
            /* Get the packet size */
            if ((theSettings.hasOwnProperty('packet_size')) && (typeof(theSettings.packet_size) === 'number')) {
                commonTargetConfig.packet_size = theSettings.packet_size;
            }
            /* Get the ping period */
            if ((theSettings.hasOwnProperty('ping_period')) && (typeof(theSettings.ping_period) === 'number')) {
                commonTargetConfig.ping_period = theSettings.ping_period;
            }
            /* Get the ping interval */
            if ((theSettings.hasOwnProperty('ping_interval')) && (typeof(theSettings.ping_interval) === 'number')) {
                commonTargetConfig.ping_interval = theSettings.ping_interval;
            }

            /* Ping Target Specific configuration settings */
            if ((theSettings.hasOwnProperty('ping_targets')) && (Array.isArray(theSettings.ping_targets))) {

                for (const itemConfig of  theSettings.ping_targets) {
                    // Start with the common configs.
                    let targetConfig = commonTargetConfig;

                    if (typeof(itemConfig) === 'object') {
                        /* Get the Target Type */
                        if ((itemConfig.hasOwnProperty('target_type')) && (typeof(itemConfig.target_type) === 'string')) {
                            targetConfig.target_type = itemConfig.target_type;
                        }
                        /* Get the Target Destination */
                        if ((itemConfig.hasOwnProperty('target_dest')) && (typeof(itemConfig.target_dest) === 'string')) {
                            targetConfig.target_dest = itemConfig.target_dest;
                        }
                        /* Get the nominal ping time */
                        if ((itemConfig.hasOwnProperty('expected_nominal')) && (typeof(itemConfig.expected_nominal) === 'number')) {
                            targetConfig.expected_nominal = itemConfig.expected_nominal;
                        }
                        /* Get the nominal ping stamdard deviation */
                        if ((itemConfig.hasOwnProperty('expected_stdev')) && (typeof(itemConfig.expected_stdev) === 'number')) {
                            targetConfig.expected_stdev = itemConfig.expected_stdev;
                        }
                        /* Get the packet loss limit */
                        if ((itemConfig.hasOwnProperty('loss_limit')) && (typeof(itemConfig.loss_limit) === 'number')) {
                            targetConfig.loss_limit = itemConfig.loss_limit;
                        }
                        /* Get the peak reset time (hr) */
                        if ((itemConfig.hasOwnProperty('peak_expiration')) && (typeof(itemConfig.peak_expiration) === 'number')) {
                            targetConfig.peak_expiration = itemConfig.peak_expiration;
                        }

                        /* Create the network target. */
                        const networkTarget = new NetworkTarget(targetConfig);
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
    async _destructor(options, err) {
        // Is there an indication that the system is either exiting or needs to
        // be cleaned up?
        if ((options.exit) || (options.cleanup)) ;
    }

 /* ========================================================================
    Description: Event handler when the system has loaded the platform.

    @throws {TypeError}  - thrown if the 'polling_interval' configuration item is not a number.
    @throws {RangeError} - thrown if the 'polling_interval' configuration item is outside the allowed bounds.

    @remarks:     Opportunity to initialize the system and publish accessories.
    ======================================================================== */
    async _doInitialization() {

        this._log(`Homebridge Plug-In ${PLATFORM_NAME} has finished launching.`);

        // Flush any accessories that are not from this version
        const accessoriesToRemove = [];
        for (const accessory of this._accessories.values()) {
            if (!accessory.context.hasOwnProperty('VERSION') ||
                (accessory.context.VERSION !== ACCESSORY_VERSION)) {
                this._log(`Accessory ${accessory.displayName} has accessory version ${accessory.context.VERSION}. Version ${ACCESSORY_VERSION} is expected.`);
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

 /* ========================================================================
    Description: Event handler for the Ping Ready event

    @param {object} [results] - Ping 'readt' event results.
    @event_param {<NetworkTarget>} [results.sender]      - Reference to the sender of the event.
    @event_param {boolean}         [results.error]       - Flag indicating is there is an error with the ping.
    @event_param {number}          [results.packet_loss] - Packet Loss (percent)
    @event_param {number}          [results.ping_time_ms]- Ping Time (average) in milliseconds.
    @event_param {number}          [results.ping_stdev]  - Standard Deviation of the ping times.

    @throws {TypeError}  - thrown if the 'results' is not an object having the expected values.
    @throws {Error}      - thrown if there is no accessory with a matching id as the sender.
    ======================================================================== */
    _processPingReady(results) {
        if ((results === undefined) || (typeof(results) !== 'object')                               ||
            (!results.hasOwnProperty('sender')) || !(results.sender instanceof NetworkTarget)      ||
            (!results.hasOwnProperty('error')) || (typeof(results.error) !== 'boolean')             ||
            (!results.hasOwnProperty('packet_loss')) || (typeof(results.packet_loss) !== 'number')  ||
            (!results.hasOwnProperty('ping_time_ms')) || (typeof(results.ping_time_ms) !== 'number')||
            (!results.hasOwnProperty('ping_stdev')) || (typeof(results.ping_stdev) !== 'number')      ) {
            const errText = (results === undefined) ? 'undefined' : results.toString();
            throw new TypeError(`Ping 'ready' results are invalid: ${errText}`);
        }

        _debug(`Ping results: Target:${results.sender.TargetDestination} Error:${results.error} Loss:${results.packet_loss} Time:${results.ping_time_ms} StDev:${results.ping_stdev}`);

        // Update the accessory with the data provided.
        // Get the id for the accessory
        const id = results.sender.ID;
        // Validate that an accessory exists for this id.
        if (this._accessories.has(id)) {
            const accessory = this._accessories.get(id);
            if (accessory !== undefined) {
                // Compute the fault statuses
                const varianceLimit = (3.0*results.sender.ExpectedStdDev);
                const timeFault     = (results.error || (results.ping_time_ms > (results.sender.ExpectedNominal + varianceLimit)));
                const stdevFault    = (results.error || (results.ping_stdev > varianceLimit));
                const lossFault     = ((results.packet_loss > results.sender.TolerableLoss) ? true : false);

                // Update the values.
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.TIME,   {level:results.ping_time_ms, fault:timeFault,  resetPeak:false, active:true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.STDDEV, {level:results.ping_stdev,   fault:stdevFault, resetPeak:false, active:true});
                this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.LOSS,   {level:results.packet_loss,  fault:lossFault,  resetPeak:false, active:true});
            }
        }
        else {
            console.log(`No accessory for sender ID: ${id}`);
            throw new Error(`No accessory for sender ID: ${id}`);
        }
    }

 /* ========================================================================
    Description: Homebridge API invoked after restoring cached accessorues from disk.

    @param {PlatformAccessory} [accessory] - Accessory to be configured.

    @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
    ======================================================================== */
    configureAccessory(accessory) {

        // This application has no need for history of the accessory data..
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
                this._log(`Unable to configure accessory ${accessory.displayName}. Version:${accessory.context.VERSION}`);
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
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.TIME.uuid,    SERVICE_INFO.TIME.udst);
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.STDDEV.uuid,  SERVICE_INFO.STDDEV.udst);
        accessory.addService(_hap.Service.CarbonDioxideSensor,  SERVICE_INFO.LOSS.uuid,    SERVICE_INFO.LOSS.udst);

        try {
            // Configure the accessory
            this._configureAccessory(accessory);
        }
        catch (error) {
            this._log.debug(`Error when configuring accessory.`);
            console.log(error);
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
                (theSettings.hasOwnProperty('SwitchState') &&
                (typeof(theSettings.SwitchState) === 'boolean'))) {
                // Modify the settings
                switchState = theSettings.SwitchState;
            }
            serviceSwitch.updateCharacteristic(_hap.Characteristic.On, switchState);

            const charOn = serviceSwitch.getCharacteristic(_hap.Characteristic.On);
            // Register for the "get" event notification.
            charOn.on('get', this._handleOnGet.bind(this, id));
            // Register for the "set" event notification.
            charOn.on('set', this._handleOnSet.bind(this, id));
        }

        // Update the names of each service.
        const infoItems = [SERVICE_INFO.TIME, SERVICE_INFO.STDDEV, SERVICE_INFO.LOSS];
        for (const name_info of infoItems) {
            const service = accessory.getServiceById(name_info.uuid, name_info.udst);
            if (service !== undefined) {
                console.log(`Setting Service Name to ${name_info.name}`);
                service.updateCharacteristic(_hap.Characteristic.Name, `${name_info.name}-(${accessory.displayName})`);
            }
        }

        // Initialize the Carbon Dioxide Sensors
        this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.TIME,   {level:0.0, fault:false, resetPeak:true, active:switchState});
        this._updateCarbonDioxideSensorService(accessory, SERVICE_INFO.STDDEV, {level:0.0, fault:false, resetPeak:true, active:switchState});
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
    @param {string}            [serviceInfo.peak]   - Name of the 'peak'. Used to reset the target when the peak is updated.
    @paran {object}            [values]             - Object containing the values being set.
    @param {number  | Error}   [values.level]       - Value to be reported as the CO Level
    @param {boolean | Error}   [values.fault]       - true if a fault exists.
    @param {boolean | Error}   [values.resetPeak]   - true if the peak level should be reset.

    @throws {TypeError} - thrown if 'accessory' is not a PlatformAccessory
    @throws {TypeError} - thrown if 'serviceName' does not conform to a SERVCICE_NAMES item.
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
            (!serviceInfo.hasOwnProperty('uuid') || (typeof(serviceInfo.uuid) !== 'string') || (serviceInfo.uuid.length <= 0) ) ||
            (!serviceInfo.hasOwnProperty('name') || (typeof(serviceInfo.name) !== 'string') || (serviceInfo.name.length <= 0) ) ||
            (!serviceInfo.hasOwnProperty('udst') || (typeof(serviceInfo.udst) !== 'string') || (serviceInfo.udst.length <= 0) ) ||
            (!serviceInfo.hasOwnProperty('peak') || (typeof(serviceInfo.peak) !== 'string') || (serviceInfo.peak.length <= 0) )   )
        {
            throw new TypeError(`serviceName does not conform to a SERVICE_INFO item.`);
        }
        if ((values === undefined) || (typeof(values) !== 'object') ||
            (!values.hasOwnProperty('level'))     || ((typeof(values.level) !== 'number')       || (values.level instanceof Error)) ||
            (!values.hasOwnProperty('fault'))     || ((typeof(values.fault) !== 'boolean')      || (values.fault instanceof Error)) ||
            (!values.hasOwnProperty('active'))    || ((typeof(values.active) !== 'boolean')     || (values.active instanceof Error)) ||
            (!values.hasOwnProperty('resetPeak')) || ((typeof(values.resetPeak) !== 'boolean')  || (values.resetPeak instanceof Error)) ) {
            throw new TypeError(`values must be an object with properties named 'level' (number or Error) and 'fault' (boolean or Error) and 'resetPeak' (boolean or Error)`);
        }

        // Attempt to get the named service and validate that it is a Carbon Dioxie Sensor
        const serviceCO2Ping = accessory.getServiceById(serviceInfo.uuid, serviceInfo.udst);
        if ((serviceCO2Ping !== undefined) &&
            (serviceCO2Ping instanceof _hap.Service.CarbonDioxideSensor)) {
            try {
                // Get the network performance target for this accessory
                const target = this._networkPerformanceTargets.get(accessory.context.ID);
                // Determine the fault code.
                const faultCode = (values.fault ? _hap.Characteristic.StatusFault.GENERAL_FAULT : _hap.Characteristic.StatusFault.NO_FAULT);
                // Determine the low battery status based on being active or not.
                const batteryStatus = (values.active ? _hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : _hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxideDetected, _hap.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
                if (values.level >= 0.0) {
                    serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxideLevel, values.level);
                }
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.StatusFault, faultCode);
                serviceCO2Ping.updateCharacteristic(_hap.Characteristic.StatusLowBattery, batteryStatus);
                // Set the Peak Values if necessary,
                if (!values.resetPeak) {
                    // Get the current peak.
                    const currentPeak = serviceCO2Ping.getCharacteristic(_hap.Characteristic.CarbonDioxidePeakLevel).value;
                    // Is there a new peak?
                    if (values.level > currentPeak) {
                        // Set the new peak
                        serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxidePeakLevel, values.level);
                        // Update the peak time reference.
                        if (target !== undefined) {
                            target.UpdatePeakTime(serviceInfo.peak);
                        }
                    }
                }
                else {
                    // Reset the peak
                    serviceCO2Ping.updateCharacteristic(_hap.Characteristic.CarbonDioxidePeakLevel, 0.0);
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
            throw new Error(`Accessory ${accessory.displayName} does not have a valid ${serviceInfo} service`);
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
            (!info.hasOwnProperty('model'))     || ((typeof(info.model)      !== 'string') || (info.model instanceof Error)) ||
            (!info.hasOwnProperty('serialnum')) || ((typeof(info.serialnum)  !== 'string') || (info.serialnum instanceof Error))   ) {
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
                (theSettings.hasOwnProperty('SwitchState')) &&
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
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.TIME,   {level:theLevel, fault:false, resetPeak:value, active:value});
                        this._updateCarbonDioxideSensorService(accessory,  SERVICE_INFO.STDDEV, {level:theLevel, fault:false, resetPeak:value, active:value});
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

exports.default = main;
