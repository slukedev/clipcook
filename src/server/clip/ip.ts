import net from 'node:net'

// Every range a server-side fetch must never reach: loopback, private, link-local,
// CGNAT, benchmarking, documentation, multicast, and IPv6 transition prefixes that
// can embed one of those IPv4 addresses.
const BLOCKED_V4: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
]

const BLOCKED_V6: Array<[string, number]> = [
    ['::', 128],
    ['::1', 128],
    ['::', 96], // IPv4-compatible (deprecated)
    ['64:ff9b::', 96], // NAT64 well-known prefix
    ['64:ff9b:1::', 48], // NAT64 local-use
    ['100::', 64], // discard-only
    ['2001::', 32], // Teredo
    ['2001:2::', 48], // benchmarking
    ['2001:10::', 28], // ORCHID
    ['2001:20::', 28], // ORCHIDv2
    ['2001:db8::', 32], // documentation
    ['2002::', 16], // 6to4
    ['3fff::', 20], // documentation (RFC 9637)
    ['5f00::', 16], // SRv6 SIDs
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link-local
    ['fec0::', 10], // site-local (deprecated)
    ['ff00::', 8], // multicast
]

// Separate lists: a single BlockList treats IPv4 as IPv4-mapped IPv6, so an IPv6
// rule like ::/96 would otherwise swallow every IPv4 address.
const blockedV4 = new net.BlockList()
const blockedV6 = new net.BlockList()
for (const [address, prefix] of BLOCKED_V4) blockedV4.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of BLOCKED_V6) blockedV6.addSubnet(address, prefix, 'ipv6')

/** Expands an IPv6 literal into 8 numeric groups, or null when it is not one. */
function ipv6Groups(address: string): number[] | null {
    if (!net.isIPv6(address)) return null
    let text = address.toLowerCase()
    const tail: number[] = []
    const lastColon = text.lastIndexOf(':')
    const maybeV4 = text.slice(lastColon + 1)
    if (net.isIPv4(maybeV4)) {
        const [a, b, c, d] = maybeV4.split('.').map(Number) as [number, number, number, number]
        tail.push((a << 8) | b, (c << 8) | d)
        const prefix = text.slice(0, lastColon + 1)
        text = prefix.endsWith('::') ? prefix : prefix.slice(0, -1)
    }
    const [head = '', rest] = text.split('::') as [string, string | undefined]
    const parse = (part: string) => (part ? part.split(':').map((g) => Number.parseInt(g, 16)) : [])
    const left = parse(head)
    const right = parse(rest ?? '')
    const fill = rest === undefined ? 0 : 8 - tail.length - left.length - right.length
    const groups = [...left, ...new Array<number>(Math.max(0, fill)).fill(0), ...right, ...tail]
    return groups.length === 8 ? groups : null
}

/** The IPv4 address embedded in an IPv4-mapped or -compatible IPv6 address. */
function embeddedV4(groups: number[]): string | null {
    const prefixZero = groups.slice(0, 5).every((g) => g === 0)
    if (!prefixZero || (groups[5] !== 0xffff && groups[5] !== 0)) return null
    const hi = groups[6] ?? 0
    const lo = groups[7] ?? 0
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

/** True when the address is not a routable public unicast address. Unknown input counts as blocked. */
export function isBlockedAddress(input: string): boolean {
    const address = input.split('%')[0] ?? ''
    if (net.isIPv4(address)) return blockedV4.check(address, 'ipv4')
    const groups = ipv6Groups(address)
    if (!groups) return true
    const v4 = embeddedV4(groups)
    if (v4) return groups[5] === 0 || blockedV4.check(v4, 'ipv4')
    return blockedV6.check(address, 'ipv6')
}
