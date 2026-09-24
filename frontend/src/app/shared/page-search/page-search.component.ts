import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, of, switchMap, tap, timer } from 'rxjs';
import { WikiService } from '../../core/services/wiki.service';
import { WikiSearchResult } from '../../core/models/wiki-search.model';
import { WikiPageCardComponent } from '../wiki-route/wiki-route.component';
import { skeletonRows } from '../skeleton/skeleton';

// The dropdown shows about this many results before it scrolls.
const VISIBLE_RESULTS = 5;

@Component({
  selector: 'app-page-search',
  imports: [NgTemplateOutlet, ReactiveFormsModule, WikiPageCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './page-search.component.scss',
  template: `
    <div class="page-search">
      <label class="field-label">{{ label() }}</label>

      <!-- Once a page is picked it can be swapped straight from its card:
           Random stays in the top-right corner and the search bar moves
           under the page, so there is no "Cambia" step in between. -->
      @if (selected(); as page) {
        <app-wiki-page-card class="selected-page" [title]="page.title" [thumbnail]="page.thumbnailUrl">
          <ng-container [ngTemplateOutlet]="randomButton" />
          <div class="search-under-page">
            <ng-container [ngTemplateOutlet]="searchInput" />
            <ng-container [ngTemplateOutlet]="dropdown" />
          </div>
        </app-wiki-page-card>
      } @else {
        <div class="search-row">
          <ng-container [ngTemplateOutlet]="searchInput" />
          <ng-container [ngTemplateOutlet]="randomButton" />
        </div>
        <ng-container [ngTemplateOutlet]="dropdown" />
      }
    </div>

    <ng-template #searchInput>
      <input
        type="text"
        class="search-input"
        [formControl]="queryControl"
        placeholder="Cerca una pagina Wikipedia…"
        autocomplete="off"
      />
    </ng-template>

    <ng-template #randomButton>
      <button type="button" class="random-button" [disabled]="isRandomLoading()" (click)="pickRandom()">
        {{ isRandomLoading() ? '…' : '🎲 Random' }}
      </button>
    </ng-template>

    <!-- position: relative anchor so the dropdown below can float
         without pushing the rest of the page down (see scss) -->
    <ng-template #dropdown>
      <div class="results-anchor">
        @if (isSearching()) {
          <span class="visually-hidden">Ricerca in corso…</span>
          <ul class="results" aria-hidden="true">
            @for (row of ghostResults(); track row) {
              <li>
                <div class="result-row skeleton-row">
                  <span class="thumb ghost"></span>
                  <span class="result-text">
                    <span class="result-title"><span class="skeleton-bone" style="--w: 9em"></span></span>
                    <span class="result-extract"><span class="skeleton-bone" style="--w: 26em"></span></span>
                  </span>
                </div>
              </li>
            }
          </ul>
        } @else if (results().length > 0) {
          <ul class="results">
            @for (result of results(); track result.title) {
              <li>
                <button type="button" class="result-row" (click)="select(result)">
                  <span class="thumb" [class.placeholder]="!result.thumbnailUrl">
                    @if (result.thumbnailUrl) {
                      <img [src]="result.thumbnailUrl" [alt]="result.title" />
                    }
                  </span>
                  <span class="result-text">
                    <span class="result-title">{{ result.title }}</span>
                    @if (result.extract) {
                      <span class="result-extract">{{ result.extract }}</span>
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </ng-template>
  `,
})
export class PageSearchComponent {
  private readonly wikiService = inject(WikiService);

  readonly label = input.required<string>();
  // Carries whether this pick came from the 🎲 Random button — the
  // parent needs this to tell GameService the choice was left to
  // chance, not typed in by the player.
  readonly pageSelected = output<{ page: WikiSearchResult; wasRandom: boolean } | null>();

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly selected = signal<WikiSearchResult | null>(null);
  readonly isSearching = signal(false);
  readonly isRandomLoading = signal(false);

  // The debounce lives inside switchMap so that clearing the query (which
  // select() does, while the search bar stays on screen) empties the
  // dropdown at once and cancels any search still waiting or in flight.
  readonly results = toSignal(
    this.queryControl.valueChanges.pipe(
      map((query) => query.trim()),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.length < 2) {
          this.isSearching.set(false);
          return of<WikiSearchResult[]>([]);
        }
        this.isSearching.set(true);
        return timer(300).pipe(
          switchMap(() => this.wikiService.search(query)),
          tap(() => this.isSearching.set(false)),
        );
      }),
    ),
    { initialValue: [] as WikiSearchResult[] },
  );

  // While a search runs, ghost the results already listed (refining a
  // query keeps the dropdown's size) or a full dropdown for a first search.
  readonly ghostResults = computed(() =>
    skeletonRows(Math.min(this.results().length || VISIBLE_RESULTS, VISIBLE_RESULTS)),
  );

  select(result: WikiSearchResult, wasRandom = false): void {
    this.selected.set(result);
    this.queryControl.setValue('');
    this.pageSelected.emit({ page: result, wasRandom });
  }

  pickRandom(): void {
    if (this.isRandomLoading()) return;
    this.isRandomLoading.set(true);

    this.wikiService.getRandom().subscribe({
      next: (result) => {
        this.isRandomLoading.set(false);
        this.select(result, true);
      },
      error: () => this.isRandomLoading.set(false),
    });
  }
}