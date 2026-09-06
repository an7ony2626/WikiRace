import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { CompletedGameSummary, GAME_FILTER_OPTIONS, GameFilterMode } from '../../core/models/game.model';
import { DurationPipe } from '../../shared/duration/duration.pipe';
import { WikiPageLinkComponent } from '../../shared/wiki-page-link/wiki-page-link.component';
import { withColdStartRetry } from '../../shared/http/cold-start-retry';
import { AnimatedBackgroundComponent } from '../../shared/animated-background/animated-background.component';

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

        @if (isLoading()) {
          <p class="muted">{{ isWaking() ? 'Il server si sta risvegliando, un attimo…' : 'Caricamento…' }}</p>
        } @else if (loadFailed()) {
          <p class="error">Impossibile caricare le partite concluse.</p>
        } @else if (games().length === 0) {
          <p class="muted">Nessuna partita conclusa ancora.</p>
        } @else {
          <ul class="completed-list">
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
                  <span class="stat mono">{{ game.moves }} mosse</span>
                  <span class="stat mono">{{ game.totalTimeSeconds | duration }}</span>
                </div>
              </li>
            }
          </ul>

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
export class CompletedListComponent implements OnInit {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly filters = GAME_FILTER_OPTIONS;

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadFailed = signal(false);
  readonly isWaking = signal(false);
  readonly games = signal<CompletedGameSummary[]>([]);
  readonly hasMore = signal(false);
  readonly mode = signal<GameFilterMode>('ALL');

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
