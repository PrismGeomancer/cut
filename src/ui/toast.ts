let region: HTMLElement | null = null;
export function toast(text: string) {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  region.append(t);
  setTimeout(() => t.remove(), 3200);
}

export async function copy(text: string, done = 'Link copied.') {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast(done); } finally { ta.remove(); }
  }
}
