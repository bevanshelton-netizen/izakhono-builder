export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | 'SOA';

export type DnsRecord = {
  id: string;
  name: string;
  type: DnsRecordType;
  ttl: number;
  value: string;
  priority?: number;
  enabled: boolean;
};

export type DnsZone = {
  id: string;
  customerId: string;
  zoneName: string;
  serial: number;
  primaryNameserver: string;
  secondaryNameserver: string;
  status: 'planned' | 'active' | 'paused' | 'failed';
};

const VALID_TYPES = new Set<DnsRecordType>(['A','AAAA','CNAME','MX','TXT','NS','SRV','CAA','SOA']);

export function normalizeZoneName(input: string): string {
  const name = input.trim().toLowerCase().replace(/\.+$/, '');
  if (!name || name.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name)) throw new Error('invalid zone name');
  return name;
}

export function validateDnsRecord(record: Omit<DnsRecord, 'id'>): void {
  if (!VALID_TYPES.has(record.type)) throw new Error(`unsupported DNS type: ${record.type}`);
  if (!record.name || record.name.length > 253) throw new Error('invalid record name');
  if (!Number.isInteger(record.ttl) || record.ttl < 30 || record.ttl > 86400) throw new Error('TTL must be 30..86400 seconds');
  if (!record.value || record.value.length > 4096) throw new Error('invalid record value');
  if (record.type === 'MX' && (!Number.isInteger(record.priority) || (record.priority as number) < 0 || (record.priority as number) > 65535)) throw new Error('MX priority required and must be 0..65535');
}

export function nextSerial(previous: number, now = new Date()): number {
  const ymd = now.toISOString().slice(0, 10).replaceAll('-', '');
  const base = Number(`${ymd}01`);
  return previous >= base ? previous + 1 : base;
}

/** Public authoritative nameservers live below a separately delegated authority domain. */
export function defaultAuthoritativeNameservers(zone: string, authorityDomain = process.env.IZAKHONO_DNS_AUTHORITY_DOMAIN ?? 'dns.izakhono.invalid'): [string, string] {
  normalizeZoneName(zone);
  const authority = authorityDomain.trim().toLowerCase().replace(/\.+$/, '');
  if (!authority || authority.endsWith('.invalid')) throw new Error('IZAKHONO_DNS_AUTHORITY_DOMAIN must be configured to a registered authority domain before production use');
  return [`ns1.${authority}`, `ns2.${authority}`];
}

export function buildSoa(zone: DnsZone, minimum = 300): DnsRecord {
  return { id: `${zone.id}:soa`, name: zone.zoneName, type: 'SOA', ttl: 300, value: `${zone.primaryNameserver}. hostmaster.${zone.zoneName}. ${zone.serial} 3600 600 1209600 ${minimum}`, enabled: true };
}

export function buildNs(zone: DnsZone): DnsRecord[] {
  return [zone.primaryNameserver, zone.secondaryNameserver].map((value, i) => ({ id: `${zone.id}:ns:${i + 1}`, name: zone.zoneName, type: 'NS', ttl: 300, value, enabled: true }));
}

export function allegroMigrationRecords(): Array<Omit<DnsRecord, 'id'>> {
  return [
    { name: '@', type: 'A', ttl: 300, value: '216.198.79.1', enabled: true },
    { name: 'www', type: 'CNAME', ttl: 300, value: '07c410584da92c16.vercel-dns-017.com.', enabled: true },
  ];
}
