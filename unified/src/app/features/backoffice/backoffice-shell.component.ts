import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-backoffice-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule, CommonModule],
  host: {
    '[class.sidebar-collapsed]': 'sidebarCollapsed'
  },
  styles: [`
    .nxl-hasmenu > .nxl-submenu {
      display: none;
    }
    .nxl-hasmenu.nxl-trigger > .nxl-submenu {
      display: block;
    }
    .nxl-hasmenu.nxl-trigger > .nxl-link > .nxl-arrow {
      transform: rotate(90deg);
    }
    .nxl-arrow {
      margin-left: auto;
    }
    .nxl-arrow svg {
      width: 14px;
      height: 14px;
      transition: transform 0.2s ease;
    }
    .nxl-submenu {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    .nxl-submenu .nxl-link {
      margin-left: 45px !important;
    }
    /* Remove background on hover and active, just change text color */
    :host ::ng-deep .nxl-navbar .nxl-item > .nxl-link:hover {
      background: transparent !important;
      color: var(--primary) !important;
    }
    :host ::ng-deep .nxl-navbar .nxl-item > .nxl-link.active {
      background: transparent !important;
    }
    :host ::ng-deep .nxl-navbar .nxl-item > .nxl-link:hover .nxl-micon,
    :host ::ng-deep .nxl-navbar .nxl-item > .nxl-link:hover .nxl-mtext {
      color: var(--primary) !important;
    }
    .lang-switcher {
      position: relative;
      margin-right: 12px;
    }
    .lang-dropdown {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border: 1px solid #e0e0e0;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #333;
      transition: all 0.2s ease;
    }
    .lang-dropdown:hover {
      border-color: var(--primary);
    }
    .lang-dropdown .flag {
      font-size: 18px;
      line-height: 1;
    }
    .lang-dropdown .arrow {
      font-size: 10px;
      color: #666;
      transition: transform 0.2s ease;
    }
    .lang-switcher.open .lang-dropdown .arrow {
      transform: rotate(180deg);
    }
    .lang-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      overflow: hidden;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      z-index: 1000;
    }
    .lang-switcher.open .lang-menu {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .lang-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .lang-option:hover {
      background: #f5f5f5;
    }
    .lang-option.active {
      background: #f0f7ff;
      color: var(--primary);
    }
    .lang-option .flag {
      font-size: 18px;
      line-height: 1;
    }
    .user-menu-wrapper {
      position: relative;
    }
    .user-avatar-btn {
      cursor: pointer;
    }
    .user-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      overflow: hidden;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      z-index: 1000;
      min-width: 140px;
    }
    .user-menu-wrapper.open .user-menu {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .user-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      transition: background 0.15s ease;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }
    .user-menu-item:hover {
      background: #f5f5f5;
    }
    .user-menu-item svg {
      width: 16px;
      height: 16px;
      color: #666;
    }
    .user-menu-item.logout {
      color: #dc3545;
    }
    .user-menu-item.logout svg {
      color: #dc3545;
    }
  `],
  template: `
    <!-- Sidebar Navigation -->
    <nav class="nxl-navigation">
      <div class="m-header">
        <a href="/backoffice" class="b-brand">
          <span class="logo-text">Back<span>office</span></span>
        </a>
      </div>
      <div class="navbar-content">
        <ul class="nxl-navbar">
          <li class="nxl-item nxl-caption">
            <label>{{ 'NAV.NAVIGATION' | translate }}</label>
          </li>
          <li class="nxl-item nxl-hasmenu" [class.nxl-trigger]="clientsExpanded" *ngIf="canAccessClientMenu">
            <a href="javascript:void(0)" class="nxl-link" (click)="toggleClientsMenu()" [attr.data-tooltip]="'NAV.CLIENTS' | translate">
              <span class="nxl-micon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <span class="nxl-mtext">{{ 'NAV.CLIENTS' | translate }}</span>
              <span class="nxl-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <ul class="nxl-submenu">
              <li class="nxl-item" *ngIf="hasRoleSuper"><a routerLink="/backoffice/clients" routerLinkActive="active" class="nxl-link">{{ 'NAV.CLIENTS' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/locations" routerLinkActive="active" class="nxl-link">{{ 'LOCATIONS.TITLE' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/users" routerLinkActive="active" class="nxl-link">{{ 'NAV.USERS' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/menu" routerLinkActive="active" class="nxl-link">{{ 'NAV.MENU' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/events" routerLinkActive="active" class="nxl-link">{{ 'NAV.EVENTS' | translate }}</a></li>
            </ul>
          </li>
          <li class="nxl-item" *ngIf="canAccessClientMenu">
            <a routerLink="/backoffice/orders" routerLinkActive="active" class="nxl-link" [attr.data-tooltip]="'NAV.ORDERS' | translate">
              <span class="nxl-micon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </span>
              <span class="nxl-mtext">{{ 'NAV.ORDERS' | translate }}</span>
            </a>
          </li>
          <li class="nxl-item">
            <a routerLink="/backoffice/my-events" routerLinkActive="active" class="nxl-link" [attr.data-tooltip]="'NAV.MY_EVENTS' | translate">
              <span class="nxl-micon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <span class="nxl-mtext">{{ 'NAV.MY_EVENTS' | translate }}</span>
            </a>
          </li>
          <li class="nxl-item nxl-hasmenu" [class.nxl-trigger]="configExpanded" *ngIf="hasRoleSuper">
            <a href="javascript:void(0)" class="nxl-link" (click)="toggleConfigMenu()" [attr.data-tooltip]="'NAV.CONFIGURATION' | translate">
              <span class="nxl-micon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span class="nxl-mtext">{{ 'NAV.CONFIGURATION' | translate }}</span>
              <span class="nxl-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <ul class="nxl-submenu">
              <li class="nxl-item"><a routerLink="/backoffice/configuration/roles" routerLinkActive="active" class="nxl-link">{{ 'NAV.ROLES' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/configuration/payment-types" routerLinkActive="active" class="nxl-link">{{ 'NAV.PAYMENT_TYPES' | translate }}</a></li>
              <li class="nxl-item"><a routerLink="/backoffice/configuration/client-types" routerLinkActive="active" class="nxl-link">{{ 'NAV.CLIENT_TYPES' | translate }}</a></li>
            </ul>
          </li>
        </ul>
      </div>
      <div class="sidebar-footer">
        <button class="sidebar-toggle" (click)="toggleSidebar()">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <span class="toggle-text">Collapse</span>
        </button>
      </div>
    </nav>

    <!-- Header -->
    <header class="nxl-header">
      <div class="header-wrapper">
        <div class="header-left">
        </div>
        <div class="header-right">
          <div class="lang-switcher" [class.open]="langMenuOpen">
            <button class="lang-dropdown" (click)="langMenuOpen = !langMenuOpen">
              <span class="flag">{{ currentLang === 'en' ? '🇬🇧' : '🇷🇴' }}</span>
              <span>{{ currentLang === 'en' ? 'English' : 'Română' }}</span>
              <span class="arrow">▼</span>
            </button>
            <div class="lang-menu">
              <div class="lang-option" [class.active]="currentLang === 'en'" (click)="selectLanguage('en')">
                <span class="flag">🇬🇧</span>
                <span>English</span>
              </div>
              <div class="lang-option" [class.active]="currentLang === 'ro'" (click)="selectLanguage('ro')">
                <span class="flag">🇷🇴</span>
                <span>Română</span>
              </div>
            </div>
          </div>
          <div class="user-menu-wrapper" [class.open]="userMenuOpen">
            <div class="user-avatar user-avatar-btn" (click)="userMenuOpen = !userMenuOpen">{{ userInitials }}</div>
            <div class="user-menu">
              <button class="user-menu-item logout" (click)="logout()">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {{ 'NAV.LOGOUT' | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="nxl-container">
      <div class="nxl-content">
        <router-outlet></router-outlet>
      </div>
    </main>
  `
})
export class BackofficeShellComponent implements OnInit {
  clientsExpanded = false;
  configExpanded = false;
  userInitials = '';
  currentLang = 'en';
  langMenuOpen = false;
  userMenuOpen = false;
  hasRoleSuper = false;
  hasRoleAdmin = false;
  sidebarCollapsed = false;

