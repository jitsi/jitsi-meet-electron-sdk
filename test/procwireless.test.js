const procwireless = require('./../wifistats/procwireless');
const assert = require('assert');

const exampleProcWirelessResult =
`Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE
 face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22
wlp6s0: 0000   50.  -60.  -256        0      0      0      0      0        0`;
const exampleIPAddressResult =
`2: wlp6s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether c4:8e:8f:f8:06:0d brd ff:ff:ff:ff:ff:ff
    inet 157.60.14.11/22 brd 172.20.39.255 scope global wlp6s0
       valid_lft forever preferred_lft forever
    inet6 2001:db8:21da:7:713e:a426:d167:37ab/64 scope global noprefixroute 
       valid_lft forever preferred_lft forever   
    inet6 fe80::c68e:8fff:fef8:60d/64 scope link
       valid_lft forever preferred_lft forever`;

describe('procwireless', () => {
    describe('_parseProcWirelessResults', () => {
        it('returns an object with signal values', () => {
            const result = procwireless._parseProcWirelessResults(exampleProcWirelessResult);

            assert.equal(-256, result.noise);
            assert.equal(-60, result.rssi);
            assert.equal(50, result.signal);
            assert.equal('wlp6s0', result.interface);
        });
    });
    describe('_parseIPAddressResults', () => {
        it('returns an object with addresses values', () => {
            const result
                = procwireless._parseIPAddressResults(exampleIPAddressResult);

            assert.deepEqual([
                    '157.60.14.11',
                    '2001:db8:21da:7:713e:a426:d167:37ab'],
                result);
        });
    });
});
