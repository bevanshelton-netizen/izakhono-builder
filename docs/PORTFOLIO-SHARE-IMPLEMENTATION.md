# Portfolio Share Implementation

Use this as the default implementation contract for public-facing portfolio apps.

## Required UI
- A visible `Share` control in the hero or persistent header.
- On supported mobile browsers, trigger `navigator.share()` with the platform name, concise value proposition and canonical URL.
- When native share is unavailable, expose WhatsApp, Facebook, LinkedIn, X and Copy Link actions.

## Framework-agnostic browser helper

```js
export async function sharePlatform({ title, text, url = window.location.href }) {
  const canonicalUrl = new URL(url, window.location.origin).toString();

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: canonicalUrl });
      return { method: 'native', shared: true };
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'native', shared: false };
    }
  }

  return { method: 'fallback', shared: false, url: canonicalUrl };
}

export function shareLinks({ title, text, url }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(`${title} — ${text}`);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
  };
}
```

## Tracking
Campaign links should use a consistent convention, for example:

`?utm_source=<network>&utm_medium=organic_social&utm_campaign=<platform>-launch&utm_content=<creative>`

Do not overwrite existing query parameters; merge safely.

## Social preview metadata
Every public platform should set:
- canonical URL;
- page title;
- meta description;
- `og:title`;
- `og:description`;
- `og:image` using a platform-specific 1200x630 asset;
- `og:url`;
- `twitter:card=summary_large_image`;
- matching X/Twitter title, description and image fields.

## Creative sizes
Prepare at minimum:
- 1080x1080 — square/feed;
- 1080x1920 — Story/Reel/TikTok/Short vertical;
- 1200x630 — landscape/link preview.

## QA
Before release verify:
1. Share opens correctly on Android/mobile.
2. Fallback links open the intended network composer.
3. Copy Link copies the canonical public URL.
4. Shared preview contains the correct platform name, explanation and image.
5. Campaign links resolve to the correct landing/action page.
6. UTM parameters are visible in analytics/logs where tracking is enabled.
