(() => {
  window.IZAKHONO_ANDROID_APP = { version: '1.0.0-beta', native: true };

  const byId = id => document.getElementById(id);
  const locale = () => byId('languageFilter')?.value || navigator.language || 'en-ZA';

  const wire = () => {
    const mic = byId('micBtn');
    if (mic && window.IzakhonoNativeSpeech?.start) {
      mic.disabled = false;
      mic.title = 'Speak your destination';
      mic.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.IzakhonoNativeSpeech.start(locale());
        const status = byId('searchStatus');
        if (status) status.textContent = 'Listening for destination…';
      }, true);
    }

    window.addEventListener('izakhono-native-speech-result', event => {
      const text = event.detail?.text || '';
      if (!text) return;
      const input = byId('destination');
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const status = byId('searchStatus');
      if (status) status.textContent = 'Destination heard.';
    });

    window.addEventListener('izakhono-native-speech-error', event => {
      const status = byId('searchStatus');
      if (status) status.textContent = event.detail?.message || 'Voice search unavailable.';
    });

    if (window.IzakhonoNativeShare?.share) {
      try {
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: async data => {
            window.IzakhonoNativeShare.share(data?.title || 'IZAKHONO NAV', data?.text || '');
          }
        });
      } catch {}
    }

    if (window.IzakhonoNativeWake?.acquire) {
      try {
        Object.defineProperty(navigator, 'wakeLock', {
          configurable: true,
          value: {
            request: async () => {
              window.IzakhonoNativeWake.acquire();
              return {
                release: async () => window.IzakhonoNativeWake.release(),
                addEventListener: () => {}
              };
            }
          }
        });
      } catch {}
    }

    const install = byId('installBtn');
    if (install) install.classList.add('hidden');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();
