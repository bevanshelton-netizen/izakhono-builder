import Link from 'next/link';

export default function CommunityStandardsPage() {
  return (
    <main className="policyPage">
      <Link href="/" className="backLink">← Back to CONNECTA</Link>
      <div className="eyebrow">Community Standards</div>
      <h1>Connect freely. Abuse people and you lose access.</h1>
      <p className="lead">These standards apply to posts, comments, messages, profiles, groups, pages, live video, ads and marketplace activity. Confirmed zero-tolerance violations receive the same core enforcement: removal plus account disablement and a formal warning.</p>
      <ol className="standards">
        <li><strong>No cyberbullying or harassment.</strong> No targeted humiliation, coordinated abuse, stalking, repeated unwanted contact or encouragement of self-harm.</li>
        <li><strong>No threats or doxxing.</strong> No credible threats, intimidation, publication of private contact/location information or calls for others to attack someone.</li>
        <li><strong>No account cloning or impersonation.</strong> Do not copy another person&apos;s identity, handle, profile presentation or account in order to deceive others.</li>
        <li><strong>No child sexual exploitation.</strong> No sexual content involving minors, grooming, solicitation or facilitation.</li>
        <li><strong>No pornography.</strong> Explicit sexual material and commercial sexual-content promotion are not allowed.</li>
        <li><strong>No illegal drug trade or promotion.</strong> No buying, selling, distribution, recruitment or instructional facilitation of illegal drug activity.</li>
        <li><strong>No gang recruitment or criminal glorification.</strong> No recruiting into gangs or celebrating violent criminal conduct.</li>
        <li><strong>No scams or deceptive identity use.</strong> Fraud, phishing, fake payment requests and deceptive accounts are prohibited.</li>
        <li><strong>No malicious reporting.</strong> Knowingly false reports intended to silence or disable another person are prohibited.</li>
        <li><strong>Public-interest exceptions are contextual.</strong> News, education, prevention, research, recovery and history may discuss restricted subjects without promoting them.</li>
      </ol>
    </main>
  );
}
