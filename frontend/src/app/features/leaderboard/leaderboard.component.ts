import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';
import { GAME_FILTER_OPTIONS, GameFilterMode, LeaderboardEntry, LeaderboardSortMode } from '../../core/models/game.model';
import { withRequestTimeout } from '../../shared/rxjs/with-request-timeout';
import { AnimatedBackgroundComponent } from '../../shared/animated-background/animated-background.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-leaderboard',
  imports: [RouterLink, AnimatedBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './leaderboard.component.scss',
  template: `
    <div class="page">
      <app-animated-background />
      <header class="topbar">
        <a routerLink="/" class="brand-link"><img src="/logo-wordmark.png" alt="WikiRace"></a>
        <span class="brand">Classifica</span>
      </header>

      <main class="content">
        <div class="panel-title">
          <div class="toggle-switch">
            <div class="toggle-indicator" [class.right]="sort() === 'GAMES_PLAYED'"></div>
            <button
              type="button"
              class="toggle-btn"
              [class.active]="sort() === 'BEST_MOVES'"
              (click)="selectSort('BEST_MOVES')"
            >
              Per mosse
            </button>
            <button
              type="button"
              class="toggle-btn"
              [class.active]="sort() === 'GAMES_PLAYED'"
              (click)="selectSort('GAMES_PLAYED')"
            >
              Per partite
            </button>
          </div>

          @if (currentUserRank(); as rank) {
            <span class="rank-badge">{{ auth.username() }}: {{ rank }}°</span>
          }
        </div>

        <div class="filter-bar">
          @for (filter of filters; track filter.mode) {
            <button
              type="button"
              class="filter-button"
              [class.active]="mode() === filter.mode"
              (click)="selectMode(filter.mode)"
            >
              {{ filter.label }}
            </button>
          }
        </div>

        @if (isLoading()) {
          <p class="muted">Caricamento…</p>
        } @else if (loadFailed()) {
          <p class="error">Impossibile caricare la classifica.</p>
        } @else if (entries().length === 0) {
          <p class="muted">Nessuna partita completata ancora.</p>
        } @else {
          <ol class="leaderboard">
              @for (entry of entries(); track entry.userId; let i = $index) {
                <li>
                  <span class="name">{{ entry.username }}</span>
                  <span class="stat">{{ entry.gamesCompleted }} {{ entry.gamesCompleted === 1 ? 'partita' : 'partite' }}</span>

                  @switch (i) {
                    @case (0) { <span class="trophy" title="1° Posto">🥇</span> }
                    @case (1) { <span class="trophy" title="2° Posto">🥈</span> }
                    @case (2) { <span class="trophy" title="3° Posto">🥉</span> }
                  }

                  <span class="stat mono">{{ entry.bestMoves ?? '—' }} {{ entry.gamesCompleted === 1 ? 'mossa' : 'mosse' }} (best)</span>
                </li>
              }
            </ol>

          @if (hasMore()) {
            <button type="button" class="load-more" [disabled]="isLoadingMore()" (click)="loadMore()">
              {{ isLoadingMore() ? 'Caricamento…' : 'Carica altre ↓' }}
            </button>
          }
        }
      </main>
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly gameService = inject(GameService);

  protected readonly filters = GAME_FILTER_OPTIONS;

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadFailed = signal(false);
  readonly entries = signal<LeaderboardEntry[]>([]);
  readonly hasMore = signal(false);
  readonly mode = signal<GameFilterMode>('ALL');
  readonly sort = signal<LeaderboardSortMode>('BEST_MOVES');
  readonly currentUserRank = signal<number | null>(null);

  private page = 0;

  ngOnInit(): void {
    this.loadPage(0, false);
  }

  selectMode(mode: GameFilterMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.loadPage(0, false);
  }

  selectSort(sort: LeaderboardSortMode): void {
    if (this.sort() === sort) return;
    this.sort.set(sort);
    this.loadPage(0, false);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadPage(this.page + 1, true);
  }

  private loadPage(page: number, append: boolean): void {
    (append ? this.isLoadingMore : this.isLoading).set(true);
    this.loadFailed.set(false);

    this.gameService
      .getLeaderboard(this.mode(), this.sort(), page, PAGE_SIZE)
      .pipe(withRequestTimeout())
      .subscribe((result) => {
        this.isLoading.set(false);
        this.isLoadingMore.set(false);

        if (result === 'error') {
          this.loadFailed.set(true);
          return;
        }

        this.page = page;
        this.hasMore.set(result.hasMore);
        this.currentUserRank.set(result.currentUserRank);
        this.entries.set(append ? [...this.entries(), ...result.entries] : result.entries);
      });
  }
}