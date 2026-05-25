// Brave Search skill — placeholder
export async function search(q: string): Promise<{ query: string; results: any[] }> {
  // Placeholder: in a real implementation, call Brave Search API
  return {
    query: q,
    results: [
      { title: `Results for "${q}"`, url: 'https://search.brave.com/search?q=' + encodeURIComponent(q) },
    ],
  };
}
