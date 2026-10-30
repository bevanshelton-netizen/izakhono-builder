export type DataDomain =
  | 'identity'
  | 'communications'
  | 'payments'
  | 'location'
  | 'education'
  | 'business'
  | 'media'
  | 'preferences'
  | 'security';

export type Permission =
  | 'read:profile'
  | 'write:profile'
  | 'read:contacts'
  | 'write:contacts'
  | 'read:location'
  | 'read:files'
  | 'write:files'
  | 'read:mail'
  | 'send:mail'
  | 'read:calendar'
  | 'write:calendar'
  | 'read:payments'
  | 'initiate:payments'
  | 'read:education'
  | 'read:business'
  | 'write:business'
  | 'read:media'
  | 'publish:media';

export interface ServiceManifest {
  id: string;
  name: string;
  category: string;
  version: string;
  route: string;
  capabilities: string[];
  permissions: Permission[];
  dataDomains: DataDomain[];
  privacyClass: 'public' | 'personal' | 'sensitive' | 'restricted';
  ownedFirst: boolean;
  externalAdaptersReplaceable: boolean;
}

export interface ConsentGrant {
  subjectId: string;
  serviceId: string;
  permissions: Permission[];
  dataDomains: DataDomain[];
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  requiresConsent: boolean;
}
