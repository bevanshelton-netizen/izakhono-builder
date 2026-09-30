# IZAKHONO REGISTRY CORE

Zero-cost-first registry-grade core for IZAKHONO DOMAIN.

This package is TLD-agnostic. It can run a private/test namespace today and later connect to authoritative registry infrastructure through adapters. It does not claim public root-zone delegation or .co.za production authority.

Core objects: domain, contact, host, registrar, lifecycle state, audit event.

Core interfaces: RegistryStore, RegistryAdapter, DnsProvider, RdapProvider, EppTransport.
