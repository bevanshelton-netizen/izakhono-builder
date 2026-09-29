const seedPosts = [
  {
    id: "p1", name: "IZAKHONO SOCIAL", handle: "@izakhonosocial", initials: "IS", tone: "teal",
    verified: true, time: "12m", category: "for-you", replies: 38, reposts: 104, likes: 612, views: "18.9K",
    text: "Welcome to the network we want to build differently: public conversation, creator tools, communities and business opportunity — connected from the beginning.\n\nBuilt in Africa. Open to the world. #BuildInAfrica",
    badge: "FOUNDING NETWORK UPDATE"
  },
  {
    id: "p2", name: "Africa Makers", handle: "@africamakers", initials: "AM", tone: "teal",
    verified: true, time: "31m", category: "africa", replies: 19, reposts: 78, likes: 401, views: "11.2K",
    text: "A small manufacturer in Johannesburg can now sell, recruit, train, market and build a digital audience without needing five separate systems. That is the kind of African internet infrastructure worth building."
  },
  {
    id: "p3", name: "Kopano Music", handle: "@kopanomusic", initials: "KM", tone: "purple",
    verified: false, time: "1h", category: "for-you", replies: 42, reposts: 63, likes: 530, views: "15.6K",
    text: "Artists: your audience is not just a follower count. Build direct community, own your catalogue story, announce shows and convert attention into real support. 🎶"
  },
  {
    id: "p4", name: "Tech Now Africa", handle: "@technowafrica", initials: "TN", tone: "gold",
    verified: true, time: "2h", category: "business", replies: 27, reposts: 91, likes: 703, views: "22.1K",
    text: "The next wave of useful AI in Africa will not be about demos. It will be about reducing admin, getting SMEs paid, matching people to work and helping organisations make better decisions."
  },
  {
    id: "p5", name: "Nomsa D.", handle: "@nomsa_builds", initials: "ND", tone: "default",
    verified: false, time: "3h", category: "following", replies: 8, reposts: 14, likes: 122, views: "3,106",
    text: "I want social media to feel social again: less noise, better communities, more discovery of people actually doing the work."
  }
];

const state = {
  activeView: "home",
  activeFeed: "for-you",
  search: "",
  posts: loadPosts(),
  liked: new Set(JSON.parse(localStorage.getItem("is-liked") || "[]")),
  reposted: new Set(JSON.parse(localStorage.getItem("is-reposted") || "[]")),
  bookmarked: new Set(JSON.parse(localStorage.getItem("is-bookmarked") || "[]"))
};

const feed = document.querySelector("#feed");
const postTemplate = document.querySelector("#postTemplate");
const composer = document.querySelector("#composer");
const dynamicPanel = document.querySelector("#dynamicPanel");
const postText = document.querySelector("#postText");
const postButton = document.querySelector("#postButton");
const charCount = document.querySelector("#charCount");
const viewTitle = document.querySelector("#viewTitle");
const viewSubtitle = document.querySelector("#viewSubtitle");
const search = document.querySelector("#globalSearch");
const dialog = document.querySelector("#postDialog");
const dialogPostText = document.querySelector("#dialogPostText");
const dialogPostButton = document.querySelector("#dialogPostButton");
const dialogCharCount = document.querySelector("#dialogCharCount");

function loadPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem("is-posts") || "null");
    return Array.isArray(saved) && saved.length ? saved : seedPosts;
  } catch {
    return seedPosts;
  }
}

function persistPosts() {
  localStorage.setItem("is-posts", JSON.stringify(state.posts));
}

function persistSets() {
  localStorage.setItem("is-liked", JSON.stringify([...state.liked]));
  localStorage.setItem("is-reposted", JSON.stringify([...state.reposted]));
  localStorage.setItem("is-bookmarked", JSON.stringify([...state.bookmarked]));
}

function avatarClass(tone) {
  if (tone === "teal") return "avatar-teal";
  if (tone === "gold") return "avatar-gold";
  if (tone === "purple") return "avatar-purple";
  if (tone === "owner") return "avatar-owner";
  return "";
}

