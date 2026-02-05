import { Routes } from '@angular/router';

export const BACKOFFICE_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./backoffice-shell.component')
      .then(m => m.BackofficeShellComponent),
    children: [
      {
        path: 'clients',
        loadComponent: () => import('./clients/clients.component')
          .then(m => m.ClientsComponent)
      },
      {
        path: 'locations',
        loadComponent: () => import('./locations/locations.component')
          .then(m => m.LocationsComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./users/users.component')
          .then(m => m.UsersComponent)
      },
      {
        path: 'menu',
        loadComponent: () => import('./menu/menu.component')
          .then(m => m.ClientMenuComponent)
      },
      {
        path: 'events',
        loadComponent: () => import('./events/events.component')
          .then(m => m.EventsComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders/orders.component')
          .then(m => m.OrdersComponent)
      },
      {
        path: 'my-events',
        loadComponent: () => import('./my-events/my-events.component')
          .then(m => m.MyEventsComponent)
      },
      {
        path: 'configuration',
        children: [
          {
            path: 'roles',
            loadComponent: () => import('./configuration/roles/roles.component')
              .then(m => m.RolesComponent)
          },
          {
            path: 'payment-types',
            loadComponent: () => import('./configuration/payment-types/payment-types.component')
              .then(m => m.PaymentTypesComponent)
          },
          {
            path: 'client-types',
            loadComponent: () => import('./configuration/client-types/client-types.component')
              .then(m => m.ClientTypesComponent)
          },
          {
            path: 'menu',
            loadComponent: () => import('./configuration/menu/menu.component')
              .then(m => m.MenuComponent)
          },
          {
            path: '',
            redirectTo: 'roles',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: '',
        redirectTo: 'clients',
        pathMatch: 'full'
      }
    ]
  }
];
