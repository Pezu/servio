import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastService = inject(ToastService);
  const token = localStorage.getItem('token');

  let request = req;
  if (token) {
    request = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      console.log('[AuthInterceptor] Error status:', error.status, 'URL:', req.url);

      if (error.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn');
        // Only redirect to login if we're in the backoffice section
        const currentUrl = router.url;
        if (currentUrl.startsWith('/backoffice')) {
          router.navigate(['/backoffice/login']);
        }
      } else if (error.status === 0) {
        toastService.error('Network error. Please check your connection.');
      } else if (error.status >= 400) {
        // Skip toast for registration-not-found errors on client registration endpoint
        // This is expected when a stored registration has expired/been deleted
        const isRegistrationNotFound = error.status === 404 &&
          req.url.includes('/api/register/') &&
          error.error?.message?.includes('not found');

        if (!isRegistrationNotFound) {
          const message = error.error?.message || error.message || 'An error occurred';
          toastService.error(message);
        }
      }

      return throwError(() => error);
    })
  );
};