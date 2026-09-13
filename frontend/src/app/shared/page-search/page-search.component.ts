import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { WikiService } from '../../core/services/wiki.service';
import { WikiSearchResult } from '../../core/models/wiki-search.model';
import { WikiPageCardComponent, WikiRouteSide } from '../wiki-route/wiki-route.component';

@Component({
  selector: 'app-page-search',
  imports: [ReactiveFormsModule, WikiPageCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './page-search.component.scss',
  template: `
    <div class="page-search">
      <label class="field-label">{{ label() }}</label>

      @if (selected(); as page) {
        <app-wiki-page-card class="selected-page" [title]="page.title" [thumbnail]="page.thumbnailUrl" [side]="side()">
          <button type="button" class="change-button" (click)="clear()">Cambia</button>
        </app-wiki-page-card>
      } @else {
        <div class="search-row">
          <input
            type="text"
            class="search-input"
            [formControl]="queryControl"
            placeholder="Cerca una pagina Wikipedia…"
            autocomplete="off"
          />
          <button type="button" class="random-button" [disabled]="isRandomLoading()" (click)="pickRandom()">
            {{ isRandomLoading() ? '…' : '🎲 Random' }}
          </button>
        </div>

        <!-- position: relative anchor so the dropdown below can float
             without pushing the rest of the page down (see scss) -->
        <div class="results-anchor">
          @if (isSearching()) {
            <p class="dropdown-message">Ricerca in corso…</p>
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
      }
    </div>
  `,
})
export class PageSearchComponent {
  private readonly wikiService = inject(WikiService);

  readonly label = input.required<string>();
  readonly side = input<WikiRouteSide>('start');
  // Carries whether this pick came from the 🎲 Random button — the
  // parent needs this to tell GameService the choice was left to
  // chance, not typed in by the player.
  readonly pageSelected = output<{ page: WikiSearchResult; wasRandom: boolean } | null>();

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly selected = signal<WikiSearchResult | null>(null);
  readonly isSearching = signal(false);
  readonly isRandomLoading = signal(false);

  readonly results = toSignal(
    this.queryControl.valueChanges.pipe(
      tap(() => this.isSearching.set(true)),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return of<WikiSearchResult[]>([]);
        return this.wikiService.search(trimmed);
      }),
      tap(() => this.isSearching.set(false)),
    ),
    { initialValue: [] as WikiSearchResult[] },
  );

  select(result: WikiSearchResult, wasRandom = false): void {
    this.selected.set(result);
    this.queryControl.setValue('', { emitEvent: false });
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

  clear(): void {
    this.selected.set(null);
    this.pageSelected.emit(null);
  }
}