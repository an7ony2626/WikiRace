import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { GameState } from '../../core/models/game.model';
import { WikiArticleComponent } from './wiki-article/wiki-article.component';
import { GamePathComponent } from '../../shared/game-path/game-path.component';
import { WikiPageLinkComponent } from '../../shared/wiki-page-link/wiki-page-link.component';
import { movesLabel } from '../../shared/duration/duration.pipe';
import { withRequestTimeout } from '../../shared/rxjs/with-request-timeout';

@Component({
  selector: 'app-game',
  imports: [WikiArticleComponent, GamePathComponent, WikiPageLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'game.component.scss',
  template: `
    <div class="page">
      @if (isNavigating()) {
        <div class="progress-bar"><div class="progress-fill"></div></div>
      }

      <header class="topbar">
        <span class="route-labels">
          @if (game(); as g) {
            <app-wiki-page-link [title]="g.startPageTitle" [bold]="true" />
            →
            <app-wiki-page-link [title]="g.targetPageTitle" [bold]="true" />
          }
        </span>
        <div class="topbar-actions">
          <span class="timer mono">{{ elapsedLabel() }}</span>
          <span class="steps mono">{{ movesLabel(game()?.moves ?? 0) }}</span>
          <button type="button" class="link-button" (click)="goHome()">Esci</button>
          <button type="button" class="link-button danger" (click)="abandon()">Arrenditi</button>
        </div>
      </header>

      @if (isLoading()) {
        <p class="muted centered">Caricamento pagina…</p>
      } @else if (loadFailed()) {
        <p class="error centered">Impossibile caricare la partita.</p>
        <button type="button" class="cta" (click)="loadGame()">Riprova</button>
      } @else if (isCompleted()) {
        <div class="completed-overlay">
          <div class="completed-card">
            <h1>Traguardo raggiunto</h1>
            <p class="muted">
              Da
              <app-wiki-page-link [title]="game()!.startPageTitle" [bold]="true" />
              a
              <app-wiki-page-link [title]="game()!.targetPageTitle" [bold]="true" />
              in
              <strong>{{ movesLabel(game()!.moves) }}</strong> e
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

  private timerHandle?: ReturnType<typeof setInterval>;
  private baselineElapsedSeconds = 0;
  private baselineWallClockMs = 0;

  protected readonly movesLabel = movesLabel;

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