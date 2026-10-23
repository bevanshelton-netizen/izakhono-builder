import assert from "node:assert/strict";
import { TemplateRegistry } from "./template-registry.mjs";
import { TemplateRenderer } from "./template-renderer.mjs";

const registry = new TemplateRegistry({ clock: () => "2026-10-23T00:00:00.000Z" });
registry.register({ id: "welcome", name: "Welcome", schemaVersion: "1.0", source: { rows: [] } }, { tenantId: "t1" });
const version2 = registry.register({ id: "welcome", name: "Welcome v2", schemaVersion: "1.0", source: { rows: [{ text: "Hello" }] } }, { tenantId: "t1", actor: "admin" });
assert.equal(version2.version, 2);
assert.equal(registry.get("welcome", { tenantId: "t1" }).version, 2);
assert.equal(registry.get("welcome", { tenantId: "t2" }), null);
assert.equal(registry.archive("welcome", { tenantId: "t1" }).status, "archived");
assert.equal(registry.activate("welcome", { tenantId: "t1" }).status, "active");

const renderer = new TemplateRenderer({
  registry,
  renderer: { async render(source, options) { return { html: `<p>${source.rows[0].text}</p>`, text: source.rows[0].text }; } },
});
const rendered = await renderer.render("welcome", {}, { auth: { tenantId: "t1" } });
assert.equal(rendered.html, "<p>Hello</p>");
assert.equal(rendered.templateVersion, 2);

await assert.rejects(() => renderer.render("missing", {}, { auth: { tenantId: "t1" } }), /template_not_found/);
await assert.rejects(() => renderer.render("welcome", {}, { auth: { tenantId: "t2" } }), /template_not_found/);

console.log("template registry/renderer tests passed");
