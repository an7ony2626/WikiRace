import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PasswordFieldComponent } from '../../../shared/password-field/password-field.component';
import { AnimatedBackgroundComponent } from '../../../shared/animated-background/animated-background.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordFieldComponent, AnimatedBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'login.component.scss',
  template: `
    <div class="auth-screen">
      <app-animated-background />
      <div class="auth-card">
        <a routerLink="/" class="brand-link" aria-label="Torna alla home"><img class="brand-logo" src="/logo-wordmark.png" alt="WikiRace"></a>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span>Username</span>
            <input type="text" formControlName="username" autocomplete="username" />
          </label>

          <app-password-field [control]="form.controls.rawPassword" autocomplete="current-password" />

          @if (errorMessage()) {
            <p class="error">{{ errorMessage() }}</p>
          }

          <button type="submit" class="submit" [disabled]="form.invalid || isSubmitting()">
            {{ isSubmitting() ? 'Accesso in corso…' : 'Accedi' }}
          </button>
        </form>

        <p class="switch">
          Non hai un account? <a routerLink="/register">Registrati</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    rawPassword: ['', Validators.required],
  });

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Username o password non corretti.');
      },
    });
  }
}