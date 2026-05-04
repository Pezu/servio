import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel
  ],
  template: `
    <ion-app>
      <ion-menu contentId="main-content" side="start" type="overlay">
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>Menu</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list lines="none">
            <ion-item button (click)="goTo('/my-events')">
              <ion-icon name="calendar-outline" slot="start"></ion-icon>
              <ion-label>Active Events</ion-label>
            </ion-item>
            <ion-item button (click)="logout()">
              <ion-icon name="log-out-outline" slot="start"></ion-icon>
              <ion-label>Logout</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-menu>

      <ion-router-outlet id="main-content"></ion-router-outlet>
    </ion-app>
  `,
  styles: [`
    ion-menu ion-toolbar {
      --background: #ffffff;
      --color: #1e293b;
      --border-color: #e2e8f0;
      --border-width: 0 0 1px 0;
      --border-style: solid;
    }

    ion-menu ion-content {
      --background: #ffffff;
    }

    ion-menu ion-item {
      --background: #ffffff;
      --color: #1e293b;
    }
  `]
})
export class AppComponent {
  constructor(
    private router: Router,
    private menuCtrl: MenuController,
    private authService: AuthService
  ) {
    addIcons({ calendarOutline, logOutOutline });
  }

  async goTo(path: string): Promise<void> {
    await this.menuCtrl.close();
    this.router.navigate([path]);
  }

  async logout(): Promise<void> {
    await this.menuCtrl.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}