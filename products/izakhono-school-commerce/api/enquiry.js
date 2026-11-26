export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const body = req.body || {};
  if (body.website_check) return res.status(200).json({ ok: true });
  const required = ["name", "email", "organisationType", "organisation", "message"];
  for (const key of required) {
    if (typeof body[key] !== "string" || !body[key].trim()) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SCHOOLWEAR_ENQUIRY_TO;
  const from = process.env.SCHOOLWEAR_ENQUIRY_FROM;
  if (!apiKey || !to || !from) {
    return res.status(503).json({ error: "Enquiry delivery is not configured yet. Please contact IZAKHONO directly to submit your request." });
  }
  const lines = [
    "New IZAKHONO Schoolwear supply enquiry",
    "",
    "Contact: " + body.name,
    "Role: " + (body.role || "Not provided"),
    "Email: " + body.email,
    "Phone: " + (body.phone || "Not provided"),
    "Organisation type: " + body.organisationType,
    "Organisation: " + body.organisation,
    "Location: " + (body.location || "Not provided"),
    "Estimated volume: " + (body.estimatedVolume || "Not provided"),
    "Products: " + (body.products || "Not specified"),
    "Selected catalogue items: " + ((Array.isArray(body.selectedProducts) ? body.selectedProducts : []).join(", ") || "None selected"),
    "",
    "Requirements:",
    body.message
  ];
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: body.email, subject: "Schoolwear supply enquiry — " + body.organisation, text: lines.join("\n") })
    });
    if (!response.ok) return res.status(502).json({ error: "The email service could not deliver your enquiry. Please try again later." });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "The email service is temporarily unavailable." });
  }
}