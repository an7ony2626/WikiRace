import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameStep } from '../../core/models/game.model';

// The "resoconto" (path recap) shown both on the completed-game detail
// page and on the in-game congratulations screen when a run finishes —
// one component so the two never drift apart.
@Component({
  selector: 'app-game-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-path.component.scss',
  template: `
    <section class="path-card">
      <h2>Percorso seguito</h2>
      <ol class="path-chain">
        @for (step of path(); track step.stepNumber; let first = $first, last = $last) {
          <li>
            <span class="page-title" [class.start]="first" [class.target]="last && !first">{{ step.pageTitle }}</span>
            @if (!last) {
              <span class="arrow" aria-hidden="true">→</span>
            }
          </li>
        }
      </ol>
    </section>
  `,
})
export class GamePathComponent {
  readonly path = input.required<GameStep[]>();
}