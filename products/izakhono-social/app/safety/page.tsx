import Link from 'next/link';

export default function SafetyPage() {
  return (
    <main className="policyPage">
      <Link href="/" className="backLink">← Back to IZAKHONO SOCIAL</Link>
      <div className="eyebrow">Safety Centre</div>
      <h1>Safety is part of the product architecture.</h1>
      <p className="lead">We do not build engagement by rewarding harmful material. People can report content, block accounts and appeal moderation decisions.</p>
      <div className="policyGrid">
        <section><h2>Zero-tolerance areas</h2><p>Sexual exploitation of minors, child sexual content, pornography, illegal drug dealing or promotion, gang recruitment, and violent criminal glorification are prohibited.</p></section>
        <section><h2>Context matters</h2><p>Journalism, education, recovery, prevention, research, history and legitimate public-interest discussion can be allowed when they do not facilitate abuse or criminal activity.</p></section>
        <section><h2>Minors</h2><p>Accounts and experiences for younger users require stronger privacy defaults, messaging restrictions, reporting controls and age-appropriate discovery.</p></section>
        <section><h2>Appeals</h2><p>Automated signals do not get the final word on borderline content. Users can appeal and trained reviewers can restore legitimate material.</p></section>
      </div>
    </main>
  );
}
