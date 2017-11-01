const exec    = require('child_process').exec;
const async   = require('async');
// The tools
const airport = require('./airport');
const iwconfig  = require('./iwconfig');
const netsh   = require('./netsh');

var toolInstance;

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
                    cb(null, {err: err, tool: iwconfig, result: str});
                }, iwconfig);
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
 */
function getWiFiStats(callback) {
    if (!toolInstance) {
        initTools(
            (err, t, result) => {
                if (err) {
                    return callback(err);
                }
                toolInstance = t;
                callback(null, result);
            });
        return;
    }

    getStats(callback);
}

/**
 * Setup getWiFiStats to be available in JitsiMeetElectron object.
 *
 * @param iframe - the iframe to use attaching the getWiFiStats function.
 */
function setupWiFiStats(iframe) {
    iframe.addEventListener('load', () => {
        if (!iframe.contentWindow.JitsiMeetElectron) {
            iframe.contentWindow.JitsiMeetElectron = {};
        }

        iframe.contentWindow.JitsiMeetElectron.getWiFiStats = getWiFiStats;
    });
}

module.exports = {
    getWiFiStats: getWiFiStats,
    setupWiFiStats: setupWiFiStats
};
