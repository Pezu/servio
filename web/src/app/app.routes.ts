import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'backoffice',
    loadChildren: () => import('./features/backoffice/backoffice.routes')
      .then(m => m.BACKOFFICE_ROUTES)
  },
  {
    path: 'event/customer/:eventId/order-points/:orderPointId',
    loadComponent: () => import('./features/client/registration/registration.component')
      .then(m => m.RegistrationComponent)
  },
  {
    path: 'event/:eventId/orders',
    loadChildren: () => import('./features/orders/orders.routes')
      .then(m => m.ORDERS_ROUTES)
  },
  {
    path: 'payment/confirmed',
    loadComponent: () => import('./features/payment/payment-confirmed.component')
      .then(m => m.PaymentConfirmedComponent)
  },
  {
    path: '',
    redirectTo: 'backoffice',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'backoffice'
  }
];
