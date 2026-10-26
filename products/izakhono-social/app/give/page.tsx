import Link from 'next/link';

const campaignTypes = [
  'Emergency help', 'Education', 'Food security', 'Housing', 'Health', 'Youth',
  'Women & families', 'Disability', 'Community projects', 'Disaster response', 'Other'
];

export default function GivePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <Link href="/adopt-a-spot" className="text-sm font-semibold text-emerald-400">← Adopt-a-Spot™</Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">CONNECTA GIVING</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">Good Samaritans can help change lives.</h1>
          <p className="mt-6 text-xl leading-8 text-zinc-300">A social fundraising home for real people, verified organisations and community projects that need a helping hand.</p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <article className="rounded-3xl border border-emerald-900/70 bg-emerald-950/20 p-7 lg:col-span-2">
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">Build the giving engine</span>
            <h2 className="mt-5 text-2xl font-bold">Start a campaign</h2>
            <p className="mt-2 max-w-xl text-zinc-400">Create a transparent goal, tell the story, identify the beneficiary, and submit for the appropriate verification and payment checks.</p>
            <button className="mt-6 rounded-full bg-emerald-500 px-5 py-3 font-semibold text-black">Create fundraiser</button>
            <p className="mt-4 text-xs leading-5 text-zinc-500">Campaign creation is currently a product interface placeholder. No real money is collected by this page.</p>
          </article>
          <article className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="text-xl font-bold">Have a community to add?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Nominate an NPO, NGO, school, project or grassroots organisation for Adopt-a-Spot verification.</p>
            <Link href="/adopt-a-spot" className="mt-6 inline-block font-semibold text-emerald-400">Nominate an organisation →</Link>
          </article>
        </div>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Discover causes</p><h2 className="mt-2 text-3xl font-bold">What do you want to change?</h2></div>
            <span className="text-sm text-zinc-500">Verified campaigns will appear here when connected to the giving engine.</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {campaignTypes.map((type) => <button key={type} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-left font-semibold hover:border-emerald-700">{type}<span className="mt-1 block text-xs font-normal text-zinc-500">Explore campaigns</span></button>)}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 sm:p-10">
          <h2 className="text-2xl font-bold">Trust before transfer.</h2>
          <p className="mt-3 max-w-3xl text-zinc-400">CONNECTA will clearly show verification status, campaign goal, payment state, updates and impact evidence. A nomination is not an endorsement, and a displayed campaign does not mean funds have been received or delivered.</p>
        </section>
      </section>
    </main>
  );
}
