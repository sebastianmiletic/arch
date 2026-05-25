// Fetch skill — read any webpage
export async function fetchPage(url: string): Promise<{ url: string; title: string; text: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Simple HTML-to-text
  const titleMatch = html.match(/<title>([^]*?)\u003c\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
  const text = html
    .replace(/<script[^]*?\u003c\/script>/gi, '')
    .replace(/<style[^]*?\u003c\/style>/gi, '')
    .replace(/\u003c[^]*?>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { url, title, text: text.slice(0, 8000) };
}