  constructor(
    private translate: TranslateService,
    private elementRef: ElementRef,
    private router: Router
  ) {
    // Set default language
    this.translate.setDefaultLang('en');
    // Try to get saved language from localStorage
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
      this.currentLang = savedLang;
      this.translate.use(savedLang);
    } else {
      this.translate.use('en');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const langSwitcher = this.elementRef.nativeElement.querySelector('.lang-switcher');
    if (langSwitcher && !langSwitcher.contains(event.target)) {
      this.langMenuOpen = false;
    }
    const userMenu = this.elementRef.nativeElement.querySelector('.user-menu-wrapper');
    if (userMenu && !userMenu.contains(event.target)) {
      this.userMenuOpen = false;
    }
  }

  ngOnInit(): void {
    this.userInitials = this.getUserInitials();
    this.hasRoleSuper = this.checkHasRole('SUPER');
    this.hasRoleAdmin = this.checkHasRole('ADMIN');
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(this.sidebarCollapsed));
    // Collapse submenus when sidebar is collapsed
    if (this.sidebarCollapsed) {
      this.clientsExpanded = false;
      this.configExpanded = false;
    }
  }

  toggleClientsMenu(): void {
    if (this.sidebarCollapsed) {
      // Navigate to first submenu item when collapsed
      this.router.navigate(['/backoffice/locations']);
    } else {
      this.clientsExpanded = !this.clientsExpanded;
    }
  }

  toggleConfigMenu(): void {
    if (this.sidebarCollapsed) {
      // Navigate to first submenu item when collapsed
      this.router.navigate(['/backoffice/configuration/roles']);
    } else {
      this.configExpanded = !this.configExpanded;
    }
  }

  get canAccessClientMenu(): boolean {
    return this.hasRoleSuper || this.hasRoleAdmin;
  }

  selectLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem('language', lang);
    this.langMenuOpen = false;
  }

  logout(): void {
    localStorage.removeItem('token');
    this.userMenuOpen = false;
    this.router.navigate(['/backoffice/login']);
  }

  private getUserInitials(): string {
    const token = localStorage.getItem('token');
    if (!token) {
      return '?';
    }

    try {
      // Decode JWT payload (middle part)
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const username = decoded.sub || '';

      if (!username) {
        return '?';
      }

      // Get initials from username
      const parts = username.split(/[\s._-]+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return username.substring(0, 2).toUpperCase();
    } catch {
      return '?';
    }
  }

  private checkHasRole(role: string): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      return false;
    }

    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const roles: string[] = decoded.roles || [];
      return roles.includes(role);
    } catch {
      return false;
    }
  }
}