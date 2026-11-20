const cell = (v: unknown) => {
  const s = String(v ?? '');
  // neutralise spreadsheet formula injection, then quote when needed
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv<T>(rows: T[], columns: { header: string; get: (r: T) => unknown }[]): string {
  return [columns.map((c) => cell(c.header)).join(','), ...rows.map((r) => columns.map((c) => cell(c.get(r))).join(','))].join('\r\n');
}
export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
