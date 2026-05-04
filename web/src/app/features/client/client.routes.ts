import { Routes } from '@angular/router';

export const CLIENT_ROUTES: Routes = [
  {
    path: 'events/:eventId/order-points/:orderPointId',
    loadComponent: () => import('./registration/registration.component')
      .then(m => m.RegistrationComponent)
  },
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full'
  }
];
