import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameStep } from '../../core/models/game.model';
import { skeletonRows } from '../skeleton/skeleton';

// The "resoconto" (path recap) shown both on the completed-game detail
// page and on the in-game congratulations screen when a run finishes —
// one component so the two never drift apart. A null path draws its
// loading ghost.
@Component({
  selector: 'app-game-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-path.component.scss',
  template: `
    <section class="path-card">
      <h2>Percorso seguito</h2>
      <ol class="path-chain">
        @if (path(); as steps) {
          @for (step of steps; track step.stepNumber; let first = $first, last = $last) {
            <li>
              <span class="page-title" [class.start]="first" [class.target]="last && !first">{{ step.pageTitle }}</span>
              @if (!last) {
                <span class="arrow" aria-hidden="true">→</span>
              }
            </li>
          }
        } @else {
          @for (step of ghostSteps; track step; let last = $last) {
            <li aria-hidden="true">
              <span class="page-title"><span class="skeleton-bone" style="--w: 7em"></span></span>
              @if (!last) {
                <span class="arrow">→</span>
              }
            </li>
          }
        }
      </ol>
    </section>
  `,
})
export class GamePathComponent {
  readonly path = input.required<GameStep[] | null>();

  protected readonly ghostSteps = skeletonRows(4);
}