// Playwright skill — browser automation placeholder
export async function runTest(opts: { url: string; action?: string }) {
  return {
    url: opts.url,
    action: opts.action || 'screenshot',
    status: 'skipped',
    note: 'Install playwright in server/ to enable real browser automation',
  };
}
