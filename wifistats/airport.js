const cmdLine = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';

/**
 * Parses the output of the {@link cmdLine}.
 * We search for agrCtlRSSI and agrCtlNoise values.
 * The result is SNR the difference in decibels between the received signal
 * and the background noise level.
 *
 * @param {string} str - the string which is output of the command.
 * @param callback
 */
function parseOutput(str, callback) {
    try {
        var lines = str.split('\n');
        const resultValues = {};

        for (const line of lines) {
            var res = line.split(":");
            if (res.length > 1) {
                const key = res[0].trim();
                resultValues[key] = res[1].trim();
            }
        }

        const rssi = parseInt(resultValues.agrCtlRSSI, 10);
        const noise = parseInt(resultValues.agrCtlNoise, 10);

        callback(null, {
            signal: (rssi - noise)
        });
    }
    catch (ex) {
        callback(ex, null);
    }
}

module.exports = {
    parseOutput,
    cmdLine
};
