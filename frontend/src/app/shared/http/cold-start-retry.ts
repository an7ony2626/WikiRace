import { Observable, retry, timeout, timer } from 'rxjs';

// Render's free tier suspends the backend after ~15 minutes idle, and
// waking it back up can take several minutes in the worst case — a cold
// Spring Boot start against the Supabase pooler has been observed taking
// ~157s on its own, before Render's own pre-boot container spin-up time
// is even added on top. A single request should never wait that long in
// one shot — instead each attempt gets a short timeout, and a failed
// attempt is retried a few times. Same total patience, but the caller
// can show a "server is waking up" message between attempts instead of
// either a silent multi-minute hang or a hard error 10s in.

const ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 14;
const RETRY_DELAY_MS = 3_000;

export function withColdStartRetry<T>(source$: Observable<T>, onRetry?: () => void): Observable<T> {
  return source$.pipe(
    timeout(ATTEMPT_TIMEOUT_MS),
    retry({
      count: MAX_RETRIES,
      delay: () => {
        onRetry?.();
        return timer(RETRY_DELAY_MS);
      },
    }),
  );
}