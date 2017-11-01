/* global process */
const systemRoot = process.env.SystemRoot || 'C:\\Windows';
const cmdLine    = systemRoot + '\\System32\\netsh.exe wlan show interfaces';

/**
 * Parses the output of the {@link cmdLine}.
 * We search for value of 'Signal'.
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

        callback(null, {
            signal: resultValues.Signal ?
                parseInt(resultValues.Signal.replace('%', ''), 10) : undefined
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
