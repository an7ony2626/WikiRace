import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Session resolution is asynchronous now (it requires a round trip to
// read the httpOnly cookie server-side), so this guard waits on the
// same in-flight/resolved check the app initializer kicked off instead
// of reading a signal that might still be 'unknown'.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.waitForSession().pipe(map((authenticated) => authenticated || router.parseUrl('/login')));
};
