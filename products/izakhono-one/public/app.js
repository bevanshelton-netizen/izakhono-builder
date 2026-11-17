const STORAGE_KEY = 'izakhono-one:conversations:v1';
const MAX_HISTORY = 30;

const sidebar = document.querySelector('#sidebar');
const mobileScrim = document.querySelector('#mobile-scrim');
const welcome = document.querySelector('#welcome');
const conversation = document.querySelector('#conversation');
const messagesElement = document.querySelector('#messages');
const chatList = document.querySelector('#chat-list');
const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const statusElement = document.querySelector('#ai-status');

const state = {
  conversations: loadConversations(),
  activeId: null,
  messages: [],
  busy: false
};

function makeId() {
  return globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function loadConversations() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item) =>
      item && typeof item.id === 'string' && Array.isArray(item.messages)
    ).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function titleFor(messages) {
  const first = messages.find((item) => item.role === 'user');
  if (!first) return 'New chat';
  const title = first.content.replace(/\s+/g, ' ').trim();
  return title.length > 38 ? title.slice(0, 38) + '…' : title;
}

function saveConversation() {
  if (!state.activeId || !state.messages.length) return;
  const now = new Date().toISOString();
  const existing = state.conversations.find((item) => item.id === state.activeId);
  const conversationData = {
    id: state.activeId,
    title: titleFor(state.messages),
    messages: state.messages.slice(-MAX_HISTORY),
    updatedAt: now
  };
  if (existing) Object.assign(existing, conversationData);
  else state.conversations.unshift(conversationData);
  state.conversations.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  state.conversations = state.conversations.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations));
  } catch {
    // The current conversation remains usable if device storage is unavailable.
  }
  renderHistory();
}

function renderHistory() {
  chatList.replaceChildren();
  if (!state.conversations.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'Your recent chats will appear here.';
    chatList.append(empty);
    return;
  }
  for (const item of state.conversations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item' + (item.id === state.activeId ? ' active' : '');
    button.textContent = item.title || 'New chat';
    button.title = item.title || 'New chat';
    button.addEventListener('click', () => openConversation(item.id));
    chatList.append(button);
  }
}

function renderMessages() {
  messagesElement.replaceChildren();
  for (const message of state.messages) {
    const article = document.createElement('article');
    article.className = 'message message-' + message.role;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar' + (message.role === 'assistant' ? ' assistant-avatar' : '');
    avatar.textContent = message.role === 'assistant' ? '✦' : 'Y';
    const contentWrap = document.createElement('div');
    contentWrap.className = 'message-wrap';
    const author = document.createElement('div');
    author.className = 'message-author';
    author.textContent = message.role === 'assistant' ? 'IZAKHONO ONE' : 'You';
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.content;
    contentWrap.append(author, content);
    article.append(avatar, contentWrap);
    messagesElement.append(article);
  }
  if (state.busy) {
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span><em>IZAKHONO ONE is thinking…</em>';
    messagesElement.append(typing);
  }
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function syncView() {
  const hasMessages = state.messages.length > 0;
  welcome.hidden = hasMessages;
  conversation.hidden = !hasMessages;
  renderMessages();
  renderHistory();
}

function closeSidebar() {
  sidebar.classList.remove('open');
  mobileScrim.hidden = true;
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
}

function newChat() {
  if (state.busy) return;
  state.activeId = makeId();
  state.messages = [];
  input.value = '';
  input.focus();
  closeSidebar();
  syncView();
  updateSendButton();
}

function openConversation(id) {
  if (state.busy) return;
  const selected = state.conversations.find((item) => item.id === id);
  if (!selected) return;
  state.activeId = selected.id;
  state.messages = selected.messages.map((item) => ({ role: item.role, content: item.content }));
  input.value = '';
  closeSidebar();
  syncView();
  updateSendButton();
}

function updateSendButton() {
  sendButton.disabled = state.busy || !input.value.trim();
  sendButton.querySelector('span:first-child').textContent = state.busy ? 'Working…' : 'Send';
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  updateSendButton();
}

function setAIStatus(status, detail) {
  const label = status === 'connected' ? 'ONE AI connected' : 'AI not connected';
  statusElement.className = 'ai-status ' + (status === 'connected' ? 'connected' : 'disconnected');
  statusElement.querySelector('span:last-child').textContent = label;
  statusElement.title = detail || label;
}

async function checkAIStatus() {
  try {
    const response = await fetch('/api/chat/health', { cache: 'no-store' });
    const data = await response.json();
    setAIStatus(data.status, data.status === 'connected'
      ? 'Connected to the approved IZAKHONO local AI runtime.'
      : data.status === 'model_missing'
        ? 'The approved local model is not installed yet.'
        : 'The approved AI runtime is not reachable. No external provider fallback is used.');
  } catch {
    setAIStatus('offline', 'The ONE AI status service could not be reached.');
  }
}

async function sendMessage(text) {
  const content = String(text || '').trim();
  if (!content || state.busy) return;
  if (!state.activeId) state.activeId = makeId();
  state.messages.push({ role: 'user', content });
  input.value = '';
  resizeInput();
  state.busy = true;
  syncView();
  updateSendButton();
  saveConversation();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: state.messages.slice(-20) }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || typeof data.message !== 'string') {
      const explanation = data.message || (response.status === 503
        ? 'ONE AI is not connected to its approved model runtime yet. Your message has not been sent to another provider.'
        : 'I could not complete that request. Please try again.');
      state.messages.push({ role: 'assistant', content: explanation });
    } else {
      state.messages.push({ role: 'assistant', content: data.message });
      setAIStatus('connected', 'Connected to the approved IZAKHONO local AI runtime.');
    }
  } catch {
    state.messages.push({
      role: 'assistant',
      content: 'I could not reach ONE AI. Please check the connection and try again. Your message has not been sent to another provider.'
    });
  } finally {
    state.busy = false;
    syncView();
    updateSendButton();
    saveConversation();
    input.focus();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (!sendButton.disabled) form.requestSubmit();
  }
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt || '';
    resizeInput();
    input.focus();
    closeSidebar();
  });
});

document.querySelector('#new-chat').addEventListener('click', newChat);
document.querySelector('#new-chat-top').addEventListener('click', newChat);
document.querySelector('#clear-history').addEventListener('click', () => {
  if (!state.conversations.length || !window.confirm('Clear chat history saved on this device?')) return;
  state.conversations = [];
  state.activeId = null;
  state.messages = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  syncView();
  updateSendButton();
});
document.querySelector('#menu-toggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  mobileScrim.hidden = false;
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'true');
});
document.querySelector('#sidebar-close').addEventListener('click', closeSidebar);
mobileScrim.addEventListener('click', closeSidebar);

renderHistory();
syncView();
updateSendButton();
checkAIStatus();
