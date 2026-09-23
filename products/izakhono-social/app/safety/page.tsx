import Link from 'next/link';

export default function SafetyPage() {
  return (
    <main className="policyPage">
      <Link href="/" className="backLink">← Back to CONNECTA</Link>
      <div className="eyebrow">Safety Centre</div>
      <h1>Zero tolerance for abuse. Protection comes first.</h1>
      <p className="lead">CONNECTA is designed to stop cyberbullying, threats, doxxing, impersonation, account cloning and other prohibited conduct quickly while preserving an appeal path against false reports.</p>
      <div className="policyGrid">
        <section><h2>Cyberbullying is prohibited</h2><p>Targeted humiliation, harassment, threats, coordinated abuse, stalking, doxxing and encouragement of self-harm are not allowed. High-confidence prohibited content is blocked and can trigger immediate account disablement.</p></section>
        <section><h2>Report → immediate safety lock</h2><p>A safety report immediately separates the accounts, revokes the reported account&apos;s active sessions and places it under a temporary safety restriction while the case is reviewed. This prevents continued contact during review.</p></section>
        <section><h2>Confirmed violation → disabled</h2><p>When a violation is confirmed, the account is disabled, violating content is removed and a formal CONNECTA Safety &amp; Legal Compliance Warning is issued. Relevant evidence can be preserved and serious unlawful or dangerous conduct may be escalated where permitted or required by law.</p></section>
        <section><h2>Anti-cloning protection</h2><p>Protected account identities reserve their profile identity against suspicious look-alikes. CONNECTA checks handle similarity, records impersonation alerts and rejects registration attempts that closely mimic a protected identity.</p></section>
        <section><h2>False reports are violations too</h2><p>Reporting is a safety tool, not a weapon. Deliberately false or malicious reports can themselves result in enforcement under the same Community Standards.</p></section>
        <section><h2>Appeals remain available</h2><p>Temporary locks and confirmed enforcement decisions can be appealed. A suspended account cannot regain normal access merely by appealing; restoration requires a safety-review decision.</p></section>
        <section><h2>Other zero-tolerance areas</h2><p>Sexual exploitation of minors, pornography, illegal drug dealing or promotion, gang recruitment, violent criminal glorification, scams and impersonation are prohibited.</p></section>
        <section><h2>Context still matters</h2><p>Journalism, education, recovery, prevention, research, history and legitimate public-interest discussion are not violations merely because they discuss a restricted topic without promoting or facilitating harm.</p></section>
      </div>
    </main>
  );
}
