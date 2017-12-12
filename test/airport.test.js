const airport = require('./../wifistats/airport');
const assert = require('assert');

const exampleAirportResult = `
     agrCtlRSSI: -64
     agrExtRSSI: 0
    agrCtlNoise: -92
    agrExtNoise: 0
          state: running
        op mode: station 
     lastTxRate: 600
        maxRate: 600
lastAssocStatus: 0
    802.11 auth: open
      link auth: wpa2
          BSSID: 0:f6:63:2c:68:ee
           SSID: Charlie
            MCS: 9
        channel: 116,1`;
const exampleNetworkSetupResult = `
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
	ether a4:5e:60:ec:7b:3d
	inet6 fe80::a65e:60ff:feec:7b3d%en0 prefixlen 64 scopeid 0x4
	inet6 2001:db8:21da:7:713e:a426:d167:37ab prefixlen 64 autoconf
	inet 157.60.14.11 netmask 0xfffffc00 broadcast 172.20.39.255
	nd6 options=1<PERFORMNUD>
	media: autoselect
	status: active`;

describe('airport', () => {
    describe('_parseAirportResults', () => {
        it('returns an object with signal values', () => {
            const result = airport._parseAirportResults(exampleAirportResult);

            assert.equal(-92, result.noise);
            assert.equal(-64, result.rssi);
            assert.equal(28, result.signal);
        });
    });
    describe('_parseNetworkSetupResults', () => {
        it('returns an object with addresses values', () => {
            const result
                = airport._parseNetworkSetupResults(exampleNetworkSetupResult);

            assert.equal('en0', result.interface);
            assert.deepEqual([
                    '2001:db8:21da:7:713e:a426:d167:37ab',
                    '157.60.14.11'],
                result.addresses);
        });
    });
});
