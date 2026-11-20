import { loadData } from './data';

export interface Short { id: string; title: string; channel: string; views: number; publishedAt: string; thumbnail: string; duration?: number }
export const loadShorts = () => loadData<{ generatedAt: string; query?: string; shorts: Short[] } | Short[]>('shorts.json');
export const shortsOf = (d: any): Short[] => (Array.isArray(d) ? d : d?.shorts ?? []);
export const shortUrl = (id: string) => `https://www.youtube.com/shorts/${encodeURIComponent(id)}`;
export const shortEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1`;
