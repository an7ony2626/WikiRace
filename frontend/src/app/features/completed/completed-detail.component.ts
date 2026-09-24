import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { CompletedGameDetail } from '../../core/models/game.model';
import { GamePathComponent } from '../../shared/game-path/game-path.component';
import { DurationPipe, movesLabel } from '../../shared/duration/duration.pipe';
import { WikiRouteComponent } from '../../shared/wiki-route/wiki-route.component';
import { withColdStartRetry } from '../../shared/http/cold-start-retry';
import { AnimatedBackgroundComponent } from '../../shared/animated-background/animated-background.component';

@Component({
  selector: 'app-completed-detail',
  imports: [RouterLink, GamePathComponent, DurationPipe, WikiRouteComponent, AnimatedBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'completed-detail.component.scss',
  template: `
    <div class="page">
      <app-animated-background />
      <header class="topbar">
        <a routerLink="/" class="brand"><img src="/logo-wordmark.png" alt="WikiRace"></a>
      </header>

      <main class="content">
        @if (isLoading()) {
          <span class="visually-hidden">Caricamento partita…</span>
          @if (isWaking()) {
            <p class="muted">Il server si sta risvegliando, un attimo…</p>
          }
          <section class="summary-card" aria-hidden="true">
            <p class="username"><span class="skeleton-bone" style="--w: 7em"></span></p>
            <app-wiki-route class="route" [start]="null" [target]="null" />
            <p class="muted"><span class="skeleton-bone" style="--w: 18em"></span></p>
          </section>
          <app-game-path [path]="null" aria-hidden="true" />
        } @else if (loadFailed()) {
          <p class="error">Impossibile caricare questa partita.</p>
        } @else if (game(); as g) {
          <section class="summary-card">
            <p class="username">{{ g.username }}</p>
            <app-wiki-route class="route" [start]="g.startPageTitle" [target]="g.targetPageTitle" />
            <p class="muted">
              {{ movesLabel(g.moves) }} · {{ g.totalTimeSeconds | duration }}
              · {{ g.isRandomChallenge ? 'Sfida casuale' : 'Sfida personalizzata' }}
            </p>
          </section>

          <app-game-path [path]="g.path" />
        }
      </main>
    </div>
  `,
})
export class CompletedDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);

  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly isWaking = signal(false);
  readonly game = signal<CompletedGameDetail | null>(null);

  protected readonly movesLabel = movesLabel;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    withColdStartRetry(this.gameService.getCompletedGameDetail(id), () => this.isWaking.set(true))
      .pipe(catchError(() => of('error' as const)))
      .subscribe((result) => {
        this.isLoading.set(false);

        if (result === 'error') {
          this.loadFailed.set(true);
          return;
        }

        this.game.set(result);
      });
  }
}
