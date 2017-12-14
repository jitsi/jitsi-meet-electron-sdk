/* global process */
const exec = require('child_process').exec;

const systemRoot = process.env.SystemRoot || 'C:\\Windows';
const cmdLine    = systemRoot + '\\System32\\netsh.exe wlan show interfaces';

/**
 * Parses the output of the {@link cmdLine}.
 * We search for value of 'Signal'.
 *
 * @param {string} str - the string which is output of the command.
 * @return {Promise}
 */
function parseOutput(str) {
    return new Promise((resolve, reject) => {
        try {
            const resultObj = _parseNetshResults(str);

            if (!resultObj.interface) {
                // no interface found just post current results
                resolve(resultObj);
                return;
            }

            exec('ipconfig /all', function (err, str) {
                if (err) {
                    // cannot get interface address, lets submit whatever we have
                    resolve(resultObj);
                    return;
                }

                try {
                    resultObj.addresses
                        = _parseIPConfigResults(str, resultObj.interface);
                    resolve(resultObj);
                } catch (ex) {
                    // cannot get interface address, lets submit whatever we have
                    resolve(resultObj);
                }
            });
        } catch (ex) {
            reject(ex);
        }
    });
}

/**
 * Parses the output of {@link cmdLine}.
 *
 * @param {string} str - the string which is output of the command.
 * @returns {{interface: string, signal: any, timestamp: number}}
 * @private
 */
function _parseNetshResults(str) {
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

    return {
        interface: iface,
        signal: resultValues.Signal ?
            parseInt(resultValues.Signal.replace('%', ''), 10) : undefined,
        timestamp: Date.now()
    };
}

/**
 * Parses the output of `ipconfig /all`
 *
 * @param {string} str - the string which is output of the command.
 * @param {string} iface - The name of the interface to check.
 * @returns {Array} list of addresses.
 * @private
 */
function _parseIPConfigResults(str, iface) {
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
            let ipAddressEndIx = addrLine.indexOf('(');

            // sometimes the ip address ends with (Preferred) and sometimes not
            if (ipAddressEndIx === -1) {
                ipAddressEndIx = addrLine.length;
            }

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

    return addresses;
}

const netsh = {
    parseOutput,
    cmdLine
};

if (process.env.TESTING) {
    netsh._parseNetshResults = _parseNetshResults;
    netsh._parseIPConfigResults = _parseIPConfigResults;
}

module.exports = netsh;
