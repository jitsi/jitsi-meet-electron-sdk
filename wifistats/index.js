/* global process */
const exec          = require('child_process').exec;

// The tools
const airport       = require('./airport');
const procwireless  = require('./procwireless');
const netsh         = require('./netsh');

let toolInstance;
let supportWifiStats = true;

/**
 * Uses all available tools to query for wifi stats, and the one we found to
 * work we store in global variable {@link toolInstance}, otherwise we set
 * supportWifiStats to false.
 * We call all tools in parallel and when all finishes we check the results.
 *
 * @return {Promise}
 */
function initTools() {
    const os = process.platform;
    let tool;

    // check for running OS and use appropriate tool
    if (os === 'win32') {
        tool = netsh;
    } else if (os === 'darwin') {
        tool = airport;
    } else if (os === 'linux') {
        tool = procwireless;
    }

    return new Promise((resolve, reject) => {
        getStats(tool).then(result => {
            toolInstance = tool;
            resolve(result);
        }).catch(error => {
            supportWifiStats = false;
            reject(error);
        });
    });
}

/**
 * Queries for wifi stats using a specific tool.
 * @param tool - The tool to use querying for wifi stats.
 * @return {Promise}
 */
function getStats(tool) {
    return new Promise((resolve, reject) => {
        exec(tool.cmdLine, function (error, str) {
            if (error) {
                reject(error);
                return;
            }

            tool.parseOutput(str)
                .then(result => resolve(JSON.stringify(result)))
                .catch(error => reject(error));
        });
    });
}

/**
 * Queries for wifi stats.
 * @returns {Promise}
 */
function getWiFiStats() {
    if (toolInstance) {
        return getStats(toolInstance);
    } else if (!supportWifiStats) {
        return Promise.reject(new Error('No known wifi stats tool found'));
    } else {
        return initTools();
    }
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
