import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // The JWT now lives in an httpOnly cookie instead of being read and
  // attached as an Authorization header — withCredentials is what makes
  // the browser send (and accept) it cross-origin, and it's also what
  // enables Angular's built-in XSRF interceptor to attach the CSRF
  // header cross-origin (see app.config.ts's withXsrfConfiguration).
  const withCredentialsReq = req.clone({ withCredentials: true });

  return next(withCredentialsReq).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));

      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint) {
        authService.logout();
        inject(Router).navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};
