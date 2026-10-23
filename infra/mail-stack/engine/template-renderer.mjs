/**
 * IZAKHONO MAIL TEMPLATE RENDERER — renderer-provider boundary.
 * A renderer adapter can be replaced without changing the Mail API or templates.
 */

export class TemplateRenderer {
  constructor({ registry, renderer } = {}) {
    if (!registry) throw new Error("registry is required");
    if (!renderer || typeof renderer.render !== "function") throw new Error("renderer.render is required");
    this.registry = registry;
    this.renderer = renderer;
  }

  async render(templateId, data = {}, context = {}) {
    const tenantId = context.auth?.tenantId || context.tenantId || "system";
    const template = this.registry.get(templateId, { tenantId });
    if (!template) throw new Error(`template_not_found:${templateId}`);
    if (template.status !== "active") throw new Error(`template_not_active:${templateId}`);

    const output = await this.renderer.render(template.source, {
      data,
      context,
      template,
    });

    if (!output || typeof output !== "object") throw new Error("renderer_invalid_output");
    if (!output.html && !output.text) throw new Error("renderer_empty_output");

    return {
      html: output.html,
      text: output.text,
      templateId: template.id,
      templateVersion: template.version,
    };
  }
}

export function createRendererAdapter({ render }) {
  if (typeof render !== "function") throw new Error("render function is required");
  return { render };
}
