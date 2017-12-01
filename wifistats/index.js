const exec          = require('child_process').exec;
const async         = require('async');
// The tools
const airport       = require('./airport');
const procwireless  = require('./procwireless');
const netsh         = require('./netsh');

let toolInstance;

/**
 * Uses all available tools to query for wifi stats, and the one we found to
 * work we store in global variable {@link toolInstance}.
 * The result is returned to callback.
 * We call all tools in parallel and when all finishes we check the results.
 *
 * @callback callback delivering results
 * @param {Error} error if any
 * @param {object} result stats
 */
function initTools(callback) {
    async.parallel([
            function (cb) {
                getStats(
                    function (err, str) {
                        cb(null, {err: err, tool: airport, result: str});
                    }, airport);
            },
            function (cb) {
                getStats(function (err, str) {
                    cb(null, {err: err, tool: procwireless, result: str});
                }, procwireless);
            },
            function (cb) {
                getStats(function (err, str) {
                    cb(null, {err: err, tool: netsh, result: str});
                }, netsh);
            }
        ],
        function (err, results) {
            const res = results.find((r) => (r.err == null));
            if (res) {
                callback(null, res.tool, res.result);
            } else {
                callback(new Error('No known wifi stats tool found'));
            }
        }
    );
}

/**
 * Queries for wifi stats using a specific tool or if not specified, uses the
 * global one which we discover to be working.
 * @param tool - The tool to use querying for wifi stats.
 * @callback callback delivering results
 * @param {Error} error if any
 * @param {object} result stats
 */
function getStats(callback, tool) {
    if (!tool) {
        if (toolInstance) {
            tool = toolInstance;
        } else {
            callback(new Error('No known wifi stats tool found'));
        }
    }

    exec(tool.cmdLine, function (err, str) {
        if (err) {
            callback(err, null);
            return;
        }

        tool.parseOutput(str, callback);
    });
}

/**
 * Queries for wifi stats.
 * @callback callback delivering results
 * @param {Error} error if any
 * @param {object} result stats
 * @returns {Promise}
 */
function getWiFiStats() {
    return new Promise((resolve, reject) => {
        if (!toolInstance) {
            initTools(
                (err, t, result) => {
                    if (err) {
                        reject(err);
                    }
                    toolInstance = t;
                    resolve(result);
                });
            return;
        }

        getStats((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(JSON.stringify(result));
            }
        });
    });
}

/**
 * Setup getWiFiStats to be available in JitsiMeetElectron object.
 *
 * @param iframe - the iframe to use attaching the getWiFiStats function.
 */
function setupWiFiStats(iframe) {
    iframe.addEventListener('load', () => {
        const ctx = iframe.contentWindow;
        if(typeof ctx.JitsiMeetJS === "undefined")
            ctx.JitsiMeetJS = {};

        if(typeof ctx.JitsiMeetJS.app === "undefined")
            ctx.JitsiMeetJS.app = {};

        ctx.JitsiMeetJS.app.getWiFiStats = getWiFiStats;
    });
}

module.exports = {
    getWiFiStats: getWiFiStats,
    setupWiFiStats: setupWiFiStats
};
