import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: 'ORDERED' | 'PREPARING' | 'DONE' | 'CANCELLED';
  note?: string;
}

interface Order {
  id: string;
  orderNo: number;
  registrationId: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  status: string;
  assignedUser: string | null;
  note?: string;
  items: OrderItem[];
}

interface PendingRegistration {
  id: string;
  orderPointId: string;
  orderPointName: string;
  validationStatus: string;
  createdAt: string;
}

@Component({
  selector: 'app-order-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="header-title">{{ activeView === 'orders' ? 'Orders' : 'Permissions' }}</h1>
        <span class="order-count" *ngIf="activeView === 'orders' && orders.length > 0">{{ orders.length }} orders</span>
      </div>
      <div class="header-right">
        <div class="user-menu-wrapper">
          <div class="user-avatar" (click)="toggleUserMenu($event)">{{ userInitials }}</div>
          <div class="user-dropdown" [class.show]="userMenuOpen">
            <div class="user-info">
              <span class="user-name">{{ currentUser }}</span>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" (click)="logout()">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button class="nav-tab" [class.active]="activeView === 'orders'" (click)="navigateTo('orders')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        Orders
      </button>
      <button class="nav-tab" [class.active]="activeView === 'permissions'" (click)="navigateTo('permissions')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Permissions
      </button>
    </nav>

    <div class="dashboard-content">
      <!-- ORDERS VIEW -->
      <ng-container *ngIf="activeView === 'orders'">
        <!-- Empty State -->
        <div *ngIf="orders.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3>No orders yet</h3>
          <p>Waiting for new orders to arrive...</p>
        </div>

        <!-- Orders Grid -->
        <div class="orders-grid" *ngIf="orders.length > 0">
        <div *ngFor="let order of orders" class="order-card" [class]="'status-' + order.status.toLowerCase()">
          <!-- Card Header -->
          <div class="card-header">
            <div class="order-number">
              <span class="hash">#</span>{{ order.orderNo }}
              <span *ngIf="order.assignedUser" class="locked-icon" title="Assigned">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                </svg>
              </span>
            </div>
            <span class="order-point-name">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ order.orderPointName }}
            </span>
            <span class="status-badge" [class]="'badge-' + order.status.toLowerCase()">
              {{ getStatusLabel(order.status) }}
            </span>
          </div>

          <!-- Card Meta -->
          <div class="card-meta" *ngIf="order.assignedUser">
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{{ order.assignedUser }}</span>
            </div>
          </div>

          <!-- Order Note -->
          <div class="order-note" *ngIf="order.note">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span>{{ order.note }}</span>
          </div>

          <!-- Items List -->
          <div class="items-list">
            <div *ngFor="let item of order.items" class="item-row" [class.item-done]="item.status === 'DONE'" [class.item-cancelled]="item.status === 'CANCELLED'">
              <div class="item-info">
                <span class="item-qty">{{ item.quantity }}x</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-price">{{ (item.price * item.quantity).toFixed(2) }}</span>
              </div>
              <div class="item-note" *ngIf="item.note">{{ item.note }}</div>
              <div class="item-actions" *ngIf="order.assignedUser === currentUser && item.status === 'ORDERED'">
                <button class="btn-item btn-ready" (click)="updateItemStatus(item.id, 'DONE')">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </button>
                <button class="btn-item btn-cancel" (click)="updateItemStatus(item.id, 'CANCELLED')">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
              <div class="item-status-icon" *ngIf="item.status !== 'ORDERED'">
                <svg *ngIf="item.status === 'DONE'" class="icon-done" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <svg *ngIf="item.status === 'CANCELLED'" class="icon-cancelled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="card-footer">
            <div class="order-total">
              <span class="total-label">Total</span>
              <span class="total-value">{{ getOrderTotal(order).toFixed(2) }} RON</span>
            </div>
            <div class="card-actions">
              <button *ngIf="order.status === 'ACTIVE'" class="btn btn-start" (click)="startOrder(order.id)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                Start
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser" class="btn btn-return" (click)="returnOrder(order.id)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Return
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser" class="btn btn-complete" (click)="completeOrder(order)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Complete
              </button>
              <button *ngIf="order.status === 'READY' && order.assignedUser === currentUser" class="btn btn-deliver" (click)="markOrderDelivered(order.id)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7h4.05a1 1 0 01.95 1.316l-1.35 4.052A1 1 0 0116.706 13H14a1 1 0 01-1-1V8a1 1 0 011-1z" />
                </svg>
                Picked Up
              </button>
            </div>
          </div>
        </div>
        </div>
      </ng-container>

      <!-- PERMISSIONS VIEW -->
      <ng-container *ngIf="activeView === 'permissions'">
        <!-- Loading -->
        <div *ngIf="loadingPending" class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3>Loading...</h3>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loadingPending && pendingRegistrations.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3>No pending requests</h3>
          <p>All registrations have been approved.</p>
        </div>

        <!-- Pending Registrations List -->
        <div *ngIf="!loadingPending && pendingRegistrations.length > 0" class="pending-list">
          <div *ngFor="let registration of pendingRegistrations" class="pending-card">
            <div class="pending-info">
              <div class="pending-location">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ registration.orderPointName }}
              </div>
              <div class="pending-time">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ formatTime(registration.createdAt) }}
              </div>
            </div>
            <button class="btn btn-approve" (click)="approveRegistration(registration.id)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Approve
            </button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    :host {
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
    }

    /* Header */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-title { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.5px; }
    .order-count {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    .header-right { display: flex; align-items: center; gap: 12px; }

    /* User Menu */
    .user-menu-wrapper { position: relative; }
    .user-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: 2px solid rgba(255,255,255,0.4);
      transition: all 0.2s ease;
    }
    .user-avatar:hover { background: rgba(255,255,255,0.35); }
    .user-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      min-width: 200px;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      z-index: 1000;
      overflow: hidden;
    }
    .user-dropdown.show { opacity: 1; visibility: visible; transform: translateY(0); }
    .user-info { padding: 16px; background: #f8f9fa; }
    .user-name { font-size: 14px; font-weight: 600; color: #1a1a2e; }
    .dropdown-divider { height: 1px; background: #eee; }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 16px;
      border: none;
      background: none;
      font-size: 14px;
      color: #666;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dropdown-item:hover { background: #f5f5f5; color: #1a1a2e; }
    .dropdown-item svg { width: 18px; height: 18px; }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 8px;
      padding: 12px 24px;
      background: #fff;
      border-bottom: 1px solid #e8ecf1;
    }
    .nav-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .nav-tab:hover {
      background: #f1f5f9;
      color: #334155;
    }
    .nav-tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .nav-tab svg {
      width: 18px;
      height: 18px;
    }

    /* Content */
    .dashboard-content {
      padding: 24px;
    }

    /* Empty State */
    .empty-state {
      background: white;
      border-radius: 16px;
      padding: 60px 40px;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .empty-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .empty-icon svg { width: 40px; height: 40px; color: white; }
    .empty-state h3 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #1a1a2e; }
    .empty-state p { margin: 0; color: #8492a6; font-size: 15px; }

    /* Orders Grid */
    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    /* Order Card */
    .order-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      overflow: hidden;
      transition: all 0.3s ease;
      border: 1px solid #e8ecf1;
    }
    .order-card:hover {
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      transform: translateY(-2px);
    }

    /* Status Colors on Card */
    .order-card.status-active { border-top: 4px solid #3b82f6; }
    .order-card.status-in_progress { border-top: 4px solid #f59e0b; }
    .order-card.status-ready { border-top: 4px solid #10b981; }
    .order-card.status-delivered { border-top: 4px solid #8b5cf6; }
    .order-card.status-cancelled { border-top: 4px solid #ef4444; }

    /* Card Header */
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f2f5;
      gap: 12px;
    }
    .order-number {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
      flex-shrink: 0;
    }
    .order-number .hash { color: #c0c5ce; font-weight: 400; }
    .locked-icon { display: flex; color: #f59e0b; }
    .locked-icon svg { width: 18px; height: 18px; }
    .order-point-name {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .order-point-name svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      color: #94a3b8;
    }

    /* Status Badge */
    .status-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-active { background: #eff6ff; color: #3b82f6; }
    .badge-in_progress { background: #fffbeb; color: #d97706; }
    .badge-ready { background: #ecfdf5; color: #059669; }
    .badge-delivered { background: #f5f3ff; color: #7c3aed; }
    .badge-cancelled { background: #fef2f2; color: #dc2626; }

    /* Card Meta */
    .card-meta {
      padding: 12px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid #f0f2f5;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #64748b;
    }
    .meta-item svg { width: 16px; height: 16px; color: #94a3b8; }

    /* Order Note */
    .order-note {
      padding: 10px 20px;
      background: #fefce8;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: #854d0e;
      font-style: italic;
    }
    .order-note svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

    /* Items List */
    .items-list { padding: 12px 0; }
    .item-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 20px;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .item-row:hover { background: #f8fafc; }
    .item-row.item-done { opacity: 0.6; }
    .item-row.item-done .item-name { text-decoration: line-through; }
    .item-row.item-cancelled { opacity: 0.5; }
    .item-row.item-cancelled .item-name { text-decoration: line-through; color: #ef4444; }

    .item-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }
    .item-qty {
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .item-name {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      flex: 1;
      min-width: 0;
    }
    .item-price {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }
    .item-note {
      width: 100%;
      padding-left: 52px;
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
    }

    /* Item Actions */
    .item-actions {
      display: flex;
      gap: 6px;
    }
    .btn-item {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-item svg { width: 14px; height: 14px; }
    .btn-ready { background: #dcfce7; color: #16a34a; }
    .btn-ready:hover { background: #16a34a; color: white; }
    .btn-cancel { background: #fee2e2; color: #dc2626; }
    .btn-cancel:hover { background: #dc2626; color: white; }

    .item-status-icon { display: flex; }
    .item-status-icon svg { width: 20px; height: 20px; }
    .icon-done { color: #10b981; }
    .icon-cancelled { color: #ef4444; }

    /* Card Footer */
    .card-footer {
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #f0f2f5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .order-total { display: flex; flex-direction: column; gap: 2px; }
    .total-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-value { font-size: 18px; font-weight: 700; color: #1e293b; }

    .card-actions { display: flex; gap: 8px; }
    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn svg { width: 16px; height: 16px; }
    .btn-start { background: #3b82f6; color: white; }
    .btn-start:hover { background: #2563eb; }
    .btn-return { background: #f1f5f9; color: #475569; }
    .btn-return:hover { background: #e2e8f0; }
    .btn-complete { background: #10b981; color: white; }
    .btn-complete:hover { background: #059669; }
    .btn-deliver { background: #8b5cf6; color: white; }
    .btn-deliver:hover { background: #7c3aed; }
    .btn-approve { background: #10b981; color: white; }
    .btn-approve:hover { background: #059669; }

    /* Pending Registrations */
    .pending-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pending-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      border: 1px solid #e8ecf1;
      border-left: 4px solid #f59e0b;
    }
    .pending-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pending-location {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
    .pending-location svg {
      width: 18px;
      height: 18px;
      color: #64748b;
    }
    .pending-time {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #64748b;
    }
    .pending-time svg {
      width: 14px;
      height: 14px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .dashboard-content { padding: 16px; }
      .orders-grid { grid-template-columns: 1fr; }
      .card-footer { flex-direction: column; gap: 12px; align-items: stretch; }
      .card-actions { justify-content: stretch; }
      .btn { flex: 1; justify-content: center; }
    }
  `]
})
export class OrderDashboardComponent implements OnInit, OnDestroy {
  private stompClient: Client | null = null;
  connected = false;
  orders: Order[] = [];
  expandedOrders = new Set<string>();
  private eventId = '';
  currentUser = '';
  userInitials = '';
  userMenuOpen = false;
  activeView: 'orders' | 'permissions' = 'orders';
  pendingRegistrations: PendingRegistration[] = [];
  loadingPending = false;

  navigateTo(view: 'orders' | 'permissions'): void {
    this.activeView = view;
    if (view === 'permissions') {
      this.loadPendingRegistrations();
    }
  }

  loadPendingRegistrations(): void {
    this.loadingPending = true;
    this.http.get<PendingRegistration[]>(`${environment.apiUrl}/api/register/events/${this.eventId}/pending`)
      .subscribe({
        next: (registrations) => {
          this.pendingRegistrations = registrations;
          this.loadingPending = false;
        },
        error: (err) => {
          console.error('Failed to load pending registrations:', err);
          this.loadingPending = false;
        }
      });
  }

  approveRegistration(registrationId: string): void {
    this.http.post<PendingRegistration>(`${environment.apiUrl}/api/register/${registrationId}/approve`, {})
      .subscribe({
        next: () => {
          this.pendingRegistrations = this.pendingRegistrations.filter(r => r.id !== registrationId);
        },
        error: (err) => {
          console.error('Failed to approve registration:', err);
        }
      });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  logout(): void {
    localStorage.removeItem('token');
    this.userMenuOpen = false;
    this.router.navigate(['/backoffice/login']);
  }

  ngOnInit(): void {
    this.currentUser = this.getUsernameFromToken();
    this.userInitials = this.getUserInitials();
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    if (this.eventId) {
      this.loadOrders();
      this.connect();
    }
  }

  private getUsernameFromToken(): string {
    const token = localStorage.getItem('token');
    if (!token) {
      return '';
    }
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.sub || '';
    } catch {
      return '';
    }
  }

  private getUserInitials(): string {
    const username = this.currentUser;
    if (!username) {
      return '?';
    }
    const parts = username.split(/[\s._-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  }

  loadOrders(): void {
    this.http.get<Order[]>(`${environment.apiUrl}/api/orders/events/${this.eventId}`)
      .subscribe({
        next: (orders) => {
          this.orders = orders;
        },
        error: (err) => {
          console.error('Failed to load orders:', err);
        }
      });
  }

  connect(): void {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      onConnect: () => {
        this.connected = true;
        console.log('Connected to WebSocket');

        this.stompClient?.subscribe('/topic/orders', (message) => {
          console.log('Received new order via WebSocket');
          this.loadOrders();
        });
      },
      onStompError: (error) => {
        console.error('STOMP error:', error);
        this.connected = false;
      }
    });

    this.stompClient.activate();
  }

  toggleOrder(orderId: string): void {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }

  getOrderTotal(order: Order): number {
    return order.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return '#2196F3';
      case 'IN_PROGRESS': return '#FF9800';
      case 'READY': return '#4CAF50';
      case 'DELIVERED': return '#9E9E9E';
      case 'CANCELLED': return '#f44336';
      default: return '#757575';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'New';
      case 'IN_PROGRESS': return 'In Progress';
      case 'READY': return 'Ready';
      case 'DELIVERED': return 'Delivered';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  getItemStatusColor(status: string): string {
    switch (status) {
      case 'ORDERED': return '#2196F3';
      case 'PREPARING': return '#FF9800';
      case 'DONE': return '#4CAF50';
      case 'CANCELLED': return '#f44336';
      default: return '#757575';
    }
  }

  updateItemStatus(itemId: string, status: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/items/${itemId}/status?status=${status}`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to update item status:', err);
        }
      });
  }

  markOrderDelivered(orderId: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/status?status=DELIVERED`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to update order status:', err);
        }
      });
  }

  startOrder(orderId: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/status?status=IN_PROGRESS&user=${encodeURIComponent(this.currentUser)}`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to start order:', err);
        }
      });
  }

  returnOrder(orderId: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/status?status=ACTIVE`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to return order:', err);
        }
      });
  }

  completeOrder(order: Order): void {
    const itemsToComplete = order.items.filter(item => item.status !== 'CANCELLED' && item.status !== 'DONE');

    if (itemsToComplete.length === 0) {
      this.markOrderReady(order.id);
      return;
    }

    let completed = 0;
    itemsToComplete.forEach(item => {
      this.http.patch(`${environment.apiUrl}/api/orders/items/${item.id}/status?status=DONE`, {})
        .subscribe({
          next: () => {
            completed++;
            if (completed === itemsToComplete.length) {
              this.markOrderReady(order.id);
            }
          },
          error: (err) => {
            console.error('Failed to complete item:', err);
          }
        });
    });
  }

  markOrderReady(orderId: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/status?status=READY`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to mark order ready:', err);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }
}
