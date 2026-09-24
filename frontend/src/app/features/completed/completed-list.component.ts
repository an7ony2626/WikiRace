import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { CompletedGameSummary, GAME_FILTER_OPTIONS, GameFilterMode } from '../../core/models/game.model';
import { DurationPipe, movesLabel } from '../../shared/duration/duration.pipe';
import { WikiPageLinkComponent } from '../../shared/wiki-page-link/wiki-page-link.component';
import { withColdStartRetry } from '../../shared/http/cold-start-retry';
import { AnimatedBackgroundComponent } from '../../shared/animated-background/animated-background.component';
import { skeletonRows } from '../../shared/skeleton/skeleton';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-completed-list',
  imports: [RouterLink, DurationPipe, WikiPageLinkComponent, AnimatedBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './completed-list.component.scss',
  template: `
    <div class="page">
      <app-animated-background />
      <header class="topbar">
        <a routerLink="/" class="brand-link"><img src="/logo-wordmark.png" alt="WikiRace"></a>
        <span class="brand">Partite concluse</span>
      </header>

      <main class="content">
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

        @if (loadFailed()) {
          <p class="error">Impossibile caricare le partite concluse.</p>
        } @else if (!isLoading() && games().length === 0) {
          <p class="muted">Nessuna partita conclusa ancora.</p>
        } @else {
          @if (ghostRows().length > 0) {
            <span class="visually-hidden">Caricamento partite concluse…</span>
          }
          @if (isLoading() && isWaking()) {
            <p class="muted">Il server si sta risvegliando, un attimo…</p>
          }
          <ul class="completed-list">
            @if (!isLoading()) {
              @for (game of games(); track game.gameId) {
                <li>
                  <div
                    class="completed-row"
                    tabindex="0"
                    role="link"
                    (click)="openDetail(game.gameId)"
                    (keydown.enter)="openDetail(game.gameId)"
                  >
                    <span class="name">{{ game.username }}</span>
                    <span class="route-labels">
                      <app-wiki-page-link [title]="game.startPageTitle" [stopPropagation]="true" />
                      →
                      <app-wiki-page-link [title]="game.targetPageTitle" [stopPropagation]="true" />
                    </span>
                    <span class="stat mono">{{ movesLabel(game.moves) }}</span>
                    <span class="stat mono">{{ game.totalTimeSeconds | duration }}</span>
                  </div>
                </li>
              }
            }
            @for (row of ghostRows(); track row) {
              <li aria-hidden="true">
                <div class="completed-row skeleton-row">
                  <span class="name"><span class="skeleton-bone" style="--w: 6.5em"></span></span>
                  <span class="route-labels">
                    <span class="skeleton-bone" style="--w: 3.5em"></span>
                    <span class="skeleton-bone" style="--w: 8em"></span>
                    <span class="skeleton-bone" style="--w: 5em"></span>
                    <span class="skeleton-bone" style="--w: 4.5em"></span>
                  </span>
                  <span class="stat mono">
                    <span class="skeleton-bone" style="--w: 1.2em"></span>
                    <span class="skeleton-bone" style="--w: 3em"></span>
                  </span>
                  <span class="stat mono"><span class="skeleton-bone" style="--w: 3em"></span></span>
                </div>
              </li>
            }
          </ul>

          @if (hasMore() && ghostRows().length === 0) {
            <button type="button" class="load-more" (click)="loadMore()">Carica altre ↓</button>
          }
        }
      </main>
    </div>
  `,
})
export class CompletedListComponent implements OnInit {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly filters = GAME_FILTER_OPTIONS;
  protected readonly movesLabel = movesLabel;

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadFailed = signal(false);
  readonly isWaking = signal(false);
  readonly games = signal<CompletedGameSummary[]>([]);
  readonly hasMore = signal(false);
  readonly mode = signal<GameFilterMode>('ALL');

  // A reload ghosts the rows shown now (at most one page, all it brings
  // back) so switching filter keeps the list's height; "Carica altre"
  // ghosts the page it is fetching below the rows already there.
  readonly ghostRows = computed(() => {
    if (this.isLoading()) return skeletonRows(Math.min(this.games().length, PAGE_SIZE) || PAGE_SIZE);
    return skeletonRows(this.isLoadingMore() ? PAGE_SIZE : 0);
  });

  private page = 0;

  ngOnInit(): void {
    this.loadPage(0, false);
  }

  selectMode(mode: GameFilterMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.loadPage(0, false);
  }

  openDetail(gameId: number): void {
    this.router.navigate(['/completed', gameId]);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.loadPage(this.page + 1, true);
  }

  private loadPage(page: number, append: boolean): void {
    (append ? this.isLoadingMore : this.isLoading).set(true);
    this.loadFailed.set(false);
    this.isWaking.set(false);

    withColdStartRetry(this.gameService.getCompletedGames(this.mode(), page, PAGE_SIZE), () =>
      this.isWaking.set(true),
    )
      .pipe(catchError(() => of('error' as const)))
      .subscribe((result) => {
        this.isLoading.set(false);
        this.isLoadingMore.set(false);

        if (result === 'error') {
          this.loadFailed.set(true);
          return;
        }

        this.page = page;
        this.hasMore.set(result.hasMore);
        this.games.set(append ? [...this.games(), ...result.games] : result.games);
      });
  }
}
