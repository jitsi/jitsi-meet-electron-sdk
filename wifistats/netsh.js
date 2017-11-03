/* global process */
const exec = require('child_process').exec;

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
        const lines = str.split('\n');
        const resultValues = {};

        for (const line of lines) {
            const res = line.split(":");
            if (res.length > 1) {
                const key = res[0].trim();
                resultValues[key] = res[1].trim();
            }
        }
        const iface = resultValues.Name;
        const resultObj = {
            interface: iface,
            signal: resultValues.Signal ?
                parseInt(resultValues.Signal.replace('%', ''), 10) : undefined,
            timestamp: Date.now()
        };

        if (!iface) {
            // no interface found just post current results
            callback(null, resultObj);
            return;
        }

        exec('ipconfig /all', function (err, str) {
            if (err) {
                // cannot get interface address, lets submit whatever we have
                callback(null, resultObj);
                return;
            }

            try {
                const lines = str.split('\n');
                const addresses = [];
                let ifaceFound = false;
                // if we have 2 empty lines after finding an interface
                // we have reached its config
                let emptyLines = 0;
                for (let line of lines) {
                    line = line.trim();

                    if (line.indexOf(iface + ':') != -1) {
                        ifaceFound = true;
                        continue;
                    }

                    if (!ifaceFound) {
                        continue;
                    }

                    if (line.length == 0) {
                        emptyLines++;
                    }

                    if (emptyLines == 2) {
                        break;
                    }

                    let addrLine;
                    if (line.startsWith('IPv6 Address')) {
                        addrLine = line;
                    } else if (line.startsWith('IPv4 Address')) {
                        addrLine = line;
                    }

                    if (addrLine) {
                        const separatorIx = addrLine.indexOf(':');
                        const ipAddressEndIx = addrLine.indexOf('(');

                        if (separatorIx != -1
                            && ipAddressEndIx != -1
                            && separatorIx < ipAddressEndIx) {
                            addresses.push(
                                addrLine.substring(
                                    separatorIx + 1,
                                    ipAddressEndIx).trim());
                        }
                    }
                }

                resultObj.addresses = addresses;
                callback(null, resultObj);
            } catch (ex) {
                // cannot get interface address, lets submit whatever we have
                callback(null, resultObj);
            }
        });
    } catch (ex) {
        callback(ex, null);
    }
}

module.exports = {
    parseOutput,
    cmdLine
};
