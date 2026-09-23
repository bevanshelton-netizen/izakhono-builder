'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

type Post = {
  id: number;
  author: string;
  handle: string;
  time: string;
  text: string;
  badge?: string;
  likes: number;
  comments: number;
};

const seedPosts: Post[] = [
  {
    id: 1,
    author: 'Lerato Mokoena',
    handle: '@lerato.m',
    time: '12 min',
    text: 'Johannesburg creatives: our community design meetup is Saturday. Bring one idea you want to turn into something real.',
    badge: 'Community host',
    likes: 248,
    comments: 41,
  },
  {
    id: 2,
    author: 'Thabo Nkosi',
    handle: '@thabonkosi',
    time: '38 min',
    text: 'Local football trials this weekend. Coaches, parents and players can join the Gauteng Grassroots Football group for the schedule.',
    likes: 511,
    comments: 63,
  },
  {
    id: 3,
    author: 'Amina Diallo',
    handle: '@amina.builds',
    time: '1 hr',
    text: 'What if social media measured value by meaningful replies instead of how long it could keep us scrolling?',
    badge: 'Verified creator',
    likes: 922,
    comments: 116,
  },
];

const nav = ['Home', 'Notifications', 'Connections', 'Communities', 'Messages', 'Pages', 'Events', 'Watch', 'Marketplace'];

export default function SocialShell() {
  const [posts, setPosts] = useState(seedPosts);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [active, setActive] = useState('Home');

  const totalConversation = useMemo(() => posts.reduce((sum, post) => sum + post.comments, 0), [posts]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setStatus('Checking your post against the Community Standards…');
    const response = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();
    const decision = result?.decision;

    if (decision?.action === 'block') {
      setStatus('Post blocked: ' + decision.reason);
      return;
    }
    if (decision?.action === 'review') {
      setStatus('Post held for contextual review: ' + decision.reason);
      return;
    }

    setPosts((current) => [{
      id: Date.now(),
      author: 'You',
      handle: '@you',
      time: 'now',
      text,
      badge: 'New post',
      likes: 0,
      comments: 0,
    }, ...current]);
    setDraft('');
    setStatus('Published. No behavioural tracking event was created.');
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brandWrap">
          <div className="brandMark">C</div>
          <div><div className="brand">CONNECTA</div><div className="tagline">People. Communities. Connected.</div></div>
        </div>
        <label className="search"><span>⌕</span><input aria-label="Search" placeholder="Search people, groups and posts" /></label>
        <div className="topActions"><button className="iconButton" aria-label="Messages">✦</button><button className="profileButton"><span className="avatar small">BS</span><span>My profile</span></button></div>
      </header>

      <div className="privacyStrip"><strong>People, not profiling.</strong> No advertising IDs. No silent tracking. Your feed controls belong to you.</div>

      <div className="threeColumn">
        <aside className="leftRail">
          <nav className="navList">
            {nav.map((item) => <button key={item} className={active === item ? 'navItem active' : 'navItem'} onClick={() => setActive(item)}><span className="navDot" />{item}</button>)}
          </nav>
          <div className="railCard">
            <div className="eyebrow">Your feed</div>
            <h3>Choose the signal.</h3>
            <p>Latest, Following, Communities or Balanced. No hidden engagement trap.</p>
            <select defaultValue="Balanced"><option>Balanced</option><option>Latest</option><option>Following</option><option>Communities</option></select>
          </div>
          <div className="railLinks"><Link href="/safety">Safety Centre</Link><Link href="/community-standards">Community Standards</Link></div>
        </aside>

        <section className="feed">
          <div className="heroCard">
            <div><div className="eyebrow">CONNECTA</div><h1>Connect to people.<br/><span>Build real community.</span></h1><p>Friends, families, creators, schools, clubs, businesses and communities in one clean social space.</p></div>
            <div className="heroSeal"><strong>SAFE</strong><span>by design</span></div>
          </div>

          <div className="storiesRow">
            {['Family','Johannesburg','Music','Business','Football'].map((story, i) => <button className="story" key={story}><span className={'storyRing tone'+i}>{story.slice(0,2).toUpperCase()}</span><span>{story}</span></button>)}
          </div>

          <form className="composer" onSubmit={publish}>
            <div className="composerTop"><span className="avatar">BS</span><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="Share something meaningful…" maxLength={4000} /></div>
            <div className="composerBottom"><div className="composerTools"><button type="button">Photo</button><button type="button">Video</button><button type="button">Event</button><button type="button">Poll</button></div><button className="postButton" type="submit">Post</button></div>
            {status && <div className="statusLine">{status}</div>}
          </form>

          <div className="feedHeader"><div><strong>{active}</strong><span>{posts.length} posts · {totalConversation} replies</span></div><button>Feed controls</button></div>

          {posts.map((post) => <article className="postCard" key={post.id}>
            <div className="postHeader"><span className="avatar">{post.author.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div className="postIdentity"><div><strong>{post.author}</strong>{post.badge && <span className="badge">{post.badge}</span>}</div><span>{post.handle} · {post.time}</span></div><button className="more">•••</button></div>
            <p className="postText">{post.text}</p>
            <div className="postMeta"><span>{post.likes.toLocaleString()} appreciations</span><span>{post.comments.toLocaleString()} replies</span></div>
            <div className="postActions"><button>♡ Appreciate</button><button>◯ Reply</button><button>↗ Share</button><button>⚑ Report</button></div>
          </article>)}
        </section>

        <aside className="rightRail">
          <div className="safetyCard"><div className="shield">✓</div><div><div className="eyebrow">Safety Centre</div><h3>Clean social, enforced.</h3></div>
            <div className="safetyRules"><span>No cyberbullying</span><span>No threats or doxxing</span><span>No account cloning</span><span>Owner alerts on shares/copies</span><span>Businesses verified before badge</span><span>No drugs or porn</span><span>No gang recruitment</span><span>Zero tolerance for child sexual exploitation</span></div>
            <Link href="/safety" className="primaryLink">See how safety works →</Link>
          </div>

          <div className="sideCard"><div className="sideTitle"><h3>People you may know</h3><button>See all</button></div>
            {['Naledi Khumalo','Kabelo Dlamini','Zinhle Jacobs'].map((name)=><div className="person" key={name}><span className="avatar">{name.split(' ').map(x=>x[0]).join('')}</span><div><strong>{name}</strong><span>Johannesburg · 12 mutual</span></div><button>Connect</button></div>)}
          </div>

          <div className="sideCard"><div className="sideTitle"><h3>Growing communities</h3></div>
            {['SA Small Business Builders','Parents & Schools Network','African Music Creators'].map((name, index)=><div className="community" key={name}><span className="communityIcon">{['SB','PS','AM'][index]}</span><div><strong>{name}</strong><span>{[18400,9200,31800][index].toLocaleString()} members</span></div></div>)}
          </div>
        </aside>
      </div>
    </main>
  );
}
