import { ChangeDetectionStrategy, Component, computed, input, resource, signal } from '@angular/core';
import { wikiUrl } from '../wiki-link/wiki-link';
import { fetchWikiThumbnail } from '../wiki-link/wiki-thumbnail';

export type WikiRouteSize = 'large' | 'compact';

// One side of the route: thumbnail + title, the whole block being a link
// to the Wikipedia article.
@Component({
  selector: 'app-wiki-page-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'wiki-page-tile.component.scss',
  host: { '[class.compact]': "size() === 'compact'" },
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
          <img [src]="src" alt="" (error)="failedSrc.set(src)" />
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
  readonly size = input<WikiRouteSize>('large');
  // Pass it when the caller already has it (e.g. a search result) to skip
  // the lookup; null means "known to have no image". Left undefined, the
  // thumbnail is fetched from Wikipedia.
  readonly thumbnail = input<string | null | undefined>(undefined);

  protected readonly wikiUrl = wikiUrl;
  // The URL that failed to load, so a later page with a different image
  // isn't stuck on the placeholder.
  protected readonly failedSrc = signal<string | null>(null);

  private readonly fetched = resource({
    // undefined params keep the resource idle: nothing to fetch.
    params: () => (this.thumbnail() === undefined ? this.title() : undefined),
    loader: ({ params }) => fetchWikiThumbnail(params),
  });

  protected readonly thumbnailUrl = computed(() => {
    const known = this.thumbnail();
    const src = known !== undefined ? known : this.fetched.hasValue() ? this.fetched.value() : null;
    return src === this.failedSrc() ? null : src;
  });

  protected readonly initial = computed(() => this.title().trim().charAt(0).toUpperCase());
}

// The page in its own card: used both while picking the pages of a new
// game and wherever a game's route is shown afterwards, so the two look
// the same. Projected content (e.g. a "Cambia" button) goes under the page.
@Component({
  selector: 'app-wiki-page-card',
  imports: [WikiPageTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'wiki-page-card.component.scss',
  template: `
    <app-wiki-page-tile [title]="title()" [thumbnail]="thumbnail()" />
    <ng-content />
  `,
})
export class WikiPageCardComponent {
  readonly title = input.required<string>();
  readonly thumbnail = input<string | null | undefined>(undefined);
}

@Component({
  selector: 'app-wiki-route',
  imports: [WikiPageTileComponent, WikiPageCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'wiki-route.component.scss',
  host: { '[class.compact]': "size() === 'compact'" },
  template: `
    @if (size() === 'compact') {
      <app-wiki-page-tile [title]="start()" size="compact" />
      <span class="arrow" aria-label="verso">→</span>
      <app-wiki-page-tile [title]="target()" size="compact" />
    } @else {
      <div class="side">
        <span class="field-label">Pagina di partenza</span>
        <app-wiki-page-card [title]="start()" />
      </div>
      <span class="arrow" aria-label="verso">→</span>
      <div class="side">
        <span class="field-label">Pagina di arrivo</span>
        <app-wiki-page-card [title]="target()" />
      </div>
    }
  `,
})
export class WikiRouteComponent {
  readonly start = input.required<string>();
  readonly target = input.required<string>();
  readonly size = input<WikiRouteSize>('large');
}
