// Work id from an AO3 work URL, e.g. /works/123 or /collections/x/works/123/chapters/4.
export function ao3WorkId(url: string): string | null {
  return new URL(url).pathname.match(/\/works\/(\d+)/)?.[1] ?? null;
}
