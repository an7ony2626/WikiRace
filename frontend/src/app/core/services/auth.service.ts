import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { environment } from '../../environments/environments';
import { withColdStartRetry } from '../../shared/http/cold-start-retry';

// The JWT lives in an httpOnly cookie the backend sets on login/register —
// JS can't read it, so auth state can no longer be decoded client-side.
// It has to be resolved by asking the server (GET /auth/me, which reads
// the cookie) instead.
type SessionState = 'unknown' | 'authenticated' | 'anonymous';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<SessionState>('unknown');
  private readonly usernameSignal = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.state() === 'authenticated');
  readonly username = computed(() => this.usernameSignal());

  // Shared + replayed so the app initializer (fire-and-forget, see
  // app.config.ts) and the route guard (which does need to wait for the
  // result) resolve off the same in-flight request instead of firing two.
  // Patient like the rest of the app's cold-start-aware calls: a wrong
  // "anonymous" flash because the backend was merely asleep is worse
  // than a slower first load for the case that actually needs a guard
  // decision (a direct/refreshed link into a game).
  private readonly session$: Observable<void> = withColdStartRetry(
    this.http.get<AuthResponse>(`${environment.apiUrl}/auth/me`),
  ).pipe(
    tap((res) => this.applyAuthenticated(res.username)),
    map(() => undefined),
    catchError(() => {
      // A login/register may have completed while this check was still
      // in flight (it started before the cookie existed): never let the
      // stale answer overwrite that newer state.
      if (this.state() === 'unknown') this.applyAnonymous();
      return of(undefined);
    }),
    shareReplay(1),
  );

  // Kicked off once at bootstrap without blocking startup — components
  // read isAuthenticated()/username() reactively as it resolves.
  initSession(): void {
    this.session$.subscribe();
  }

  // Used by the route guard and by components that need a settled answer.
  // The bootstrap check is only waited on while nothing is known yet; its
  // replayed result is never trusted over a later login or logout, which
  // is what previously sent freshly registered users back to /login.
  waitForSession(): Observable<boolean> {
    if (this.state() !== 'unknown') return of(this.isAuthenticated());
    return this.session$.pipe(map(() => this.isAuthenticated()));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.applyAuthenticated(response.username)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(tap((response) => this.applyAuthenticated(response.username)));
  }

  // Clears local state immediately (optimistic) and best-effort tells
  // the backend to clear the cookie — there's no client-side equivalent
  // of the old localStorage.removeItem for an httpOnly cookie.
  logout(): void {
    this.applyAnonymous();
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
  }

  private applyAuthenticated(username: string): void {
    this.usernameSignal.set(username);
    this.state.set('authenticated');
  }

  private applyAnonymous(): void {
    this.usernameSignal.set(null);
    this.state.set('anonymous');
  }
}
