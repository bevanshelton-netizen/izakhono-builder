import Link from 'next/link';

export default function CommunityStandardsPage() {
  return (
    <main className="policyPage">
      <Link href="/" className="backLink">← Back to CONNECTA</Link>
      <div className="eyebrow">Community Standards</div>
      <h1>Connect freely. Do not exploit people.</h1>
      <p className="lead">These launch standards apply to posts, comments, messages, profiles, groups, pages, live video, ads and marketplace activity.</p>
      <ol className="standards">
        <li><strong>No child sexual exploitation.</strong> No sexual content involving minors, grooming, solicitation or facilitation.</li>
        <li><strong>No pornography.</strong> Explicit sexual material and commercial sexual-content promotion are not allowed.</li>
        <li><strong>No illegal drug trade or promotion.</strong> No buying, selling, distribution, recruitment or instructional facilitation of illegal drug activity.</li>
        <li><strong>No gang recruitment or criminal glorification.</strong> No recruiting into gangs or celebrating violent criminal conduct.</li>
        <li><strong>No targeted abuse.</strong> Threats, stalking, doxxing and coordinated harassment are prohibited.</li>
        <li><strong>No scams or impersonation.</strong> Fraud, deceptive identity use and manipulated payment requests are prohibited.</li>
        <li><strong>Public-interest exceptions are contextual.</strong> News, education, prevention, research, recovery and history may discuss restricted subjects without promoting them.</li>
      </ol>
    </main>
  );
}
