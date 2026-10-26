import Link from 'next/link';

const actions = [
  ['Adopt an organisation', 'Choose a verified NPO or NGO and become its champion.'],
  ['Start a fundraiser', 'Tell a real story, set a transparent goal, and invite Good Samaritans to help.'],
  ['Nominate an organisation', 'Add a community organisation that should be considered for verification.'],
  ['Give goods or skills', 'Support a cause with equipment, food, clothing, technology, transport, or professional time.'],
];

const causes = ['Education', 'Youth', 'Food security', 'Women & families', 'Disability', 'Community development', 'Health', 'Arts & culture', 'Sport', 'Environment'];

export default function AdoptASpotPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">CONNECTA IMPACT</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Adopt-a-Spot™</h1>
          <p className="mt-6 text-xl leading-8 text-zinc-300">Our GoFundMe-style home for Good Samaritans who want to help change lives — one person, project, organisation, or community at a time.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/benefits" className="rounded-full bg-emerald-500 px-5 py-3 font-semibold text-black">Visit Benefits</Link>
            <button className="rounded-full border border-zinc-700 px-5 py-3 font-semibold">Start a fundraiser</button>
            <button className="rounded-full border border-zinc-700 px-5 py-3 font-semibold">Nominate an organisation</button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
            </article>
          ))}
        </div>

        <section className="mt-14 rounded-3xl border border-emerald-900/60 bg-emerald-950/20 p-7 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Good Samaritans</p>
          <h2 className="mt-2 text-3xl font-bold">Find a cause worth backing.</h2>
          <p className="mt-3 max-w-2xl text-zinc-300">Browse verified organisations and community campaigns. CONNECTA will clearly distinguish verified organisations, community nominations, active fundraisers, and completed impact.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {causes.map((cause) => <button key={cause} className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200">{cause}</button>)}
          </div>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-3">
          <div><p className="text-3xl font-bold">100%</p><p className="mt-1 text-zinc-400">transparent campaign goals</p></div>
          <div><p className="text-3xl font-bold">Global</p><p className="mt-1 text-zinc-400">communities can nominate organisations</p></div>
          <div><p className="text-3xl font-bold">Impact</p><p className="mt-1 text-zinc-400">evidence and updates after support</p></div>
        </section>

        <p className="mt-14 max-w-3xl text-sm leading-6 text-zinc-500">CONNECTA does not treat a nomination as an endorsement. Organisations and fundraisers must pass applicable verification, safety, fraud, legal, payment, and beneficiary-protection controls before claims are presented as verified. No real donation, partner, beneficiary, target, or outcome is fabricated by this page.</p>
      </section>
    </main>
  );
}
