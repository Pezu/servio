import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginService } from './login.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="auth-wrapper">
      <div class="auth-inner">
        <div class="auth-card">
          <div class="logo-container">
            <div class="logo-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
          <div class="card-body">
            <h2 class="title">Login</h2>
            <h4 class="subtitle">Login to your account</h4>
            <p class="description">Welcome back to the Event Management backoffice. Please enter your credentials to continue.</p>

            <form class="login-form" (ngSubmit)="onLogin()" #loginForm="ngForm">
              <div class="form-group">
                <input
                  type="text"
                  class="form-control"
                  placeholder="Email or Username"
                  [(ngModel)]="username"
                  name="username"
                  required>
              </div>
              <div class="form-group">
                <input
                  type="password"
                  class="form-control"
                  placeholder="Password"
                  [(ngModel)]="password"
                  name="password"
                  required>
              </div>
              <div class="form-submit">
                <button type="submit" class="btn-login" [disabled]="isLoading">
                  {{ isLoading ? 'Logging in...' : 'Login' }}
                </button>
              </div>
              <div *ngIf="errorMessage" class="error-message">
                {{ errorMessage }}
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      padding: 20px;
    }

    .auth-inner {
      width: 100%;
      max-width: 420px;
    }

    .auth-card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      position: relative;
      margin-top: 30px;
    }

    .logo-container {
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
    }

    .logo-circle {
      width: 60px;
      height: 60px;
      background: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .logo-circle svg {
      width: 32px;
      height: 32px;
      color: #2196F3;
    }

    .card-body {
      padding: 50px 40px 40px;
    }

    .title {
      font-size: 24px;
      font-weight: 700;
      color: #333;
      margin: 0 0 8px 0;
    }

    .subtitle {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      margin: 0 0 8px 0;
    }

    .description {
      font-size: 13px;
      color: #888;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }

    .login-form {
      width: 100%;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-control {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .form-control:focus {
      outline: none;
      border-color: #2196F3;
      box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
    }

    .form-control::placeholder {
      color: #aaa;
    }

    .form-submit {
      margin-top: 24px;
    }

    .btn-login {
      width: 100%;
      padding: 14px 24px;
      background: #2196F3;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .btn-login:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(33, 150, 243, 0.4);
    }

    .btn-login:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .error-message {
      margin-top: 16px;
      padding: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-size: 13px;
      text-align: center;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private loginService: LoginService
  ) {}

  onLogin() {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter your username and password';
      return;
    }

    this.isLoading = true;

    this.loginService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.router.navigate(['/backoffice/clients']);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid username or password';
        this.isLoading = false;
      }
    });
  }
}