function renderPosts() {
  feed.innerHTML = "";
  let posts = [...state.posts];

  if (state.activeView === "bookmarks") {
    posts = posts.filter(post => state.bookmarked.has(post.id));
  } else if (state.activeView === "home" && state.activeFeed !== "for-you") {
    posts = posts.filter(post => post.category === state.activeFeed || post.category === "for-you");
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    posts = posts.filter(post => [post.name, post.handle, post.text, post.badge].join(" ").toLowerCase().includes(q));
  }

  if (!posts.length) {
    feed.innerHTML = `<div class="panel-inner"><h2>Nothing here yet</h2><p>Try another feed, search term, or create the first post.</p></div>`;
    return;
  }

  posts.forEach(post => {
    const node = postTemplate.content.cloneNode(true);
    const article = node.querySelector(".post");
    article.dataset.id = post.id;
    const avatar = node.querySelector(".post-avatar");
    avatar.textContent = post.initials || initials(post.name);
    avatar.classList.add(avatarClass(post.tone));
    node.querySelector(".post-name").textContent = post.name;
    node.querySelector(".post-handle").textContent = post.handle;
    node.querySelector(".post-time").textContent = post.time;
    node.querySelector(".post-text").innerHTML = linkify(escapeHtml(post.text));
    node.querySelector(".reply-count").textContent = compact(post.replies);
    node.querySelector(".repost-count").textContent = compact(post.reposts);
    node.querySelector(".like-count").textContent = compact(post.likes);
    node.querySelector(".view-count").textContent = post.views || "0";
    node.querySelector(".verified").classList.toggle("hidden", !post.verified);

    const badge = node.querySelector(".post-badge");
    if (post.badge) {
      badge.textContent = post.badge;
      badge.classList.remove("hidden");
    }

    node.querySelector('[data-action="like"]').classList.toggle("active-like", state.liked.has(post.id));
    node.querySelector('[data-action="repost"]').classList.toggle("active-repost", state.reposted.has(post.id));
    node.querySelector('[data-action="bookmark"]').classList.toggle("active-bookmark", state.bookmarked.has(post.id));
    feed.appendChild(node);
  });
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function linkify(text) {
  return text
    .replace(/(#[\p{L}\p{N}_-]+)/gu, '<a href="#" data-tag="$1">$1</a>')
    .replace(/(@[\w.-]+)/g, '<a href="#">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function compact(value) {
  if (typeof value === "string") return value;
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace(".0", "") + "M";
  if (value >= 1000) return (value / 1000).toFixed(1).replace(".0", "") + "K";
  return value ? String(value) : "";
}

function updateComposer() {
  const count = postText.value.length;
  charCount.textContent = `${count} / 500`;
  postButton.disabled = count === 0 || count > 500;
}

function createPost(text) {
  const clean = text.trim();
  if (!clean) return;
  state.posts.unshift({
    id: "local-" + Date.now(),
    name: "Bevan Shelton",
    handle: "@bevanshelton",
    initials: "BS",
    tone: "owner",
    verified: true,
    time: "now",
    category: "for-you",
    replies: 0,
    reposts: 0,
    likes: 0,
    views: "1",
    text: clean
  });
  persistPosts();
  setView("home");
}

postText.addEventListener("input", updateComposer);
postButton.addEventListener("click", () => {
  createPost(postText.value);
  postText.value = "";
  updateComposer();
});

feed.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  const tag = event.target.closest("[data-tag]");
  if (tag) {
    event.preventDefault();
    search.value = tag.dataset.tag;
    state.search = tag.dataset.tag;
    setView("explore");
    return;
  }
  if (!button) return;
  const article = button.closest(".post");
  const post = state.posts.find(p => p.id === article.dataset.id);
  if (!post) return;
  const action = button.dataset.action;

  if (action === "like") {
    if (state.liked.has(post.id)) {
      state.liked.delete(post.id); post.likes = Math.max(0, post.likes - 1);
    } else {
      state.liked.add(post.id); post.likes += 1;
    }
  }
  if (action === "repost") {
    if (state.reposted.has(post.id)) {
      state.reposted.delete(post.id); post.reposts = Math.max(0, post.reposts - 1);
    } else {
      state.reposted.add(post.id); post.reposts += 1;
    }
  }
  if (action === "bookmark") {
    state.bookmarked.has(post.id) ? state.bookmarked.delete(post.id) : state.bookmarked.add(post.id);
  }
  if (action === "reply") {
    const reply = prompt(`Reply to ${post.handle}`);
    if (reply && reply.trim()) {
      post.replies += 1;
      state.posts.unshift({
        id: "reply-" + Date.now(), name: "Bevan Shelton", handle: "@bevanshelton",
        initials: "BS", tone: "owner", verified: true, time: "now", category: "for-you",
        replies: 0, reposts: 0, likes: 0, views: "1",
        text: `Replying to ${post.handle}\n${reply.trim()}`
      });
    }
  }
  if (action === "share") {
    const shareText = `${post.name}: ${post.text}`;
    if (navigator.share) navigator.share({ title: "IZAKHONO SOCIAL", text: shareText }).catch(() => {});
    else navigator.clipboard?.writeText(shareText);
  }
  persistPosts(); persistSets(); renderPosts();
});

document.querySelectorAll(".feed-tab").forEach(button => {
  button.addEventListener("click", () => {
    state.activeFeed = button.dataset.feed;
    document.querySelectorAll(".feed-tab").forEach(b => b.classList.toggle("active", b === button));
    renderPosts();
  });
});

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-link]").forEach(button => {
  button.addEventListener("click", () => setView(button.dataset.viewLink));
});

