import {
  renderAsteriskPjsipExtensions,
  renderAsteriskRuntimeConfig,
} from "./asterisk-config";

const rendered = renderAsteriskPjsipExtensions([
  {
    extension: "1001",
    username: "user1001",
    secretRef: "secret://tenant/1001",
    secret: "unit-test-secret",
  },
]);

if (!rendered.includes("[1001-auth]")) throw new Error("missing_auth_section");
if (!rendered.includes("username=user1001")) throw new Error("missing_username");
if (!rendered.includes("password=unit-test-secret")) throw new Error("missing_password");
if (!rendered.includes("[1001-aor]")) throw new Error("missing_aor");
if (!rendered.includes("[1001](endpoint-template)")) throw new Error("missing_endpoint");

const config = renderAsteriskRuntimeConfig(
  [{
    extension: "1001",
    username: "user1001",
    secretRef: "secret://tenant/1001",
    secret: "unit-test-secret",
  }],
  [{ number: "+27110000001", destination: "1001" }],
  [],
);

if (!config.pjsipFragment.includes("password=unit-test-secret")) throw new Error("missing_rendered_pjsip");
if (!config.extensionsFragment.includes("+27110000001 = PJSIP/1001")) throw new Error("missing_inbound_route");

let rejected = false;
try {
  renderAsteriskPjsipExtensions([{
    extension: "1002",
    username: "user1002",
    secretRef: "secret://tenant/1002",
    secret: "bad\nsecret",
  }]);
} catch (error) {
  rejected = error instanceof Error && error.message === "invalid_asterisk_secret";
}
if (!rejected) throw new Error("secret_validation_failed");

console.log("ASTERISK_CONFIG_TEST_PASS");
