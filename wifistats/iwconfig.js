const cmdLine = 'iwconfig';

/**
 * Parses the output of the {@link cmdLine}.
 * The different implementations of 'iwconfig' can return line:
 * "Quality=40/70  Signal level=-70 dBm"
 * or
 * "Signal level=40/70".
 * The result passed to the callback will be the value '40/70'.
 *
 * @param {string} str - the string which is output of the command.
 * @param callback
 */
function parseOutput(str, callback) {
    try {
        var lines = str.split('\n');
        var quality;

        for (const line of lines) {
            if (line.indexOf('Signal level') > -1) {
                var qIx;
                if ((qIx = line.indexOf('Quality')) > -1) {
                    // This is a "Quality=40/70  Signal level=-70 dBm" line
                    const endIx = line.indexOf(' ', qIx);
                    const qualityStr = line.substring(qIx + 8, endIx);
                    if (qualityStr.indexOf('/') > 0) {
                        quality = qualityStr;
                    }
                }
                else {
                    // This is a "Signal level=60/100" line
                    var elements = line.split('=');
                    elements.forEach(e => {
                        if (e.indexOf('/') > 0) {
                            // that's our part
                            quality = e;
                        }
                    });
                }
            }
        }

        if (!quality) {
            callback(null, {});
        }

        var parts = quality.split('/');
        var level
            = Math.floor(100 * parseInt(parts[0], 10) / parseInt(parts[1], 10));

        callback(null, {
            signal: level
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
