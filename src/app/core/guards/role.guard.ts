import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Usage in a route definition:
 *   { path: 'users', canActivate: [roleGuard(['admin'])], ... }
 */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }
    const role = auth.role();
    if (role && allowedRoles.includes(role)) {
      return true;
    }
    router.navigate(['/dashboard']);
    return false;
  };
}
