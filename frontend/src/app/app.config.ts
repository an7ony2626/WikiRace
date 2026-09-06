import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Matches Spring Security's CookieCsrfTokenRepository defaults on
      // the backend (see SecurityConfig) — Angular reads this cookie and
      // echoes it back as a header on state-changing requests.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // Kicks off session resolution without blocking bootstrap — see
    // AuthService.initSession() for why this doesn't await the request.
    provideAppInitializer(() => inject(AuthService).initSession()),
  ],
};
