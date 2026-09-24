import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { GameState } from '../../core/models/game.model';
import {
  ArticleSearchState,
  MIN_SEARCH_LENGTH,
  WikiArticleComponent,
} from './wiki-article/wiki-article.component';
import { GamePathComponent } from '../../shared/game-path/game-path.component';
import { WikiRouteComponent } from '../../shared/wiki-route/wiki-route.component';
import { movesLabel } from '../../shared/duration/duration.pipe';
import { withRequestTimeout } from '../../shared/rxjs/with-request-timeout';

@Component({
  selector: 'app-game',
  imports: [WikiArticleComponent, GamePathComponent, WikiRouteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'game.component.scss',
  host: { '(document:keydown)': 'onDocumentKeydown($event)' },
  template: `
    <div class="page">
      @if (isNavigating()) {
        <div class="progress-bar"><div class="progress-fill"></div></div>
      }

      <header class="topbar">
        <span class="route-labels">
          @if (game(); as g) {
            <app-wiki-route [start]="g.startPageTitle" [target]="g.targetPageTitle" size="compact" />
          } @else if (isLoading()) {
            <app-wiki-route [start]="null" [target]="null" size="compact" aria-hidden="true" />
          }
        </span>

        @if (isArticleVisible()) {
          <div class="find-bar" role="search">
            <svg class="find-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8" />
              <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <input
              #findInput
              type="search"
              class="find-input"
              placeholder="Cerca nella pagina"
              aria-label="Cerca nella pagina"
              enterkeyhint="search"
              [value]="searchQuery()"
              (input)="searchQuery.set(findInput.value)"
              (keydown.enter)="goToMatch(1)"
              (keydown.shift.enter)="goToMatch(-1)"
              (keydown.escape)="clearSearch()"
            />
            @if (searchQuery().trim().length >= minSearchLength) {
              <span class="find-count mono" [class.none]="searchState().total === 0" aria-live="polite">
                {{ searchState().total === 0 ? 'Nessun risultato' : searchState().current + '/' + searchState().total }}
              </span>
            }
            <button
              type="button"
              class="find-nav"
              aria-label="Risultato precedente"
              title="Precedente (Maiusc+Invio)"
              [disabled]="searchState().total === 0"
              (click)="goToMatch(-1)"
            >↑</button>
            <button
              type="button"
              class="find-nav"
              aria-label="Risultato successivo"
              title="Successivo (Invio)"
              [disabled]="searchState().total === 0"
              (click)="goToMatch(1)"
            >↓</button>
          </div>
        }
        <div class="topbar-actions">
          <span class="timer mono">{{ elapsedLabel() }}</span>
          <span class="steps mono">{{ movesLabel(game()?.moves ?? 0) }}</span>
          <button type="button" class="link-button" (click)="goHome()">Esci</button>
          <button type="button" class="link-button danger" (click)="abandon()">Arrenditi</button>
        </div>
      </header>

      @if (isLoading()) {
        <span class="visually-hidden">Caricamento pagina…</span>
        <div class="article-ghost" aria-hidden="true">
          @for (paragraph of ghostParagraphs; track $index) {
            <p>
              @for (line of paragraph; track $index) {
                <span class="skeleton-bone" [style.width.%]="line"></span>
              }
            </p>
          }
        </div>
      } @else if (loadFailed()) {
        <p class="error centered">Impossibile caricare la partita.</p>
        <button type="button" class="cta" (click)="loadGame()">Riprova</button>
      } @else if (isCompleted()) {
        <div class="completed-overlay">
          <div class="completed-card">
            <h1>Traguardo raggiunto</h1>
            <app-wiki-route
              class="completed-route"
              [start]="game()!.startPageTitle"
              [target]="game()!.targetPageTitle"
            />
            <p class="muted">
              In <strong>{{ movesLabel(game()!.moves) }}</strong> e
              <strong>{{ elapsedLabel() }}</strong>.
            </p>
            <app-game-path [path]="game()!.path" />
            <button type="button" class="cta" (click)="goHome()">Torna alla home</button>
          </div>
        </div>
      } @else {
        @if (errorMessage()) {
          <p class="error">{{ errorMessage() }}</p>
        }
        <app-wiki-article
          [html]="game()?.currentPageContent ?? ''"
          [disabled]="isNavigating()"
          [searchQuery]="searchQuery()"
          (searchStateChange)="searchState.set($event)"
          (titleClicked)="followLink($event)"
        />
      }
    </div>
  `,
})
export class GameComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);

  readonly game = signal<GameState | null>(null);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly isNavigating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isCompleted = signal(false);
  readonly elapsedLabel = signal('00:00');
  readonly searchQuery = signal('');
  readonly searchState = signal<ArticleSearchState>({ current: 0, total: 0 });

  private readonly article = viewChild(WikiArticleComponent);
  private readonly findInput = viewChild<ElementRef<HTMLInputElement>>('findInput');

  private timerHandle?: ReturnType<typeof setInterval>;
  private baselineElapsedSeconds = 0;
  private baselineWallClockMs = 0;

  protected readonly movesLabel = movesLabel;
  protected readonly minSearchLength = MIN_SEARCH_LENGTH;
  // Line widths (%) of the article's loading ghost, one array per paragraph.
  protected readonly ghostParagraphs = [
    [100, 97, 100, 62],
    [100, 94, 100, 98, 100, 41],
    [96, 100, 88],
    [100, 99, 100, 93, 70],
    [100, 96, 100, 100, 84],
    [98, 100, 55],
  ];

  ngOnInit(): void {
    this.loadGame();
  }

  loadGame(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.isLoading.set(true);
    this.loadFailed.set(false);

    this.gameService
      .getGame(id)
      .pipe(withRequestTimeout())
      .subscribe((result) => {
        this.isLoading.set(false);

        if (result === 'error') {
          this.loadFailed.set(true);
          return;
        }

        this.applyGameState(result);
      });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  protected isArticleVisible(): boolean {
    return !this.isLoading() && !this.loadFailed() && !this.isCompleted();
  }

  goToMatch(delta: 1 | -1): void {
    this.article()?.goToMatch(delta);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  // The search bar is always on screen, so Ctrl/Cmd+F lands in it instead
  // of opening the browser's own find bar — one search, not two.
  protected onDocumentKeydown(event: KeyboardEvent): void {
    const input = this.findInput()?.nativeElement;
    if (!input || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return;

    event.preventDefault();
    input.focus();
    input.select();
  }

  followLink(clickedTitle: string): void {
    const game = this.game();
    if (!game) return;

    this.errorMessage.set(null);
    this.isNavigating.set(true);

    this.gameService.followLink(game.gameId, clickedTitle).subscribe({
      next: (updated) => {
        this.applyGameState(updated);
        this.isNavigating.set(false);
        window.scrollTo({ top: 0 });
      },
      error: () => {
        this.isNavigating.set(false);
        this.errorMessage.set(`'${clickedTitle}' non è un link valido su questa pagina.`);
      },
    });
  }

  abandon(): void {
    const game = this.game();
    if (!game) return;

    this.gameService.abandonGame(game.gameId).subscribe(() => this.goHome());
  }

  goHome(): void {
    const game = this.game();
    if (game?.status === 'IN_PROGRESS') {
      this.gameService.pauseGame(game.gameId).subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: () => this.router.navigateByUrl('/'),
      });
      return;
    }

    this.router.navigateByUrl('/');
  }

  private applyGameState(game: GameState): void {
    this.game.set(game);
    this.isCompleted.set(game.status === 'COMPLETED');
    this.syncTimer(game);
  }

  private syncTimer(game: GameState): void {
    this.baselineElapsedSeconds = game.elapsedSeconds;
    this.baselineWallClockMs = Date.now();
    this.updateElapsedLabel();

    if (game.status !== 'IN_PROGRESS') {
      this.stopTimer();
      return;
    }

    if (!this.timerHandle) {
      this.timerHandle = setInterval(() => this.updateElapsedLabel(), 1000);
    }
  }

  private updateElapsedLabel(): void {
    const elapsedSeconds =
      this.baselineElapsedSeconds + Math.floor((Date.now() - this.baselineWallClockMs) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    this.elapsedLabel.set(`${minutes}:${seconds}`);
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = undefined;
    }
  }
}