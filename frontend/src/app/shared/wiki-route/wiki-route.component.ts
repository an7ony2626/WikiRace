import { ChangeDetectionStrategy, Component, computed, input, resource, signal } from '@angular/core';
import { wikiUrl } from '../wiki-link/wiki-link';
import { fetchWikiThumbnail } from '../wiki-link/wiki-thumbnail';

export type WikiRouteSize = 'large' | 'compact';

// One side of the route: thumbnail + title, the whole block being a link
// to the Wikipedia article. The ring colour matches the blue (start) and
// red (target) dots used for the route across the app.
@Component({
  selector: 'app-wiki-page-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'wiki-page-tile.component.scss',
  host: {
    '[class.compact]': "size() === 'compact'",
    '[class.target]': "side() === 'target'",
  },
  template: `
    <a
      class="tile"
      [href]="wikiUrl(title())"
      target="_blank"
      rel="noopener noreferrer"
      [attr.aria-label]="title() + ' — apri su Wikipedia in una nuova scheda'"
      [title]="'Apri «' + title() + '» su Wikipedia'"
    >
      <span class="thumb" aria-hidden="true">
        @if (thumbnailUrl(); as src) {
          <img [src]="src" alt="" (error)="imageFailed.set(true)" />
        } @else {
          <span class="initial">{{ initial() }}</span>
        }
      </span>
      <span class="text">
        <span class="name">{{ title() }}</span>
        <span class="hint" aria-hidden="true">
          @if (size() === 'large') {
            Apri su Wikipedia
          }
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </span>
    </a>
  `,
})
export class WikiPageTileComponent {
  readonly title = input.required<string>();
  readonly side = input<'start' | 'target'>('start');
  readonly size = input<WikiRouteSize>('large');

  protected readonly wikiUrl = wikiUrl;
  protected readonly imageFailed = signal(false);

  private readonly thumbnail = resource({
    params: () => this.title(),
    loader: ({ params }) => {
      this.imageFailed.set(false);
      return fetchWikiThumbnail(params);
    },
  });

  protected readonly thumbnailUrl = computed(() =>
    !this.imageFailed() && this.thumbnail.hasValue() ? this.thumbnail.value() : null,
  );

  protected readonly initial = computed(() => this.title().trim().charAt(0).toUpperCase());
}

@Component({
  selector: 'app-wiki-route',
  imports: [WikiPageTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'wiki-route.component.scss',
  host: { '[class.compact]': "size() === 'compact'" },
  template: `
    <app-wiki-page-tile [title]="start()" side="start" [size]="size()" />
    <span class="arrow" aria-label="verso">→</span>
    <app-wiki-page-tile [title]="target()" side="target" [size]="size()" />
  `,
})
export class WikiRouteComponent {
  readonly start = input.required<string>();
  readonly target = input.required<string>();
  readonly size = input<WikiRouteSize>('large');
}
