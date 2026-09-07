// Client-side fetch with automatic retry for transient gateway errors.
// Vercel serverless functions can return a 502/503/504 on a cold start before
// the function boots; without a retry that blip surfaces to the user as a
// "Bad Gateway" error or an empty page. This retries those (and network
// failures) a couple of times with a short backoff before giving up.
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 3,
  backoffMs = 600
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, init)
      // Only retry transient gateway/timeout statuses; return everything else
      // (including 4xx and real 500s) so genuine errors aren't masked.
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastErr = new Error(`HTTP ${res.status}`)
      } else {
        return res
      }
    } catch (e) {
      lastErr = e
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed')
}
