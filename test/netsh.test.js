const netsh = require('./../wifistats/netsh');
const assert = require('assert');

const exampleNetshResult =
`    Name                   : Wi-Fi
    Description            : 1x1 11b/g/n Wireless LAN PCI Express Half Mini Card Adapter
    GUID                   : dbb1b23f-a12d-1dab-1234-6eca12ab1234
    Physical address       : e1:23:e4:ce:c5:f6
    State                  : connected
    SSID                   : SomeWifi
    BSSID                  : 55:22:33:44:55:66
    Network type           : Infrastructure
    Radio type             : 802.11n
    Authentication         : Open
    Cipher                 : None
    Connection mode        : Profile
    Channel                : 1
    Receive rate (Mbps)    : 58
    Transmit rate (Mbps)   : 58
    Signal                 : 80%
    Profile                : SomeWifi`;
const exampleIPAddressResult1 =
`Wireless LAN adapter Wi-Fi:

   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : 1x1 11b/g/n Wireless LAN PCI Express Half Mini Card Adapter
   Physical Address. . . . . . . . . : E1-23-E4-CE-C5-F6
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes
   IPv6 Address. . . . . . . . . . . : 2001:db8:21da:7:713e:a426:d167:37ab(Preferred)
   Temporary IPv6 Address. . . . . . : 2001:db8:21da:7:5099:ba54:9881:2e54
   Link-local IPv6 Address . . . . . : fe80::713e:a426:d167:37ab%6
   IPv4 Address. . . . . . . . . . . : 157.60.14.11(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . :
   DHCPv6 IAID . . . . . . . . . . . : 232785638
   DHCPv6 Client DUID. . . . . . . . : 00-01-00-01-1E-99-E0-56-B8-88-E3-EA-F5-7A
   DNS Servers . . . . . . . . . . . : fec0:0:0:ffff::1%1
                                       fec0:0:0:ffff::2%1
                                       fec0:0:0:ffff::3%1
   NetBIOS over Tcpip. . . . . . . . : Enabled`;
const exampleIPAddressResult2 =
`Wireless LAN adapter Wi-Fi:

   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : 1x1 11b/g/n Wireless LAN PCI Express Half Mini Card Adapter
   Physical Address. . . . . . . . . : E1-23-E4-CE-C5-F6
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes
   IPv6 Address. . . . . . . . . . . : 2001:db8:21da:7:713e:a426:d167:37ab
   Temporary IPv6 Address. . . . . . : 2001:db8:21da:7:5099:ba54:9881:2e54
   Link-local IPv6 Address . . . . . : fe80::713e:a426:d167:37ab%6
   IPv4 Address. . . . . . . . . . . : 157.60.14.11
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . :
   DHCPv6 IAID . . . . . . . . . . . : 232785638
   DHCPv6 Client DUID. . . . . . . . : 00-01-00-01-1E-99-E0-56-B8-88-E3-EA-F5-7A
   DNS Servers . . . . . . . . . . . : fec0:0:0:ffff::1%1
                                       fec0:0:0:ffff::2%1
                                       fec0:0:0:ffff::3%1
   NetBIOS over Tcpip. . . . . . . . : Enabled`;

describe('netsh', () => {
    describe('_parseNetshResults', () => {
        it('returns an object with signal values', () => {
            const result = netsh._parseNetshResults(exampleNetshResult);

            assert.equal(80, result.signal);
            assert.equal('Wi-Fi', result.interface);
        });
    });
    describe('_parseIPAddressResults', () => {
        it('returns an object with addresses values for example 1', () => {
            const result
                = netsh._parseIPConfigResults(exampleIPAddressResult1, 'Wi-Fi');

            assert.deepEqual([
                    '2001:db8:21da:7:713e:a426:d167:37ab',
                    '157.60.14.11'],
                result);
        });
        it('returns an object with addresses values for example 2', () => {
            const result
                = netsh._parseIPConfigResults(exampleIPAddressResult2, 'Wi-Fi');

            assert.deepEqual([
                    '2001:db8:21da:7:713e:a426:d167:37ab',
                    '157.60.14.11'],
                result);
        });
    });
});
