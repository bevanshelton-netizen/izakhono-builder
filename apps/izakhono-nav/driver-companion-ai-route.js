/* IZAKHONO NAV — provider-neutral server route adapter.
 * Adapt the exported handler to the host's request/response contract.
 * Credentials remain server-side.
 */
const provider = require('./driver-companion-ai-provider');

async function handleDriverCompanionChat(request) {
  if (!request || request.method && request.method !== 'POST') {
    return { status: 405, body: { ok: false, error: 'METHOD_NOT_ALLOWED' } };
  }

  const messages = request.body && Array.isArray(request.body.messages) ? request.body.messages : [];
  const hasUserMessage = messages.some(function (message) {
    return message && message.role === 'user' && typeof message.content === 'string' && message.content.trim().length > 0;
  });
  if (!hasUserMessage) {
    return { status: 400, body: { ok: false, error: 'USER_MESSAGE_REQUIRED' } };
  }

  try {
    const result = await provider.chat(request.body || {});
    return {
      status: result.ok ? 200 : 503,
      body: result
    };
  } catch (error) {
    return {
      status: 503,
      body: {
        ok: false,
        provider: 'UNAVAILABLE',
        error: 'AI_PROVIDER_UNAVAILABLE',
        text: 'I’m still here. The live voice service is temporarily unavailable.',
        safety_state: 'NORMAL',
        recommended_action: 'NONE'
      }
    };
  }
}

module.exports = { handleDriverCompanionChat };
