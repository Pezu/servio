import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, lockClosedOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon
  ],
  template: `
    <ion-content class="login-content">
      <div class="login-container">
        <div class="logo-section">
          <div class="logo">
            <svg viewBox="0 0 70 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="38,19 66,22 38,25" fill="url(#goldGrad)"/>
              <polygon points="34,25 64,28 34,31" fill="url(#goldGrad)" opacity="0.85"/>
              <polygon points="29,31 57,34 29,37" fill="url(#goldGrad)" opacity="0.7"/>
              <circle cx="20" cy="20" r="17" fill="white"/>
              <path d="M20 2C10.06 2 2 10.06 2 20s8.06 18 18 18 18-8.06 18-18S29.94 2 20 2z" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="85 28"/>
              <rect x="8" y="8" width="8" height="8" rx="1" fill="none" stroke="url(#goldGrad)" stroke-width="2"/>
              <rect x="11" y="11" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="24" y="8" width="8" height="8" rx="1" fill="none" stroke="url(#goldGrad)" stroke-width="2"/>
              <rect x="27" y="11" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="8" y="24" width="8" height="8" rx="1" fill="none" stroke="url(#goldGrad)" stroke-width="2"/>
              <rect x="11" y="27" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="19" y="9" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="9" y="19" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="19" y="19" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="29" y="19" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="19" y="29" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="25" y="25" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="29" y="25" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="25" y="29" width="2" height="2" fill="url(#goldGrad)"/>
              <rect x="29" y="29" width="2" height="2" fill="url(#goldGrad)"/>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6b7280"/>
                  <stop offset="0.5" stop-color="#4b5563"/>
                  <stop offset="1" stop-color="#374151"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 class="brand-name">servio</h1>
          <p class="brand-tagline">scan &bull; order &bull; enjoy</p>
        </div>

        <div class="form-section">
          <div class="input-group">
            <ion-icon name="person-outline" class="input-icon"></ion-icon>
            <ion-input
              type="text"
              [(ngModel)]="username"
              placeholder="Username"
              class="custom-input"
              [disabled]="loading"
            ></ion-input>
          </div>

          <div class="input-group">
            <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
            <ion-input
              type="password"
              [(ngModel)]="password"
              placeholder="Password"
              class="custom-input"
              [disabled]="loading"
            ></ion-input>
          </div>

          @if (error) {
            <ion-text color="danger" class="error-text">
              <p>{{ error }}</p>
            </ion-text>
          }

          <ion-button
            expand="block"
            (click)="login()"
            [disabled]="loading || !username || !password"
            class="login-button"
          >
            @if (loading) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Sign In
            }
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content {
      --background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }

    .login-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      padding: 24px;
    }

    .logo-section {
      text-align: center;
      margin-bottom: 48px;
    }

    .logo {
      width: 100px;
      height: 60px;
      margin: 0 auto 16px;
    }

    .logo svg {
      width: 100%;
      height: 100%;
    }

    .brand-name {
      font-size: 36px;
      font-weight: 300;
      color: #1e293b;
      letter-spacing: 3px;
      margin: 0 0 4px;
      text-transform: lowercase;
    }

    .brand-tagline {
      font-size: 12px;
      color: #94a3b8;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0;
    }

    .form-section {
      width: 100%;
      max-width: 320px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 20px;
      z-index: 10;
    }

    .custom-input {
      --background: white;
      --padding-start: 48px;
      --padding-end: 16px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      --border-radius: 12px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
    }

    .custom-input:focus-within {
      border-color: var(--ion-color-primary);
    }

    .error-text {
      display: block;
      text-align: center;
      margin-bottom: 16px;
    }

    .error-text p {
      margin: 0;
      font-size: 14px;
    }

    .login-button {
      --border-radius: 12px;
      --padding-top: 16px;
      --padding-bottom: 16px;
      margin-top: 8px;
      font-size: 16px;
      font-weight: 600;
    }
  `]
})
export class LoginPage {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ personOutline, lockClosedOutline });

    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/my-events']);
    }
  }

  login(): void {
    if (!this.username || !this.password) return;

    this.loading = true;
    this.error = '';

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/my-events']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.status === 401 ? 'Invalid username or password' : 'An error occurred. Please try again.';
      }
    });
  }
}