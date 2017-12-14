/* global process */
const exec = require('child_process').exec;

const cmdLine = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';
const cmdExtractWifiAddresses = 'DEVICE_OUT=`networksetup -listallhardwareports | grep -C1 Wi-Fi| grep Device` && DEVICE_OUT=${DEVICE_OUT/Device: /} && ifconfig $DEVICE_OUT';

/**
 * Parses the output of the {@link cmdLine}.
 * We search for agrCtlRSSI and agrCtlNoise values and also calculate SNR.
 * SNR(Signal-to-noise ratio) the difference in decibels between the received
 * signal and the background noise level.
 *
 * @param {string} str - the string which is output of the command.
 * @return {Promise}
 */
function parseOutput(str) {
    return new Promise((resolve, reject) => {
        try {
            const resultObj = _parseAirportResults(str);

            exec(cmdExtractWifiAddresses, function (err, str) {
                if (err) {
                    // cannot get interface address, lets submit whatever we have
                    resolve(resultObj);
                    return;
                }

                try {
                    const networkSetupResult = _parseNetworkSetupResults(str);

                    resolve(Object.assign({}, resultObj, networkSetupResult));
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
 * Parses airport command results.
 *
 * @param {string} str - the string which is output of the command.
 * @returns {{signal: number, rssi: number, noise: number, timestamp: number}}
 * @private
 */
function _parseAirportResults(str) {
    const lines = str.split('\n');
    const resultValues = {};

    for (const line of lines) {
        const res = line.split(":");
        if (res.length > 1) {
            const key = res[0].trim();
            resultValues[key] = res[1].trim();
        }
    }

    const rssi = parseInt(resultValues.agrCtlRSSI, 10);
    const noise = parseInt(resultValues.agrCtlNoise, 10);
    return {
        signal: (rssi - noise),
        rssi,
        noise,
        timestamp: Date.now()
    };
}

/**
 * Parses the output of the {@link cmdExtractWifiAddresses} command.
 *
 * @param {string} str - the string which is output of the command.
 * @returns {{addresses: Array, interface: string}}
 * @private
 */
function _parseNetworkSetupResults(str) {
    // the string start with interface name
    const interfaceName = str.substring(0, str.indexOf(':')).trim();

    const lines = str.split('\n');
    const addresses = [];
    for (let line of lines) {
        line = line.trim();

        // skip local link address
        if (line.indexOf('scopeid') != -1) {
            continue;
        }

        let addrLine;
        if (line.startsWith('inet6')) {
            addrLine = line.substring(5);
        } else if (line.startsWith('inet')) {
            addrLine = line.substring(4);
        }

        if (addrLine) {
            const elements = addrLine.trim().split(' ');
            addresses.push(elements[0]);
        }
    }

    return {
        addresses,
        interface: interfaceName
    };
}

const airport = {
    parseOutput,
    cmdLine
};

if (process.env.TESTING) {
    airport._parseAirportResults = _parseAirportResults;
    airport._parseNetworkSetupResults = _parseNetworkSetupResults;
}

module.exports = airport;
