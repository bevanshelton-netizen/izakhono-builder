import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

test("MobiSIM adapter authenticates worker requests before supplier calls", () => {
  assert.match(source, /ic_verify_provisioner_worker_token/);
  assert.ok(source.indexOf("ic_verify_provisioner_worker_token") < source.indexOf('action === "account_check"'));
});

test("only the non-billable TestBuy endpoint is exposed for purchase testing", () => {
  assert.match(source, /\/api\/Purchase\/TestBuy/);
  assert.match(source, /sendEmail: false/);
  assert.match(source, /wallet_charge_expected: false/);
  assert.match(source, /provider_contact_expected: false/);
  assert.doesNotMatch(source, /\/api\/Purchase\/Buy["']/);
  assert.doesNotMatch(source, /\/api\/Purchase\/TopUp["']/);
  assert.doesNotMatch(source, /\/api\/Wallet\/AddWalletBalance/);
});

test("test purchases enforce one unit and validate package id and email", () => {
  assert.match(source, /Number\(quantity\) !== 1/);
  assert.match(source, /Number\(packageId\) <= 0/);
  assert.match(source, /valid_test_buy_request/);
});

test("supplier credentials remain server-side and missing credentials fail closed", () => {
  assert.match(source, /Deno\.env\.get\("MOBISIM_API_KEY"\)/);
  assert.match(source, /supplier_credentials_not_configured/);
  assert.match(source, /production_enabled: false/);
});
