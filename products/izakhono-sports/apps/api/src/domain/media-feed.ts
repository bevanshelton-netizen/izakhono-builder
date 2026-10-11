export type MediaFeedItem = {
  id: string;
  type: 'event' | 'result' | 'headline';
  title: string;
  body: string;
  publishedAt: string;
  sportId?: string;
  competitionId?: string;
  eventId?: string;
  participantKey?: string;
};

export function normaliseMediaItem(input: MediaFeedItem): MediaFeedItem {
  return {
    ...input,
    title: input.title.trim().slice(0, 180),
    body: input.body.trim().slice(0, 2000)
  };
}

export function sortMediaFeed(items: MediaFeedItem[]): MediaFeedItem[] {
  return [...items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
