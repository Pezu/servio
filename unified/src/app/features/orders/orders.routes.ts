import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-dashboard.component')
      .then(m => m.OrderDashboardComponent)
  }
];
