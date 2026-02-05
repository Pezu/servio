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
        router.navigate(['/backoffice/login']);
      } else if (error.status === 0) {
        toastService.error('Network error. Please check your connection.');
      } else if (error.status >= 400) {
        const message = error.error?.message || error.message || 'An error occurred';
        toastService.error(message);
      }

      return throwError(() => error);
    })
  );
};