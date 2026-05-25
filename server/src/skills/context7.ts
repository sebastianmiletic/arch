// Context7 skill — placeholder for documentation retrieval
export async function getDocs(library: string): Promise<{ library: string; docs: any }> {
  return {
    library,
    docs: [
      { title: `${library} — Getting Started`, url: `https://docs.${library}.io/getting-started` },
      { title: `${library} — API Reference`, url: `https://docs.${library}.io/api` },
      { title: `${library} — Examples`, url: `https://docs.${library}.io/examples` },
    ],
  };
}
