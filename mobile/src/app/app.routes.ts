import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'my-events',
    loadComponent: () => import('./pages/my-events/my-events.page').then(m => m.MyEventsPage),
    canActivate: [authGuard]
  },
  {
    path: 'event/:id',
    loadComponent: () => import('./pages/event/event.page').then(m => m.EventPage),
    canActivate: [authGuard],
    children: [
      {
        path: 'tables',
        loadComponent: () => import('./pages/event/tables/tables.page').then(m => m.TablesPage)
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/event/orders/orders.page').then(m => m.OrdersPage)
      },
      {
        path: 'payments',
        loadComponent: () => import('./pages/event/payments/payments.page').then(m => m.PaymentsPage)
      },
      {
        path: '',
        redirectTo: 'orders',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];