const THUMBNAIL_SIZE_PX = 240;

const cache = new Map<string, Promise<string | null>>();

// Thumbnails are public data, so they're fetched straight from Wikipedia's
// API instead of through our backend: this keeps them available on pages
// logged-out visitors can open too. Plain fetch rather than HttpClient on
// purpose — the auth interceptor marks every request withCredentials, and
// Wikipedia's CORS policy (origin=*) only accepts anonymous requests.
// Never rejects: a missing image just falls back to the placeholder.
export function fetchWikiThumbnail(title: string): Promise<string | null> {
  let pending = cache.get(title);
  if (!pending) {
    pending = loadThumbnail(title);
    cache.set(title, pending);
  }
  return pending;
}

async function loadThumbnail(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    redirects: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(THUMBNAIL_SIZE_PX),
    titles: title,
  });

  try {
    const response = await fetch(`https://it.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data?.query?.pages?.[0]?.thumbnail?.source ?? null;
  } catch {
    // Don't cache transient failures, so a later render can retry.
    cache.delete(title);
    return null;
  }
}
