/* global process */
const exec = require('child_process').exec;

const cmdLine = 'cat /proc/net/wireless';

/**
 * Parses the output of the {@link cmdLine}.
 * $ cat /proc/net/wireless
 * Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE
 * face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22
 * wlp6s0: 0000   48.  -62.  -256        0      0      0      0      0        0
 * We report link, level and noise.
 *
 * @param {string} str - the string which is output of the command.
 * @return {Promise}
 */
function parseOutput(str) {
    return new Promise((resolve, reject) => {
        try {
            let resultObj;
            try {
                resultObj = _parseProcWirelessResults(str);
            } catch (ex) {
                reject(ex);
                return;
            }

            // now let's get that interface address
            // The output should be like
            // inet 192.168.1.102/24 brd..... scope global ...
            // inet6 2605:...... scope global ...
            exec('ip address show dev ' + resultObj.interface,
                function (err, str) {
                    if (err) {
                        // cannot get interface address, lets submit whatever
                        // we have
                        resolve(resultObj);
                        return;
                    }

                    try {
                        resultObj.addresses = _parseIPAddressResults(str);
                        resolve(resultObj);
                    } catch (ex) {
                        // cannot get interface address, lets submit
                        // whatever we have
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
 * @returns {{
 *      interface: string,
 *      signal: number,
 *      rssi: number,
 *      noise: number,
 *      timestamp: number}}
 * @private
 */
function _parseProcWirelessResults(str) {
    const lines = str.split('\n');

    if (lines.length <= 2) {
        throw new Error('No wifi interface');
    }

    // we take the third line
    const line = lines[2];

    const elements = line.split(':');
    if (elements.length < 2) {
        throw new Error('No wifi interface - wrong format');
    }

    const iface = elements[0];
    const stats = elements[1].trim().split(/[ ]+/);

    return {
        interface: iface,
        signal: parseInt(stats[1], 10),
        rssi: parseInt(stats[2], 10),
        noise: parseInt(stats[3], 10),
        timestamp: Date.now()
    };
}

/**
 * Parses the ouptu of 'ip address show dev interfaceName' command.
 *
 * @param {string} str - the string which is output of the command.
 * @returns {Array} list of addresses.
 * @private
 */
function _parseIPAddressResults(str) {
    const lines = str.split('\n');
    const addresses = [];
    for (let line of lines) {
        line = line.trim();

        if (line.indexOf('scope global') == -1) {
            continue;
        }

        let addr;
        if (line.startsWith('inet6')) {
            addr = _extractAddress(line.substring(5));
        } else if (line.startsWith('inet')) {
            addr = _extractAddress(line.substring(4));
        }

        if (addr) {
            addresses.push(addr);
        }
    }
    return addresses;
}

/**
 * Extracts ip address from the line that may contain it:
 * inet 192.168.1.102/22 brd .....
 *
 * @param str the string containing the address.
 * @returns {string} the ipv4 or ipv6 address.
 * @private
 */
function _extractAddress(str) {
    const elements = str.trim().split(' ');
    const addr = elements[0];
    return addr.substring(0, addr.indexOf('/'));
}

const procWireless = {
    parseOutput,
    cmdLine
};

if (process.env.TESTING) {
    procWireless._parseProcWirelessResults = _parseProcWirelessResults;
    procWireless._parseIPAddressResults = _parseIPAddressResults;
}

module.exports = procWireless;
