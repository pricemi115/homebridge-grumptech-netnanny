/* ==========================================================================
   File:               spawnHelper.js
   Class:              Spawn Helper
   Description:	       Wrapper for managing spawned tasks.
   Copyright:          Dec 2020
   ========================================================================== */
'use strict';

// External dependencies and imports.
const _debug    = require('debug')('spawn_helper');
const { spawn } = require('child_process');
import EventEmitter from 'events';

// Bind debug to console.log
_debug.log = console.log.bind(console);

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
export class SpawnHelper extends EventEmitter {
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
        if ( (!Object.prototype.hasOwnProperty.call(request, 'command'))   ||
             (typeof(request.command) !== 'string') ||
             (request.command.length <= 0)            ) {
            throw new TypeError('request.command must be a non-zero length string.');
        }
        // If we got this far, then request.command mus be legit.
        this._command = request.command;

        // Validate 'optional' arguments request
        if (Object.prototype.hasOwnProperty.call(request, 'arguments')) {
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
        if (Object.prototype.hasOwnProperty.call(request, 'options')) {
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
    // eslint-disable-next-line no-unused-vars
    _process_message(message, sendHandle) {
        // TODO: Not sure if I need this.
        _debug(`Child Process for ${this.Command}: '${message}'`);
    }

 /* ========================================================================
    Description:    Event handler for the Child Process Error Notification

    @param { <Error> } [error] - The error
    ======================================================================== */
    _process_error(error) {
        // Log the error info.
        _debug(`Child Process for ${this.Command}: error_num:${error.number} error_name:${error.name} error_msg:${error.message}`);

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
        _debug(`Child Process for ${this.Command}: exit_code:${code} by signal:'${signal}'`);

        // Indicate that we are done.
        this._pending = false;

        // Notify our clients.
        const isValid = this.IsValid;
        const response = {valid:isValid, result:(isValid ? this.Result : this.Error), source:this};
        this.emit('complete', response);
    }
}
