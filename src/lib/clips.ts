import { loadData } from './data';

export interface Clip {
  id: string; url: string; embedUrl: string; title: string; broadcaster: string; creator: string;
  views: number; createdAt: string; thumbnail: string; duration: number; language: string;
}
export const loadClips = () => loadData<{ generatedAt: string; clips: Clip[] } | Clip[]>('clips.json');
export const clipsOf = (d: any): Clip[] => (Array.isArray(d) ? d : d?.clips ?? []);

/** Twitch needs the parent host on every embed. */
export const twitchEmbed = (embedUrl: string) => {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set('parent', location.hostname || 'localhost');
    u.searchParams.set('autoplay', 'true');
    return u.toString();
  } catch { return ''; }
};
