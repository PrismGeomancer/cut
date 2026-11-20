import { html } from './dom';
import { minutesAgo } from '../lib/format';
import { ageOf, type Loaded } from '../lib/data';
import { PLATFORM_NAME, PLATFORM_VAR, type Platform } from '../lib/live';

/** The designed empty state: a slate-striped strip and a plain sentence. */
export const empty = (text: string, cls = '') => html`<div class="empty ${cls}"><span class="empty__slate" aria-hidden="true"></span><p>${text}</p></div>`;

export const ERROR_LIST = "Couldn't load this list. Try again in a minute.";
export const EMPTY_LIST = 'Nothing in this list yet. Check back after the next refresh.';

/** "Showing the list from {m} min ago." when a source failed but an older snapshot exists. */
export function staleLine(l: Loaded<any>) {
  return l.state === 'snapshot' ? html`<p class="stale" role="status"><span class="stale__mark" aria-hidden="true"></span>Showing the list from ${minutesAgo(ageOf(l))} min ago.</p>` : '';
}

/** Platforms are a coloured dot plus the name in text. */
export const dot = (p: Platform) => html`<span class="plat"><span class="dot" style="--c:${PLATFORM_VAR[p]}" aria-hidden="true"></span>${PLATFORM_NAME[p]}</span>`;
