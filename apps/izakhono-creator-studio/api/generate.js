export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const body = req.body || {};
    const { brief = '', brand = 'IZAKHONO', channels = ['Instagram', 'Facebook', 'WhatsApp', 'Web'], mode = 'campaign' } = body;
    const b = String(brief).trim();
    if (!b) return res.status(400).json({ error: 'An instruction or question is required.' });
    const lower = b.toLowerCase();

    if (mode === 'view') {
      const view = /build|create|launch|should|recommend|best|priority|focus|first|strategy|model/.test(lower)
        ? 'Make IZAKHONO the operating system around the opportunity, not another isolated app. Prioritize the smallest revenue-producing workflow, connect payment + customer capture + delivery, then instrument it before adding more features.'
        : 'The strongest default is to turn the request into one measurable commercial workflow: objective → offer → audience → acquisition → conversion → delivery → measurement.';
      const priorities = [
        '1. Define the business outcome and one primary customer action.',
        '2. Build the shortest end-to-end workflow that can produce that outcome.',
        '3. Connect owned IZAKHONO infrastructure first; keep external services replaceable.',
        '4. Add payment, CRM/lead capture and WhatsApp where relevant.',
        '5. Measure conversion and repurpose successful outputs automatically.'
      ];
      return res.status(200).json({ ok: true, mode, engine: 'IZAKHONO CEO Command Centre', title: 'IZAKHONO\'s View', answer: view, priorities, recommendedAction: `EXECUTE: ${b}`, workflow: ['decide', 'plan', 'build', 'connect', 'measure', 'improve'] });
    }

    const school = /school|uniform|matric|learner/.test(lower);
    const product = /product|launch|sell|offer|store|catalogue/.test(lower);
    const lead = /lead|quote|enquir|book|contact/.test(lower);
    const title = school ? 'School Uniform Campaign 2027' : product ? 'Product Launch Campaign' : lead ? 'Lead Generation Campaign' : 'Brand Growth Campaign';
    const audience = school ? 'Schools, principals, procurement teams, parents and learners' : lead ? 'High-intent prospects who need the offered service or product' : 'Prospects who value quality, African relevance and dependable delivery';
    const headline = school ? 'Dress the future. Order your 2027 school uniforms now.' : product ? 'Turn your next launch into a campaign people can act on.' : 'Build attention. Build trust. Build the business.';
    const cta = school ? 'REQUEST THE 2027 SCHOOL UNIFORM CATALOGUE' : lead ? 'REQUEST A QUOTE ON WHATSAPP' : 'START YOUR CAMPAIGN TODAY';
    const copy = `${brand} turns one clear idea into a connected commercial campaign. ${b.charAt(0).toUpperCase() + b.slice(1).replace(/[.!?]+$/, '')}. Make the message clear, the offer compelling and the next action simple.`;
    const video = `15–30s vertical ad\nScene 1: Pattern-breaking opening with the strongest product/benefit.\nScene 2: Show quality, proof and real-world use.\nScene 3: State the offer and why it matters now.\nScene 4: ${cta}.\nVoice: confident, African, professional, energetic.`;
    const image = `Hero visual direction: premium commercial photography, authentic African context, strong subject focus, clean negative space for headline, ${school ? 'school-ready uniforms and diverse learners' : 'the product/service as the hero'}, editorial lighting, mobile-first composition.`;
    const landing = `Hero: ${headline}\nProof: quality • reliability • African relevance\nOffer: ${copy}\nSections: benefits → proof → products/services → FAQ → WhatsApp CTA\nPrimary CTA: ${cta}`;
    const whatsapp = `Greeting: Hi! Thanks for contacting ${brand}. 👋\nQualification: What product/service are you interested in?\nNeed: When do you need it?\nNext step: I can send the catalogue/quote and help you place the order.`;
    const social = channels.map(c => `${c}: Hook → benefit → proof → ${cta} → 3–5 relevant hashtags`).join('\n');
    const seo = `${title} | ${brand}`;
    return res.status(200).json({ ok: true, mode: 'campaign', engine: 'IZAKHONO Creator Engine v1', generatedAt: new Date().toISOString(), brief: b, title, audience, headline, cta, copy, assets: { video, image, landing, whatsapp, social, seo }, workflow: ['brief', 'plan', 'write', 'design', 'produce', 'approve', 'distribute', 'measure', 'repurpose'], channels });
  } catch (e) { return res.status(500).json({ error: 'Generation failed.' }); }
}
