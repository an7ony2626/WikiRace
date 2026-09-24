import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';
import {
  CompletedGameSummary,
  DuplicateGameError,
  GAME_FILTER_OPTIONS,
  GameFilterMode,
  GameState,
  LeaderboardEntry,
  LeaderboardSortMode,
} from '../../core/models/game.model';
import { WikiSearchResult } from '../../core/models/wiki-search.model';
import { PageSearchComponent } from '../../shared/page-search/page-search.component';
import { AnimatedBackgroundComponent } from '../../shared/animated-background/animated-background.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { movesLabel } from '../../shared/duration/duration.pipe';
import { withColdStartRetry } from '../../shared/http/cold-start-retry';
import { skeletonRows, withSkeletonMinDuration } from '../../shared/skeleton/skeleton';
import { WikiRouteComponent } from '../../shared/wiki-route/wiki-route.component';

// Both the leaderboard and completed-games panels on the home page show
// a short preview; the full lists live on their own "vedi tutte" pages.
const HOME_PREVIEW_SIZE = 5;

@Component({
  selector: 'app-home',
  imports: [RouterLink, PageSearchComponent, AnimatedBackgroundComponent, ConfirmDialogComponent, WikiRouteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'home.component.scss',
  template: `
    <div class="page">
      <app-animated-background />
      <header class="topbar">
        <span class="brand"><img src="/logo-wordmark.png" alt="WikiRace"></span>
        <div class="topbar-actions">
          @if (auth.isAuthenticated()) {
            <span class="username">{{ auth.username() }}</span>
            <button type="button" class="link-button" (click)="logout()">Esci</button>
          } @else {
            <a routerLink="/login" class="auth-link ghost">Accedi</a>
            <a routerLink="/register" class="auth-link solid">Registrati</a>
          }
        </div>
      </header>

      <main class="content">
        <section class="status-card">
          @if (!auth.isAuthenticated()) {
            <h1>Benvenuto su WikiRace</h1>
            <p class="muted">
              Parti da una pagina Wikipedia e raggiungi quella di arrivo cliccando solo sui link interni: vince chi ci arriva nel minor numero di mosse. Accedi per iniziare a giocare.
            </p>
          } @else {
            <svg class="route" viewBox="0 0 320 40" aria-hidden="true">
              <line
                x1="16" y1="20" x2="304" y2="20"
                stroke="var(--ink)"
                stroke-width="3"
                stroke-dasharray="4 8"
                stroke-linecap="round"
              />
              <circle [attr.cx]="progressX()" cy="20" r="10" fill="var(--wiki-blue)" />
              <circle cx="304" cy="20" r="10" fill="var(--route-red)" />
            </svg>

            @if (isLoadingCurrent()) {
              <span class="visually-hidden">Verifica partita in corso…</span>
              @if (isWakingCurrent()) {
                <p class="muted">Il server si sta risvegliando, un attimo…</p>
              }
              <!-- Ghost of the new-game picker, where most visits land -->
              <div aria-hidden="true">
                <h1><span class="skeleton-bone" style="--w: 10em"></span></h1>
                <p class="muted">
                  <span class="skeleton-bone" style="--w: 7.5em"></span>
                  <span class="skeleton-bone" style="--w: 10em"></span>
                  <span class="skeleton-bone" style="--w: 7em"></span>
                  <span class="skeleton-bone" style="--w: 9em"></span>
                  <span class="skeleton-bone" style="--w: 8em"></span>
                  <span class="skeleton-bone" style="--w: 9em"></span>
                </p>
                <div class="page-picker">
                  <div class="picker-ghost">
                    <span class="skeleton-bone" style="--w: 11em"></span>
                    <div class="picker-ghost-row">
                      <span class="input-ghost"><span class="skeleton-bone" style="--w: 14em"></span></span>
                      <span class="button-ghost"></span>
                    </div>
                  </div>
                  <span class="picker-arrow">→</span>
                  <div class="picker-ghost">
                    <span class="skeleton-bone" style="--w: 11em"></span>
                    <div class="picker-ghost-row">
                      <span class="input-ghost"><span class="skeleton-bone" style="--w: 14em"></span></span>
                      <span class="button-ghost"></span>
                    </div>
                  </div>
                </div>
                <span class="cta ghost">Inizia una nuova sfida</span>
              </div>
            } @else if (currentLoadFailed()) {
              <p class="error">Impossibile verificare la partita in corso.</p>
              <button type="button" class="cta" (click)="loadCurrentGame()">Riprova</button>
            } @else if (currentGame()) {
              <h1>Sfida in corso</h1>
              <app-wiki-route
                class="current-route"
                [start]="currentGame()!.startPageTitle"
                [target]="currentGame()!.targetPageTitle"
              />
              <p class="muted">{{ movesLabel(currentGame()!.moves) }} finora</p>
              <button type="button" class="cta" (click)="resumeGame()">Riprendi la sfida</button>
            } @else {
              <h1>Pronto per una sfida?</h1>
              <p class="muted">
                Ti diamo una pagina di partenza e una di arrivo: naviga tra i link di Wikipedia e collegale nel minor numero di click possibile.
              </p>

              <div class="page-picker">
                <app-page-search label="Pagina di partenza" (pageSelected)="onStartPageSelected($event)" />
                <span class="picker-arrow" aria-hidden="true">→</span>
                <app-page-search label="Pagina di arrivo" (pageSelected)="onTargetPageSelected($event)" />
              </div>

              @if (startErrorMessage()) {
                <p class="error">{{ startErrorMessage() }}</p>
              }

              <button type="button" class="cta" [disabled]="isStarting()" (click)="startGame()">
                {{ isStarting() ? 'Creazione…' : 'Inizia una nuova sfida' }}
              </button>
            }
          }
        </section>

        <section class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <h2>Classifica</h2>

              <div class="toggle-switch">
                <div 
                  class="toggle-indicator" 
                  [class.right]="leaderboardSort() === 'GAMES_PLAYED'">
                </div>
                <button 
                  type="button" 
                  class="toggle-btn" 
                  [class.active]="leaderboardSort() === 'BEST_MOVES'"
                  (click)="selectLeaderboardSort('BEST_MOVES')">
                  Per mosse
                </button>
                <button 
                  type="button" 
                  class="toggle-btn" 
                  [class.active]="leaderboardSort() === 'GAMES_PLAYED'"
                  (click)="selectLeaderboardSort('GAMES_PLAYED')">
                  Per partite
                </button>
              </div>

              @if (leaderboardRank(); as rank) {
                <span class="rank-badge">{{ auth.username() }}: {{ rank }}°</span>
              }
            </div>

            <a routerLink="/leaderboard" class="link-button">Vedi tutte →</a>
          </div>

          <!-- Filtri tipologia di partita -->
          <div class="filter-bar">
            @for (filter of filters; track filter.mode) {
              <button
                type="button"
                class="filter-button"
                [class.active]="leaderboardMode() === filter.mode"
                (click)="selectLeaderboardMode(filter.mode)">
                {{ filter.label }}
              </button>
            }
          </div>
          @if (isLoadingLeaderboard()) {
            <span class="visually-hidden">Caricamento classifica…</span>
            @if (isWakingLeaderboard()) {
              <p class="muted">Il server si sta risvegliando, un attimo…</p>
            }
            <ol class="leaderboard" aria-hidden="true">
              @for (row of leaderboardSkeleton(); track row) {
                <li class="skeleton-row">
                  <span class="name"><span class="skeleton-bone" style="--w: 6.5em"></span></span>
                  <span class="stat">
                    <span class="skeleton-bone" style="--w: 1.4em"></span>
                    <span class="skeleton-bone" style="--w: 3.6em"></span>
                  </span>
                  <span class="stat mono">
                    <span class="skeleton-bone" style="--w: 4.2em"></span>
                    <span class="skeleton-bone" style="--w: 3.6em"></span>
                  </span>
                </li>
              }
            </ol>
          } @else if (leaderboardLoadFailed()) {
            <p class="error">Impossibile caricare la classifica.</p>
          } @else if (leaderboard().length === 0) {
            <p class="muted">Nessuna partita completata ancora.</p>
          } @else {
            <ol class="leaderboard">
                @for (entry of leaderboard(); track entry.userId; let i = $index) {
                  <li>
                    <span class="name">{{ entry.username }}</span>
                    <span class="stat">{{ entry.gamesCompleted }} {{ entry.gamesCompleted === 1 ? 'partita' : 'partite' }}</span>

                    @switch (i) {
                      @case (0) { <span class="trophy" title="1° Posto">🥇</span> }
                      @case (1) { <span class="trophy" title="2° Posto">🥈</span> }
                      @case (2) { <span class="trophy" title="3° Posto">🥉</span> }
                    }

                    <span class="stat mono">{{ entry.bestMoves != null ? movesLabel(entry.bestMoves) : '—' }} (best)</span>

                  </li>
                }
              </ol>
          }
        </section>

        <!-- Sezione Partite concluse -->
        <section class="panel">
          <div class="panel-header">
            <h2>Partite concluse</h2>
            <a routerLink="/completed" class="link-button">Vedi tutte →</a>
          </div>
          <div class="filter-bar">
            @for (filter of filters; track filter.mode) {
              <button
                type="button"
                class="filter-button"
                [class.active]="completedMode() === filter.mode"
                (click)="selectCompletedMode(filter.mode)">
                {{ filter.label }}
              </button>
            }
          </div>
          @if (isLoadingCompleted()) {
            <span class="visually-hidden">Caricamento partite concluse…</span>
            @if (isWakingCompleted()) {
              <p class="muted">Il server si sta risvegliando, un attimo…</p>
            }
            <ul class="completed-list" aria-hidden="true">
              @for (row of completedSkeleton(); track row) {
                <li>
                  <div class="completed-row skeleton-row">
                    <span class="name"><span class="skeleton-bone" style="--w: 6.5em"></span></span>
                    <span class="route-labels small">
                      <span class="skeleton-bone" style="--w: 3.5em"></span>
                      <span class="skeleton-bone" style="--w: 8em"></span>
                      <span class="skeleton-bone" style="--w: 5em"></span>
                      <span class="skeleton-bone" style="--w: 4.5em"></span>
                    </span>
                    <span class="stat mono">
                      <span class="skeleton-bone" style="--w: 1.2em"></span>
                      <span class="skeleton-bone" style="--w: 3em"></span>
                    </span>
                  </div>
                </li>
              }
            </ul>
          } @else if (completedLoadFailed()) {
            <p class="error">Impossibile caricare le partite concluse.</p>
          } @else if (recentCompleted().length === 0) {
            <p class="muted">Nessuna partita conclusa ancora.</p>
          } @else {
            <ul class="completed-list">
              @for (game of recentCompleted(); track game.gameId) {
                <li>
                  <a class="completed-row" [routerLink]="['/completed', game.gameId]">
                    <span class="name">{{ game.username }}</span>
                    <span class="route-labels small">{{ game.startPageTitle }} → {{ game.targetPageTitle }}</span>
                    <span class="stat mono">{{ movesLabel(game.moves) }}</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      </main>

      <app-confirm-dialog
        [open]="pendingDuplicateGame() !== null"
        title="Partita già completata"
        [message]="duplicateGameMessage()"
        confirmLabel="Sostituisci"
        cancelLabel="Annulla"
        (confirmed)="confirmReplaceExisting()"
        (cancelled)="cancelReplaceExisting()"
      />
    </div>
  `,
})
export class HomeComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly filters = GAME_FILTER_OPTIONS;
  protected readonly movesLabel = movesLabel;

  readonly isLoadingCurrent = signal(true);
  readonly isLoadingLeaderboard = signal(true);
  readonly isLoadingCompleted = signal(true);

  readonly currentLoadFailed = signal(false);
  readonly leaderboardLoadFailed = signal(false);
  readonly completedLoadFailed = signal(false);

  readonly isWakingCurrent = signal(false);
  readonly isWakingLeaderboard = signal(false);
  readonly isWakingCompleted = signal(false);

  readonly isStarting = signal(false);
  readonly startErrorMessage = signal<string | null>(null);
  // Holds the pending duplicate-game warning while the confirm dialog
  // is open; null means the dialog is closed. Replaces window.confirm().
  readonly pendingDuplicateGame = signal<DuplicateGameError | null>(null);
  readonly duplicateGameMessage = computed(() => {
    const pending = this.pendingDuplicateGame();
    if (!pending) return '';
    return `${pending.message} (${movesLabel(pending.existingMoves)}). Continuando, quella partita verrà eliminata.`;
  });
  readonly currentGame = signal<GameState | null>(null);
  readonly leaderboard = signal<LeaderboardEntry[]>([]);
  readonly leaderboardMode = signal<GameFilterMode>('ALL');
  readonly leaderboardSort = signal<LeaderboardSortMode>('BEST_MOVES');
  readonly leaderboardRank = signal<number | null>(null);
  readonly recentCompleted = signal<CompletedGameSummary[]>([]);
  readonly completedMode = signal<GameFilterMode>('ALL');

  // A reloading panel ghosts as many rows as it shows now, so switching
  // filter keeps its height; an empty panel ghosts a full preview.
  readonly leaderboardSkeleton = computed(() => skeletonRows(this.leaderboard().length || HOME_PREVIEW_SIZE));
  readonly completedSkeleton = computed(() => skeletonRows(this.recentCompleted().length || HOME_PREVIEW_SIZE));

  readonly startPageChoice = signal<WikiSearchResult | null>(null);
  readonly targetPageChoice = signal<WikiSearchResult | null>(null);
  // Whether each side was picked via the 🎲 Random button rather than
  // typed/searched — needed so createGame() can tell the backend this
  // side was left to chance, even though a concrete title is sent.
  readonly startWasRandom = signal(false);
  readonly targetWasRandom = signal(false);

  readonly progressX = signal(16);

  private leaderboardRequest?: Subscription;
  private completedRequest?: Subscription;

  ngOnInit(): void {
    // The session check started at bootstrap may still be in flight on a
    // fresh page load: wait for it, otherwise a logged-in player with a
    // game in progress would be offered a new game instead of "Riprendi".
    this.auth.waitForSession().subscribe((authenticated) => {
      if (authenticated) {
        this.loadCurrentGame();
      } else {
        this.isLoadingCurrent.set(false);
      }
    });
    this.loadLeaderboard();
    this.loadCompleted();
  }

  loadCurrentGame(): void {
    this.isLoadingCurrent.set(true);
    this.currentLoadFailed.set(false);
    this.isWakingCurrent.set(false);

    withColdStartRetry(this.gameService.getCurrentGame(), () => this.isWakingCurrent.set(true))
      .pipe(
        catchError(() => of('error' as const)),
        withSkeletonMinDuration(),
      )
      .subscribe((result) => {
        this.isLoadingCurrent.set(false);

        if (result === 'error') {
          this.currentLoadFailed.set(true);
          return;
        }

        this.currentGame.set(result);
        if (result) {
          const step = Math.min(result.moves, 10);
          this.progressX.set(16 + step * 26);
        }
      });
  }

  selectLeaderboardMode(mode: GameFilterMode): void {
    if (this.leaderboardMode() === mode) return;
    this.leaderboardMode.set(mode);
    this.loadLeaderboard();
  }

  selectLeaderboardSort(sort: LeaderboardSortMode): void {
    if (this.leaderboardSort() === sort) return;
    this.leaderboardSort.set(sort);
    this.loadLeaderboard();
  }

  private loadLeaderboard(): void {
    this.isLoadingLeaderboard.set(true);
    this.leaderboardLoadFailed.set(false);
    this.isWakingLeaderboard.set(false);

    // A newer filter wins: the answer for the one just left must not land
    // after it.
    this.leaderboardRequest?.unsubscribe();
    this.leaderboardRequest = withColdStartRetry(
      this.gameService.getLeaderboard(this.leaderboardMode(), this.leaderboardSort(), 0, HOME_PREVIEW_SIZE),
      () => this.isWakingLeaderboard.set(true),
    )
      .pipe(
        catchError(() => of('error' as const)),
        withSkeletonMinDuration(),
      )
      .subscribe((result) => {
        this.isLoadingLeaderboard.set(false);

        if (result === 'error') {
          this.leaderboardLoadFailed.set(true);
          return;
        }

        this.leaderboard.set(result.entries);
        this.leaderboardRank.set(result.currentUserRank);
      });
  }

  selectCompletedMode(mode: GameFilterMode): void {
    if (this.completedMode() === mode) return;
    this.completedMode.set(mode);
    this.loadCompleted();
  }

  private loadCompleted(): void {
    this.isLoadingCompleted.set(true);
    this.completedLoadFailed.set(false);
    this.isWakingCompleted.set(false);

    this.completedRequest?.unsubscribe();
    this.completedRequest = withColdStartRetry(
      this.gameService.getCompletedGames(this.completedMode(), 0, HOME_PREVIEW_SIZE),
      () => this.isWakingCompleted.set(true),
    )
      .pipe(
        catchError(() => of('error' as const)),
        withSkeletonMinDuration(),
      )
      .subscribe((result) => {
        this.isLoadingCompleted.set(false);

        if (result === 'error') {
          this.completedLoadFailed.set(true);
          return;
        }

        this.recentCompleted.set(result.games);
      });
  }

  onStartPageSelected(event: { page: WikiSearchResult; wasRandom: boolean } | null): void {
    this.startPageChoice.set(event?.page ?? null);
    this.startWasRandom.set(event?.wasRandom ?? false);
  }

  onTargetPageSelected(event: { page: WikiSearchResult; wasRandom: boolean } | null): void {
    this.targetPageChoice.set(event?.page ?? null);
    this.targetWasRandom.set(event?.wasRandom ?? false);
  }

  startGame(confirmReplaceExisting = false): void {
    if (this.isStarting()) return;
    this.isStarting.set(true);
    this.startErrorMessage.set(null);

    this.gameService
      .createGame(
        this.startPageChoice()?.title,
        this.targetPageChoice()?.title,
        this.startWasRandom(),
        this.targetWasRandom(),
        confirmReplaceExisting,
      )
      .subscribe({
        next: (game) => this.router.navigate(['/game', game.gameId]),
        error: (err: HttpErrorResponse) => {
          this.isStarting.set(false);

          if (err.status === 409 && this.isDuplicateGameError(err.error)) {
            this.pendingDuplicateGame.set(err.error);
            return;
          }

          this.startErrorMessage.set(
            typeof err.error === 'string' ? err.error : 'Impossibile creare la partita, riprova.',
          );
        },
      });
  }

  confirmReplaceExisting(): void {
    this.pendingDuplicateGame.set(null);
    this.startGame(true);
  }

  cancelReplaceExisting(): void {
    this.pendingDuplicateGame.set(null);
  }

  private isDuplicateGameError(error: unknown): error is DuplicateGameError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'existingGameId' in error &&
      'existingMoves' in error &&
      'message' in error
    );
  }

  resumeGame(): void {
    const game = this.currentGame();
    if (game) this.router.navigate(['/game', game.gameId]);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}