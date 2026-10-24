import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createDkimSigner } from "./dkim-signer.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const signer = createDkimSigner({ domain: "example.test", selector: "node01", privateKey });
const body = "Hello NODE01\r\n";
const signature = signer.sign({ body, headerMap: {
  From: "sender@example.test",
  To: "receiver@example.test",
  Subject: "DKIM test",
  Date: new Date().toUTCString(),
  "Message-ID": "<dkim-test@example.test>",
} });
assert.match(signature, /^DKIM-Signature: v=1;/);
const bValue = signature.match(/; b=(.+)$/)?.[1];
assert.ok(bValue);
const unsigned = signature.replace(bValue, "");
const signingInput = [
  "from:sender@example.test",
  "to:receiver@example.test",
  "subject:DKIM test",
  `date:${new Date().toUTCString()}`,
  "message-id:<dkim-test@example.test>",
  `dkim-signature:${unsigned.slice("DKIM-Signature: ".length)}`,
].join("\r\n");
const verified = crypto.createVerify("RSA-SHA256").update(signingInput, "utf8").verify(publicKey, bValue, "base64");
assert.equal(verified, true);
assert.match(signature, /bh=[A-Za-z0-9+/=]+/);
console.log("IZAKHONO DKIM signing tests PASSED");
