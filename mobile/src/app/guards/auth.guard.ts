import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const info = authService.getUserInfo();
    if (info && info.roles.includes('WAITER')) {
      return true;
    }
    authService.logout();
  }

  router.navigate(['/login']);
  return false;
};