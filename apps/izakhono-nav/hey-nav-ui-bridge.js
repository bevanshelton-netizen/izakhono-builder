/* IZAKHONO NAV — voice UI bridge.
 * Connects the existing NAV voice control to the Hey NAV runtime.
 * Tap remains the permanent fallback; wake listening begins after a user gesture.
 */
(function (root) {
  'use strict';

  function boot() {
    const button = document.getElementById('voice');
    if (!button) return;

    button.setAttribute('aria-label', 'Hey NAV voice companion — tap to speak');
    button.title = 'Hey NAV — tap to speak';

    function setState(label, active) {
      button.textContent = active ? '●' : '◉';
      button.setAttribute('aria-label', active
        ? 'NAV is listening'
        : 'Hey NAV voice companion — tap to speak');
      button.title = active ? 'NAV is listening' : 'Hey NAV — tap to speak';
      button.dataset.voiceState = label;
    }

    // Replace the legacy inline welcome handler. Keeping both handlers caused
    // the static greeting to cancel Hey NAV's actual "I'm listening" prompt.
    button.onclick = function () {
      if (!root.IZAKHONO_NAV_VOICE) return;
      root.IZAKHONO_NAV_VOICE.activateByTap();
    };

    root.addEventListener('izakhono-nav-voice', function (event) {
      const detail = event.detail || {};
      switch (detail.name) {
        case 'ready':
          setState('ready', false);
          break;
        case 'wake_listener_ready':
          setState('wake-listening', false);
          break;
        case 'activated':
          setState('activated', true);
          break;
        case 'listening':
          setState('listening', true);
          break;
        case 'processing':
          setState('processing', true);
          break;
        case 'speaking':
          setState('speaking', true);
          break;
        case 'speech_end':
        case 'recognition_end':
        case 'ended':
          setState('ready', false);
          break;
        case 'wake_listener_unavailable':
        case 'recognition_error':
          setState('tap-fallback', false);
          break;
        default:
          break;
      }
    });

    // Microphone access is opt-in: only tapping the NAV voice control starts recognition.
    // Do not arm a continuous wake-word listener after unrelated page interactions.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
