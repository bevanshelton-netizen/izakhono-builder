const tests = [
  '../registry/private-tld.test.ts',
  '../registry/conformance.test.ts',
  '../registry/dns.test.ts',
  '../registry/authority-adapter.test.ts',
  '../registry/rate-limit.test.ts',
  '../registry/transaction.test.ts',
  '../registry/registration-order.test.ts',
  '../registry/idempotency.test.ts',
];

for (const test of tests) {
  await import(new URL(test, import.meta.url));
}

console.log('IZAKHONO registry test suite passed');