function setView(view) {
  state.activeView = view;
  document.querySelectorAll("[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const copy = {
    home: ["Home", "What South Africa and the world are talking about."],
    explore: ["Explore", "Search people, topics, communities and opportunities."],
    communities: ["Communities", "Focused spaces for people with shared interests."],
    notifications: ["Notifications", "Mentions, follows, replies and network activity."],
    messages: ["Messages", "Private conversations and business enquiries."],
    bookmarks: ["Bookmarks", "Posts you saved for later."],
    business: ["Business", "Turn attention into leads, customers and opportunity."],
    profile: ["Profile", "Your public identity on IZAKHONO SOCIAL."]
  };
  [viewTitle.textContent, viewSubtitle.textContent] = copy[view] || copy.home;
  composer.classList.toggle("hidden", view !== "home");
  document.querySelector(".feed-tabs").classList.toggle("hidden", view !== "home");

  if (["home", "bookmarks", "explore"].includes(view)) {
    dynamicPanel.classList.add("hidden");
    if (view === "explore") {
      dynamicPanel.innerHTML = explorePanel();
      dynamicPanel.classList.remove("hidden");
    }
    renderPosts();
  } else {
    feed.innerHTML = "";
    dynamicPanel.innerHTML = panelFor(view);
    dynamicPanel.classList.remove("hidden");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function explorePanel() {
  return `<div class="panel-inner">
    <h2>Discover the network</h2>
    <p>Search across people, posts, businesses, creators and communities.</p>
    <div class="grid-cards">
      <div class="mini-card"><strong>#BuildInAfrica</strong><p>Manufacturing, startups, infrastructure and African-made products.</p><button data-search="#BuildInAfrica">Open topic</button></div>
      <div class="mini-card"><strong>Creators & Music</strong><p>New releases, live events, rights, collaboration and fan communities.</p><button data-search="music">Explore</button></div>
      <div class="mini-card"><strong>Jobs & Skills</strong><p>Employment, training, apprenticeships and verified opportunities.</p><button data-search="skills">Explore</button></div>
      <div class="mini-card"><strong>SME Growth</strong><p>Sales, payments, funding, websites and practical business tools.</p><button data-search="business">Explore</button></div>
    </div>
  </div>`;
}

function panelFor(view) {
  const panels = {
    communities: `<div class="panel-inner"><h2>Communities</h2><p>Join focused public or private groups with moderators, events and community feeds.</p><div class="grid-cards">
      <div class="mini-card"><strong>African Entrepreneurs</strong><p>Founders, operators, suppliers and customers across the continent.</p><button>Join</button></div>
      <div class="mini-card"><strong>Music Business</strong><p>Artists, managers, venues, rights, contracts and opportunities.</p><button>Join</button></div>
      <div class="mini-card"><strong>Skills & Learning</strong><p>Training, education, career pathways and study support.</p><button>Join</button></div>
      <div class="mini-card"><strong>Local Makers</strong><p>Manufacturers, clothing, design, fabrication and procurement.</p><button>Join</button></div>
    </div></div>`,
    notifications: `<div class="panel-inner"><h2>Recent activity</h2><p>Your network activity in one place.</p>
      <div class="notification-row"><span class="avatar avatar-teal">AM</span><div><p><strong>Africa Makers</strong> reposted your post.</p><small>8 minutes ago</small></div></div>
      <div class="notification-row"><span class="avatar avatar-gold">TN</span><div><p><strong>Tech Now Africa</strong> followed you.</p><small>24 minutes ago</small></div></div>
      <div class="notification-row"><span class="avatar avatar-purple">KM</span><div><p><strong>Kopano Music</strong> mentioned you in a conversation.</p><small>1 hour ago</small></div></div>
    </div>`,
    messages: `<div class="panel-inner"><h2>Messages</h2><p>Private conversations, creator collaboration and business enquiries.</p>
      <div class="message-row"><span class="avatar avatar-teal">AM</span><div><strong>Africa Makers</strong><p>Can we discuss a supplier spotlight next week?</p><small>10:42</small></div></div>
      <div class="message-row"><span class="avatar avatar-gold">TN</span><div><strong>Tech Now Africa</strong><p>Sending through the media partnership outline.</p><small>Yesterday</small></div></div>
    </div>`,
    business: `<div class="panel-inner"><h2>Business Centre</h2><p>Tools for organisations to convert audience into measurable outcomes.</p><div class="grid-cards">
      <div class="mini-card"><strong>Business profile</strong><p>Add products, services, location, links, catalogue and contact routes.</p><button>Configure</button></div>
      <div class="mini-card"><strong>Promote a post</strong><p>Campaign controls with audience, budget, objective and reporting adapters.</p><button>Prepare campaign</button></div>
      <div class="mini-card"><strong>Lead inbox</strong><p>Route enquiries into the IZAKHONO customer and PA workflow.</p><button>Open leads</button></div>
      <div class="mini-card"><strong>Commerce</strong><p>Connect approved payment links and product checkout when compliance is ready.</p><button>Connect</button></div>
    </div></div>`,
    profile: `<div class="panel-inner"><div class="profile-hero">
      <div class="profile-cover"></div><div class="profile-info"><span class="avatar avatar-owner">BS</span>
      <h2>Bevan Shelton ✓</h2><div class="handle">@bevanshelton</div>
      <p>Building companies, skills, manufacturing, technology and African-owned infrastructure.</p>
      <div class="profile-stats"><span><b>1,248</b> Following</span><span><b>18.6K</b> Followers</span><span><b>7</b> Communities</span></div>
      </div></div></div>`
  };
  return panels[view] || `<div class="panel-inner"><h2>${view}</h2></div>`;
}

search?.addEventListener("input", () => {
  state.search = search.value;
  if (state.search && state.activeView !== "explore") setView("explore");
  renderPosts();
});

dynamicPanel.addEventListener("click", event => {
  const searchButton = event.target.closest("[data-search]");
  if (!searchButton) return;
  search.value = searchButton.dataset.search;
  state.search = searchButton.dataset.search;
  renderPosts();
});

document.querySelectorAll(".follow-button").forEach(button => {
  button.addEventListener("click", () => {
    const following = button.classList.toggle("following");
    button.textContent = following ? "Following" : "Follow";
  });
});

document.querySelector("#joinCommunityButton").addEventListener("click", () => setView("communities"));
document.querySelector("#sidebarPost").addEventListener("click", () => { setView("home"); postText.focus(); });
document.querySelector("#openComposer").addEventListener("click", () => dialog.showModal());

dialogPostText.addEventListener("input", () => {
  dialogCharCount.textContent = `${dialogPostText.value.length} / 500`;
});
dialogPostButton.addEventListener("click", event => {
  if (!dialogPostText.value.trim()) { event.preventDefault(); return; }
  createPost(dialogPostText.value);
  dialogPostText.value = "";
  dialogCharCount.textContent = "0 / 500";
});

renderPosts();
updateComposer();