import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth.guard';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-dashboard.component')
      .then(m => m.OrderDashboardComponent),
    canActivate: [authGuard]
  }
];
