import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth.guard';

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
    canActivate: [authGuard],
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
        path: 'reports',
        children: [
          {
            path: 'revenue',
            loadComponent: () => import('./reports/revenue/revenue.component')
              .then(m => m.RevenueComponent)
          },
          {
            path: 'event',
            loadComponent: () => import('./reports/event-report/event-report.component')
              .then(m => m.EventReportComponent)
          },
          {
            path: '',
            redirectTo: 'revenue',
            pathMatch: 'full'
          }
        ]
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
            path: 'allergens',
            loadComponent: () => import('./configuration/allergens/allergens.component')
              .then(m => m.AllergensComponent)
          },
          {
            path: 'vat-types',
            loadComponent: () => import('./configuration/vat-types/vat-types.component')
              .then(m => m.VatTypesComponent)
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
