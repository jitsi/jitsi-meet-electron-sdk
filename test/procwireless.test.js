import { _parseProcWirelessResults, _parseIPAddressResults } from './../wifistats/procwireless';
import { equal, deepEqual } from 'assert';

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
            const result = _parseProcWirelessResults(exampleProcWirelessResult);

            equal(-256, result.noise);
            equal(-60, result.rssi);
            equal(50, result.signal);
            equal('wlp6s0', result.interface);
        });
    });
    describe('_parseIPAddressResults', () => {
        it('returns an object with addresses values', () => {
            const result
                = _parseIPAddressResults(exampleIPAddressResult);

            deepEqual([
                    '157.60.14.11',
                    '2001:db8:21da:7:713e:a426:d167:37ab'],
                result);
        });
    });
});
