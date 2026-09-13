import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

// Wikipedia's real Vector skin stylesheet — loaded here instead of a
// hand-written CSS approximation of infobox/thumb/gallery layout, so the
// article looks exactly like it does on wikipedia.org. ShadowDom
// encapsulation is what makes this safe: a stylesheet built for an
// entire external site is scoped to this component's shadow root and
// cannot leak out to, or be affected by, the rest of the app.
// only=styles means no Wikipedia JS is loaded — nothing here can
// interfere with our own click handling below.
const WIKIPEDIA_STYLES_URL =
  'https://it.wikipedia.org/w/load.php?lang=it&modules=site.styles%7Cskins.vector.styles%7Cmediawiki.skinning.content.parsoid%7Cext.cite.styles&only=styles&skin=vector-2022';

// Below this, a query would match nearly every word on the page.
export const MIN_SEARCH_LENGTH = 2;

export interface ArticleSearchState {
  // 1-based index of the highlighted match, 0 when there are none.
  current: number;
  total: number;
}

@Component({
  selector: 'app-wiki-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrl: './wiki-article.component.scss',
  template: `
    <link rel="stylesheet" [href]="stylesUrl" />
    <div
      #content
      class="mw-parser-output wiki-article"
      [innerHTML]="sanitizedContent()"
      (click)="onClick($event)"
    ></div>
  `,
})
export class WikiArticleComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  readonly html = input.required<string>();
  readonly disabled = input(false);
  readonly searchQuery = input('');
  readonly titleClicked = output<string>();
  readonly searchStateChange = output<ArticleSearchState>();

  // <link href> is a resource-URL context: without an explicit trust
  // Angular refuses the binding (NG0904) and the stylesheet never loads.
  protected readonly stylesUrl = this.sanitizer.bypassSecurityTrustResourceUrl(WIKIPEDIA_STYLES_URL);

  // computed, not a plain method: a fresh SafeHtml on every change
  // detection would make Angular rewrite innerHTML on each click inside
  // the article, wiping the search highlights.
  protected readonly sanitizedContent = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.html()),
  );

  private matches: HTMLElement[] = [];
  private activeIndex = -1;
  private lastQuery = '';

  constructor() {
    // Runs after the DOM is updated, so a new page's HTML is already in
    // place when the current query is re-applied to it.
    afterRenderEffect(() => {
      this.sanitizedContent();
      this.highlight(this.searchQuery().trim());
    });
  }

  goToMatch(delta: 1 | -1): void {
    const total = this.matches.length;
    if (total === 0) return;
    this.setActive((this.activeIndex + delta + total) % total);
  }

  protected onClick(event: MouseEvent): void {
    if (this.disabled()) return;

    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;

    event.preventDefault();

    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/wiki/')) return;

    const title = decodeURIComponent(href.slice('/wiki/'.length).split('#')[0]).replace(/_/g, ' ');
    this.titleClicked.emit(title);
  }

  private highlight(query: string): void {
    this.clearHighlights();
    // Jump to the first match only when the query itself changed: after
    // following a link the new page should still open at the top.
    const queryChanged = query !== this.lastQuery;
    this.lastQuery = query;

    if (query.length < MIN_SEARCH_LENGTH) {
      this.searchStateChange.emit({ current: 0, total: 0 });
      return;
    }

    const root = this.content().nativeElement;
    const needle = query.toLocaleLowerCase('it');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    for (const node of textNodes) {
      if (node.parentElement?.closest('style, script')) continue;

      const text = node.data;
      const haystack = text.toLocaleLowerCase('it');
      let index = haystack.indexOf(needle);
      if (index === -1) continue;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      while (index !== -1) {
        fragment.append(text.slice(cursor, index));
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        mark.textContent = text.slice(index, index + needle.length);
        fragment.append(mark);
        this.matches.push(mark);
        cursor = index + needle.length;
        index = haystack.indexOf(needle, cursor);
      }
      fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
    }

    // Text inside hidden elements can't be scrolled to: leave it out of the count.
    this.matches = this.matches.filter((mark) => mark.getClientRects().length > 0);

    if (this.matches.length > 0) {
      this.setActive(0, queryChanged);
    } else {
      this.searchStateChange.emit({ current: 0, total: 0 });
    }
  }

  private setActive(index: number, scroll = true): void {
    this.matches[this.activeIndex]?.classList.remove('active');
    this.activeIndex = index;

    const mark = this.matches[index];
    mark.classList.add('active');
    if (scroll) mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.searchStateChange.emit({ current: index + 1, total: this.matches.length });
  }

  private clearHighlights(): void {
    const parents = new Set<Node>();
    this.content()
      .nativeElement.querySelectorAll('mark.search-hit')
      .forEach((mark) => {
        if (mark.parentNode) parents.add(mark.parentNode);
        mark.replaceWith(mark.textContent ?? '');
      });
    // Merge the split text nodes back, so the next search sees whole words.
    parents.forEach((parent) => parent.normalize());

    this.matches = [];
    this.activeIndex = -1;
  }
}
