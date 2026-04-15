import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

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
  needsPayment: boolean;
  nickname?: string;
  items: OrderItem[];
}

interface PendingRegistration {
  id: string;
  orderPointId: string;
  orderPointName: string;
  validationStatus: string;
  createdAt: string;
  nickname?: string;
}

interface EventOrderPoint {
  id?: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  sublocationName: string;
  prepaid: number;
  clientName?: string;
  email?: string;
  phone?: string;
  credit: boolean;
  creditValue?: number;
}

@Component({
  selector: 'app-order-dashboard',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  template: `
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="header-title">{{ activeView === 'orders' ? 'Orders' : (activeView === 'permissions' ? 'Validations' : 'Payments') }}</h1>
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
        <span class="tab-badge" *ngIf="orders.length > 0">{{ orders.length }}</span>
      </button>
      <button class="nav-tab" [class.active]="activeView === 'permissions'" (click)="navigateTo('permissions')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Validations
        <span class="tab-badge" *ngIf="pendingRegistrations.length > 0">{{ pendingRegistrations.length }}</span>
      </button>
      <button class="nav-tab" [class.active]="activeView === 'payments'" (click)="navigateTo('payments')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Payments
        <span class="tab-badge" *ngIf="groupedPaymentOrders.length > 0">{{ groupedPaymentOrders.length }}</span>
      </button>
    </nav>

    <div class="dashboard-content">
      <!-- ORDERS VIEW -->
      <ng-container *ngIf="activeView === 'orders'">
        <!-- Kanban Board -->
        <div class="kanban-board">
          <!-- Ordered Column -->
          <div class="kanban-column">
            <div class="column-header column-ordered">
              <h3>Ordered<span class="column-count" *ngIf="orderedOrders.length > 0">{{ orderedOrders.length }}</span></h3>
            </div>
            <div class="column-content"
                 cdkDropList
                 #orderedList="cdkDropList"
                 [cdkDropListData]="orderedOrders"
                 [cdkDropListConnectedTo]="[inProgressList]"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="onOrderDrop($event, 'ACTIVE')">
              <div *ngFor="let order of orderedOrders; trackBy: trackByOrderId" class="order-card" cdkDrag [cdkDragData]="order">
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
                <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: order }"></ng-container>
              </div>
              <div *ngIf="orderedOrders.length === 0" class="column-empty">No orders</div>
            </div>
          </div>

          <!-- In Progress Column -->
          <div class="kanban-column">
            <div class="column-header column-in-progress">
              <h3>In Progress<span class="column-count" *ngIf="inProgressOrders.length > 0">{{ inProgressOrders.length }}</span></h3>
            </div>
            <div class="column-content"
                 cdkDropList
                 #inProgressList="cdkDropList"
                 [cdkDropListData]="inProgressOrders"
                 [cdkDropListConnectedTo]="[orderedList, readyList]"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="onOrderDrop($event, 'IN_PROGRESS')">
              <div *ngFor="let order of inProgressOrders; trackBy: trackByOrderId" class="order-card" cdkDrag [cdkDragData]="order" [cdkDragDisabled]="order.assignedUser !== currentUser">
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
                <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: order }"></ng-container>
              </div>
              <div *ngIf="inProgressOrders.length === 0" class="column-empty">No orders</div>
            </div>
          </div>

          <!-- Ready Column -->
          <div class="kanban-column">
            <div class="column-header column-ready">
              <h3>Ready<span class="column-count" *ngIf="readyOrders.length > 0">{{ readyOrders.length }}</span></h3>
            </div>
            <div class="column-content"
                 cdkDropList
                 #readyList="cdkDropList"
                 [cdkDropListData]="readyOrders"
                 [cdkDropListConnectedTo]="[inProgressList]"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="onOrderDrop($event, 'READY')">
              <div *ngFor="let order of readyOrders; trackBy: trackByOrderId" class="order-card" cdkDrag [cdkDragData]="order" [cdkDragDisabled]="order.assignedUser !== currentUser">
                <div class="drag-placeholder" *cdkDragPlaceholder></div>
                <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: order }"></ng-container>
              </div>
              <div *ngIf="readyOrders.length === 0" class="column-empty">No orders</div>
            </div>
          </div>
        </div>

        <!-- Order Card Template -->
        <ng-template #orderCardTemplate let-order>
          <!-- Card Header -->
          <div class="card-header">
            <span class="order-number">#{{ order.orderNo }}</span>
            <div class="header-center">
              <span class="order-point-name">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ order.orderPointName }}
              </span>
              <span class="order-nickname" *ngIf="order.nickname">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {{ order.nickname }}
              </span>
            </div>
            <span class="order-amount">{{ getOrderTotal(order).toFixed(2) }} RON</span>
            <span *ngIf="order.assignedUser" class="locked-icon" title="Assigned">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
              </svg>
            </span>
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
                <span class="item-name" [innerHTML]="item.name"></span>
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
            <div class="card-actions">
              <button *ngIf="order.status === 'ACTIVE'" class="arrow-btn arrow-btn-start" (click)="startOrder(order.id)" title="Start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser" class="arrow-btn arrow-btn-return" (click)="returnOrder(order.id)" title="Return">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser" class="arrow-btn arrow-btn-complete" (click)="completeOrder(order)" title="Complete">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <button *ngIf="order.status === 'READY' && order.assignedUser === currentUser" class="arrow-btn arrow-btn-deliver" (click)="markOrderDelivered(order.id)" title="Picked Up">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </ng-template>
      </ng-container>

      <!-- VALIDATIONS VIEW -->
      <ng-container *ngIf="activeView === 'permissions'">
        <!-- Empty State -->
        <div *ngIf="!loadingPending && pendingRegistrations.length === 0" class="empty-state validations-empty">
          <div class="servio-logo">
            <svg viewBox="0 0 70 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="38,19 66,22 38,25" fill="url(#goldGradEmpty)"/>
              <polygon points="34,25 64,28 34,31" fill="url(#goldGradEmpty)" opacity="0.85"/>
              <polygon points="29,31 57,34 29,37" fill="url(#goldGradEmpty)" opacity="0.7"/>
              <circle cx="22" cy="22" r="18" fill="white"/>
              <circle cx="22" cy="22" r="17" fill="url(#grayGradEmpty)"/>
              <text x="22" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white">S</text>
              <defs>
                <linearGradient id="goldGradEmpty" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#fbbf24"/>
                  <stop offset="100%" stop-color="#f59e0b"/>
                </linearGradient>
                <linearGradient id="grayGradEmpty" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop stop-color="#6b7280"/>
                  <stop offset="0.5" stop-color="#4b5563"/>
                  <stop offset="1" stop-color="#374151"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3>No validations waiting</h3>
          <p>All registrations have been approved.</p>
        </div>

        <!-- Validation Cards Grid -->
        <div *ngIf="pendingRegistrations.length > 0" class="validations-grid">
          <div *ngFor="let registration of pendingRegistrations" class="validation-card">
            <div class="validation-info">
              <div class="validation-row">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{{ registration.nickname || 'Guest' }}</span>
              </div>
              <div class="validation-row">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{{ registration.orderPointName }}</span>
              </div>
              <div class="validation-row">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ formatTime(registration.createdAt) }}</span>
              </div>
            </div>
            <div class="validation-action">
              <button class="approve-btn" (click)="approveRegistration(registration.id)" title="Approve">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- PAYMENTS VIEW -->
      <ng-container *ngIf="activeView === 'payments'">
        <!-- Empty State -->
        <div *ngIf="!loadingNeedsPayment && needsPaymentOrders.length === 0" class="empty-state payments-empty">
          <div class="servio-logo">
            <svg viewBox="0 0 70 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="38,19 66,22 38,25" fill="url(#goldGradPayments)"/>
              <polygon points="34,25 64,28 34,31" fill="url(#goldGradPayments)" opacity="0.85"/>
              <polygon points="29,31 57,34 29,37" fill="url(#goldGradPayments)" opacity="0.7"/>
              <circle cx="22" cy="22" r="18" fill="white"/>
              <circle cx="22" cy="22" r="17" fill="url(#grayGradPayments)"/>
              <text x="22" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white">S</text>
              <defs>
                <linearGradient id="goldGradPayments" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#fbbf24"/>
                  <stop offset="100%" stop-color="#f59e0b"/>
                </linearGradient>
                <linearGradient id="grayGradPayments" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop stop-color="#6b7280"/>
                  <stop offset="0.5" stop-color="#4b5563"/>
                  <stop offset="1" stop-color="#374151"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3>No pending payments</h3>
          <p>All orders have been paid.</p>
        </div>

        <!-- Payments Grid -->
        <div *ngIf="!loadingNeedsPayment && needsPaymentOrders.length > 0" class="payments-container">
          <!-- Controls Bar -->
          <div class="payments-controls">
            <div class="view-toggle-bar">
              <button class="toggle-btn" [class.active]="paymentMode === 'table'" (click)="paymentMode = 'table'">Table</button>
              <button class="toggle-btn" [class.active]="paymentMode === 'guest'" (click)="paymentMode = 'guest'">Guest</button>
            </div>
          </div>

          <!-- TABLE MODE - Grouped by Table (Order Point) -->
          <div *ngIf="paymentMode === 'table'" class="payments-by-table">
            <div *ngFor="let table of groupedPaymentOrders" class="table-section">
              <div class="table-section-header">
                <div class="table-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="table-name">{{ table.orderPointName }}</span>
                  <span *ngIf="table.creditValue" class="credit-badge">Credit: {{ table.creditValue.toFixed(2) }} RON</span>
                </div>
                <span class="table-total-badge">{{ getGroupTotal(table.orders).toFixed(2) }} RON</span>
              </div>
              <div class="table-items-list">
                <div *ngFor="let item of getAggregatedItems(table.orders)" class="aggregated-item-row">
                  <span class="item-qty">{{ item.quantity }}x</span>
                  <span class="item-name" [innerHTML]="item.name"></span>
                  <span class="item-price">{{ item.totalPrice.toFixed(2) }} RON</span>
                </div>
              </div>
              <div class="table-orders-footer">
                <button class="btn-mark-all-paid" (click)="markTablePaid(table.orders)">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  Mark Table Paid
                </button>
              </div>
            </div>
          </div>

          <!-- GUEST MODE - Tables as parents, Guests as children -->
          <div *ngIf="paymentMode === 'guest'" class="payments-by-guest">
            <div *ngFor="let table of groupedPaymentOrders" class="table-parent-card">
              <div class="table-parent-header">
                <div class="table-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="table-name">{{ table.orderPointName }}</span>
                  <span *ngIf="table.creditValue" class="credit-badge">Credit: {{ table.creditValue.toFixed(2) }} RON</span>
                </div>
                <span class="table-total-badge">{{ getGroupTotal(table.orders).toFixed(2) }} RON</span>
              </div>
              <div class="guest-children">
                <div *ngFor="let guest of getOrdersByGuest(table.orders)" class="guest-child-card">
                  <div class="guest-child-header">
                    <div class="guest-info">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span class="guest-nickname">{{ guest.nickname }}</span>
                    </div>
                    <span class="guest-total-badge">{{ guest.total.toFixed(2) }} RON</span>
                  </div>
                  <div class="guest-items-list">
                    <div *ngFor="let item of getAggregatedItems(guest.orders)" class="aggregated-item-row">
                      <span class="item-qty">{{ item.quantity }}x</span>
                      <span class="item-name" [innerHTML]="item.name"></span>
                      <span class="item-price">{{ item.totalPrice.toFixed(2) }} RON</span>
                    </div>
                  </div>
                  <div class="guest-footer">
                    <button class="btn-mark-paid small" (click)="markGuestPaid(guest.orders)">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Mark Paid
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>

    <!-- Payment Method Modal -->
    <div *ngIf="showPaymentModal" class="payment-modal-overlay" (click)="closePaymentModal()">
      <div class="payment-modal" (click)="$event.stopPropagation()">
        <div class="payment-modal-header">
          <h3>Select Payment Method</h3>
          <button class="modal-close-btn" (click)="closePaymentModal()">&times;</button>
        </div>
        <div class="payment-modal-body">
          <button class="payment-method-btn cash" (click)="confirmPayment('CASH')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Cash
          </button>
          <button class="payment-method-btn card" (click)="confirmPayment('CARD')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Card
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    :host {
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      min-height: 100vh;
    }

    /* Header */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #fff;
      color: #1a1a2e;
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid #e0e0e0;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-title { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.5px; }
    .order-count {
      background: #f0f2f5;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }
    .header-right { display: flex; align-items: center; gap: 12px; }

    /* User Menu */
    .user-menu-wrapper { position: relative; }
    .user-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #f0f2f5;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: 1px solid #e0e0e0;
      transition: all 0.2s ease;
    }
    .user-avatar:hover { background: #e8ecf1; }
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
      border-bottom: 1px solid #e0e0e0;
    }
    .nav-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: 1px solid #e0e0e0;
      background: #fff;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .nav-tab:hover {
      background: #f8f9fa;
      color: #334155;
    }
    .nav-tab.active {
      background: #f0f2f5;
      color: #1a1a2e;
      border-color: #ccc;
    }
    .nav-tab svg {
      width: 18px;
      height: 18px;
    }
    .tab-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 600;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }

    /* Content */
    .dashboard-content {
      padding: 24px;
      background: white;
      min-height: calc(100vh - 130px);
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

    /* Validations Empty State */
    .validations-empty {
      box-shadow: none;
      background: transparent;
    }
    .servio-logo {
      width: 120px;
      height: 70px;
      margin: 0 auto 20px;
    }
    .servio-logo svg {
      width: 100%;
      height: 100%;
    }

    /* Kanban Board */
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      height: calc(100vh - 180px);
    }
    .kanban-column {
      display: flex;
      flex-direction: column;
      background: white;
      overflow: hidden;
    }
    .kanban-column:not(:last-child) {
      border-right: 1px solid #d1d5db;
    }
    .column-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 20px;
      position: relative;
    }
    .column-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 5%;
      width: 90%;
      height: 3px;
      border-radius: 2px;
    }
    .column-ordered::after { background: #3b82f6; }
    .column-in-progress::after { background: #f59e0b; }
    .column-ready::after { background: #10b981; }
    .column-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      position: relative;
      display: inline-block;
    }
    .column-count {
      position: absolute;
      top: -8px;
      right: -20px;
      background: #ef4444;
      color: white;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .column-ordered { border-color: #3b82f6; }
    .column-in-progress { border-color: #f59e0b; }
    .column-ready { border-color: #10b981; }
    .column-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .column-empty {
      text-align: center;
      padding: 40px 20px;
      color: #94a3b8;
      font-size: 14px;
    }

    /* Order Card */
    .order-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #d1d5db;
      height: auto;
      flex-shrink: 0;
      width: 85%;
      margin: 0 auto;
      overflow: hidden;
      cursor: grab;
    }
    .order-card:active {
      cursor: grabbing;
    }

    /* Drag and Drop Styles */
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      background: white;
      border: 2px solid #667eea;
    }
    .cdk-drag-placeholder {
      opacity: 0;
    }
    .drag-placeholder {
      background: #e0e7ff;
      border: 2px dashed #667eea;
      border-radius: 16px;
      min-height: 80px;
      width: 85%;
      margin: 0 auto;
    }
    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drop-list-dragging .cdk-drag {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
    .order-card[ng-reflect-cdk-drag-disabled="true"] {
      cursor: default;
      opacity: 0.8;
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
    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-width: 0;
    }
    .order-point-name {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      white-space: nowrap;
    }
    .order-point-name svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #94a3b8;
    }
    .order-amount {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      flex-shrink: 0;
    }

    /* Card Nickname Row */
    .card-nickname {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #0369a1;
      background: #f0f9ff;
      border-bottom: 1px solid #f0f2f5;
    }
    .card-nickname svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #0ea5e9;
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

    /* Order Nickname */
    .order-nickname {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 600;
      color: #0369a1;
      background: #e0f2fe;
      padding: 4px 10px;
      border-radius: 12px;
      flex-shrink: 0;
    }
    .order-nickname svg { width: 14px; height: 14px; flex-shrink: 0; color: #0ea5e9; }

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
      display: flex;
      justify-content: flex-end;
      align-items: center;
      border-radius: 0 0 16px 16px;
    }

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

    /* Arrow Buttons */
    .arrow-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      color: #64748b;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }
    .arrow-btn:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }
    .arrow-btn svg {
      width: 18px;
      height: 18px;
    }
    .arrow-btn-start:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }
    .arrow-btn-return:hover {
      border-color: #64748b;
      color: #64748b;
    }
    .arrow-btn-complete:hover {
      border-color: #10b981;
      color: #10b981;
    }
    .arrow-btn-deliver:hover {
      border-color: #8b5cf6;
      color: #8b5cf6;
    }

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

    /* Validations Grid */
    .validations-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .validation-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e8ecf1;
      display: flex;
      flex-direction: row;
      align-items: center;
    }
    .validation-info {
      flex: 3;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .validation-action {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .validation-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: #1e293b;
    }
    .validation-row svg {
      width: 18px;
      height: 18px;
      color: #64748b;
      flex-shrink: 0;
    }
    .validation-row span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .approve-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: transparent;
      color: #10b981;
      border: 2px solid #e2e8f0;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }
    .approve-btn:hover {
      border-color: #10b981;
      background: #10b981;
      color: white;
    }
    .approve-btn svg {
      width: 20px;
      height: 20px;
    }
    @media (max-width: 1200px) {
      .validations-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    @media (max-width: 900px) {
      .validations-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .validations-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Payment Groups */
    .payment-groups {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .payment-group {
      background: white;
      border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .payment-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .payment-group-location {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
    .payment-group-location svg {
      width: 22px;
      height: 22px;
    }
    .payment-group-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .view-toggle {
      display: flex;
      background: rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 3px;
      cursor: pointer;
    }
    .toggle-option {
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 16px;
      transition: all 0.2s ease;
      opacity: 0.7;
    }
    .toggle-option.active {
      background: white;
      color: #667eea;
      opacity: 1;
    }
    .payment-group-total {
      font-size: 18px;
      font-weight: 700;
      background: rgba(255,255,255,0.2);
      padding: 6px 14px;
      border-radius: 20px;
    }

    /* Total View */
    .payment-total-view {
      padding: 16px;
      background: #f8fafc;
    }
    .aggregated-items {
      background: white;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      overflow: hidden;
    }
    .aggregated-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f2f5;
    }
    .aggregated-item:last-child {
      border-bottom: none;
    }
    .aggregated-item .item-qty {
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-right: 12px;
    }
    .aggregated-item .item-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }
    .aggregated-item .item-total {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
    }
    .payment-total-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
    }
    .payment-total-footer .total-label {
      font-size: 14px;
      color: #64748b;
    }
    .payment-total-footer .total-value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    /* Payment Cards */
    .payment-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #f8fafc;
    }
    .payment-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .payment-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .payment-order-number {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      min-width: 60px;
    }
    .payment-order-number .hash {
      color: #c0c5ce;
      font-weight: 400;
    }
    .payment-items {
      font-size: 13px;
      color: #64748b;
    }
    .payment-amount {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
    }

    /* Guest View */
    .payment-guest-view {
      padding: 16px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .guest-group {
      background: white;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      overflow: hidden;
    }
    .guest-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f1f5f9;
      border-bottom: 1px solid #e8ecf1;
    }
    .guest-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }
    .guest-name svg {
      width: 18px;
      height: 18px;
      color: #64748b;
    }
    .guest-total {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
    .guest-orders {
      display: flex;
      flex-direction: column;
    }
    .guest-aggregated {
      padding: 8px 0;
    }
    .guest-order-card {
      border-bottom: 1px solid #f0f2f5;
    }
    .guest-order-card:last-child {
      border-bottom: none;
    }
    .guest-order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #fafafa;
    }
    .guest-order-number {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
    }
    .guest-order-number .hash {
      color: #94a3b8;
    }
    .guest-order-amount {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
    }
    .guest-order-items {
      padding: 6px 0;
    }
    .guest-item-row {
      display: flex;
      align-items: center;
      padding: 6px 16px;
    }
    .guest-item-row .item-qty {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-right: 8px;
      min-width: 28px;
      text-align: center;
    }
    .guest-item-row .item-name {
      flex: 1;
      font-size: 13px;
      color: #1e293b;
    }
    .guest-item-row .item-price {
      font-size: 12px;
      color: #64748b;
    }

    /* Payments Empty State */
    .payments-empty {
      box-shadow: none;
      background: transparent;
    }

    /* Payments Container */
    .payments-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Payments Controls */
    .payments-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
    }
    .controls-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .controls-right {
      display: flex;
      align-items: center;
    }
    .view-toggle-bar {
      display: flex;
      background: #e8ecf1;
      border-radius: 8px;
      padding: 4px;
    }
    .toggle-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .toggle-btn:hover {
      color: #1e293b;
    }
    .toggle-btn.active {
      background: white;
      color: #1e293b;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .payments-total-badge {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      background: white;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #e8ecf1;
    }

    /* Payments Grid */
    .payments-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 1200px) {
      .payments-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 768px) {
      .payments-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Payment Order Card */
    .payment-order-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #d1d5db;
      transition: all 0.3s ease;
      overflow: hidden;
    }
    .payment-order-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    /* Mark Paid Button */
    .btn-mark-paid {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      background: #10b981;
      color: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-mark-paid:hover {
      background: #059669;
    }
    .btn-mark-paid svg {
      width: 16px;
      height: 16px;
    }

    /* Payments By Table */
    .payments-by-table {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .table-section {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 16px;
      border: 1px solid #e8ecf1;
    }
    .table-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e8ecf1;
    }
    .table-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .table-info svg {
      width: 22px;
      height: 22px;
      color: #64748b;
    }
    .table-name {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    .credit-badge {
      font-size: 13px;
      font-weight: 500;
      color: #059669;
      background: #d1fae5;
      padding: 4px 10px;
      border-radius: 6px;
      margin-left: 8px;
    }
    .table-total-badge {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      background: white;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e8ecf1;
    }
    .table-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .aggregated-item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e8ecf1;
    }
    .aggregated-item-row .item-qty {
      font-weight: 600;
      color: #64748b;
      min-width: 30px;
    }
    .aggregated-item-row .item-name {
      flex: 1;
      font-weight: 500;
      color: #1e293b;
    }
    .aggregated-item-row .item-price {
      font-weight: 600;
      color: #1e293b;
    }
    .table-orders-footer {
      display: flex;
      justify-content: flex-end;
    }
    .btn-mark-all-paid {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-mark-all-paid:hover {
      background: #16a34a;
    }
    .btn-mark-all-paid svg {
      width: 16px;
      height: 16px;
    }

    /* Payments By Guest (Table as parent, Guests as children) */
    .payments-by-guest {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .table-parent-card {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 16px;
      border: 1px solid #e8ecf1;
    }
    .table-parent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e8ecf1;
    }
    .guest-children {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .guest-child-card {
      background: white;
      border-radius: 12px;
      padding: 12px 16px;
      border: 1px solid #e8ecf1;
    }
    .guest-child-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .guest-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .guest-info svg {
      width: 20px;
      height: 20px;
      color: #64748b;
    }
    .guest-nickname {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
    .guest-total-badge {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      background: #f1f5f9;
      padding: 4px 12px;
      border-radius: 6px;
    }
    .guest-items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .guest-items-list .aggregated-item-row {
      padding: 6px 10px;
      font-size: 13px;
    }
    .guest-footer {
      display: flex;
      justify-content: flex-end;
    }
    .btn-mark-paid.small {
      padding: 6px 12px;
      font-size: 12px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
    }
    .btn-mark-paid.small:hover {
      background: #16a34a;
    }
    .btn-mark-paid.small svg {
      width: 14px;
      height: 14px;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .kanban-board {
        grid-template-columns: 1fr;
        height: auto;
      }
      .kanban-column {
        max-height: none;
      }
    }
    @media (max-width: 768px) {
      .dashboard-content { padding: 16px; }
      .card-footer { flex-direction: column; gap: 12px; align-items: stretch; }
      .card-actions { justify-content: stretch; }
      .btn { flex: 1; justify-content: center; }
    }

    /* Payment Modal */
    .payment-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .payment-modal {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .payment-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e8ecf1;
    }
    .payment-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    .modal-close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 20px;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-close-btn:hover {
      background: #e2e8f0;
      color: #334155;
    }
    .payment-modal-body {
      padding: 24px;
      display: flex;
      gap: 16px;
    }
    .payment-method-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 16px;
      border: 2px solid #e8ecf1;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      color: #334155;
      transition: all 0.2s ease;
    }
    .payment-method-btn svg {
      width: 40px;
      height: 40px;
    }
    .payment-method-btn.cash:hover {
      border-color: #22c55e;
      background: #f0fdf4;
      color: #15803d;
    }
    .payment-method-btn.card:hover {
      border-color: #3b82f6;
      background: #eff6ff;
      color: #1d4ed8;
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
  activeView: 'orders' | 'permissions' | 'payments' = 'orders';
  pendingRegistrations: PendingRegistration[] = [];
  loadingPending = false;
  needsPaymentOrders: Order[] = [];
  loadingNeedsPayment = false;
  creditValueMap: Map<string, number> = new Map(); // orderPointId -> creditValue
  paymentGroupMode: Map<string, 'all' | 'guest'> = new Map();
  paymentViewMode: Map<string, 'total' | 'order'> = new Map();
  paymentMode: 'table' | 'guest' = 'table';
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  // Payment modal
  showPaymentModal = false;
  pendingPaymentOrders: Order[] = [];

  // Cached arrays for kanban columns (avoids getter re-computation on every change detection)
  orderedOrders: Order[] = [];
  inProgressOrders: Order[] = [];
  readyOrders: Order[] = [];

  // Track by function for drag-drop performance
  trackByOrderId = (index: number, order: Order): string => order.id;

  private updateKanbanColumns(): void {
    this.orderedOrders = this.orders.filter(o => o.status === 'ACTIVE');
    this.inProgressOrders = this.orders.filter(o => o.status === 'IN_PROGRESS');
    this.readyOrders = this.orders.filter(o => o.status === 'READY');
  }

  get groupedPaymentOrders(): { orderPointId: string; orderPointName: string; orders: Order[]; creditValue?: number }[] {
    const groups = new Map<string, { orderPointName: string; orders: Order[] }>();
    for (const order of this.needsPaymentOrders) {
      const key = order.orderPointId || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, { orderPointName: order.orderPointName || 'Unknown', orders: [] });
      }
      groups.get(key)!.orders.push(order);
    }
    return Array.from(groups.entries()).map(([orderPointId, data]) => ({
      orderPointId,
      orderPointName: data.orderPointName,
      orders: data.orders,
      creditValue: this.creditValueMap.get(orderPointId)
    }));
  }

  getGroupTotal(orders: Order[]): number {
    return orders.reduce((total, order) => total + this.getOrderTotal(order), 0);
  }

  getPaymentGroupMode(orderPointName: string): 'all' | 'guest' {
    return this.paymentGroupMode.get(orderPointName) || 'all';
  }

  setPaymentGroupMode(orderPointName: string, mode: 'all' | 'guest'): void {
    this.paymentGroupMode.set(orderPointName, mode);
  }

  getPaymentViewMode(orderPointName: string): 'total' | 'order' {
    return this.paymentViewMode.get(orderPointName) || 'order';
  }

  setPaymentViewMode(orderPointName: string, mode: 'total' | 'order'): void {
    this.paymentViewMode.set(orderPointName, mode);
  }

  getOrdersByGuest(orders: Order[]): { nickname: string; orders: Order[]; total: number }[] {
    const groups = new Map<string, Order[]>();
    for (const order of orders) {
      const key = order.nickname || 'Unknown';
      console.log('[Guest] Order', order.orderNo, 'nickname:', order.nickname);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(order);
    }
    return Array.from(groups.entries()).map(([nickname, guestOrders]) => ({
      nickname,
      orders: guestOrders,
      total: guestOrders.reduce((sum, o) => sum + this.getOrderTotal(o), 0)
    }));
  }

  getAggregatedItems(orders: Order[]): { name: string; quantity: number; totalPrice: number }[] {
    const itemMap = new Map<string, { quantity: number; totalPrice: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.price * item.quantity;
        } else {
          itemMap.set(item.name, {
            quantity: item.quantity,
            totalPrice: item.price * item.quantity
          });
        }
      }
    }
    return Array.from(itemMap.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      totalPrice: data.totalPrice
    }));
  }

  navigateTo(view: 'orders' | 'permissions' | 'payments'): void {
    this.activeView = view;
    if (view === 'permissions') {
      this.loadPendingRegistrations();
    } else if (view === 'payments') {
      this.loadNeedsPaymentOrders();
    }
  }

  loadNeedsPaymentOrders(): void {
    this.loadingNeedsPayment = true;
    forkJoin({
      orders: this.http.get<Order[]>(`${environment.apiUrl}/api/orders/events/${this.eventId}/needs-payment`),
      eventOrderPoints: this.http.get<EventOrderPoint[]>(`${environment.apiUrl}/api/events/${this.eventId}/order-points`)
    }).subscribe({
      next: ({ orders, eventOrderPoints }) => {
        this.needsPaymentOrders = orders;
        // Build creditValueMap from eventOrderPoints
        this.creditValueMap.clear();
        for (const eop of eventOrderPoints) {
          if (eop.credit && eop.creditValue != null && eop.creditValue > 0) {
            this.creditValueMap.set(eop.orderPointId, eop.creditValue);
          }
        }
        this.loadingNeedsPayment = false;
      },
      error: (err) => {
        console.error('Failed to load orders needing payment:', err);
        this.loadingNeedsPayment = false;
      }
    });
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
      this.loadPendingRegistrations();
      this.loadNeedsPaymentOrders();
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
          this.updateKanbanColumns();
        },
        error: (err) => {
          console.error('Failed to load orders:', err);
        }
      });
  }

  connect(): void {
    // Setup wake-up listeners
    this.setupWakeUpListeners();

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      // Heartbeat: send every 10s, expect every 10s
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Auto reconnect with 2s delay
      reconnectDelay: 2000,
      onConnect: () => {
        this.connected = true;
        console.log('Connected to WebSocket');

        this.stompClient?.subscribe(`/topic/event/${this.eventId}/orders`, (message) => {
          console.log('Received order update via WebSocket:', message.body);
          this.loadOrders();
          this.loadNeedsPaymentOrders();
        });

        // Subscribe to registration approvals for this event
        this.stompClient?.subscribe(`/topic/event/${this.eventId}/registrations`, (message) => {
          console.log('Received registration update via WebSocket');
          const data = JSON.parse(message.body);
          if (data.type === 'REGISTRATION_APPROVED') {
            // Remove the approved registration from the pending list
            this.pendingRegistrations = this.pendingRegistrations.filter(r => r.id !== data.registrationId);
          }
        });

        // Subscribe to new validation requests for this event
        this.stompClient?.subscribe(`/topic/event/${this.eventId}/validation-requests`, (message) => {
          console.log('Received validation request via WebSocket');
          const data = JSON.parse(message.body);
          if (data.type === 'VALIDATION_REQUESTED') {
            // Add the new pending registration to the list
            const newRegistration: PendingRegistration = {
              id: data.registrationId,
              orderPointId: data.orderPointId,
              orderPointName: data.orderPointName || 'Unknown',
              validationStatus: 'PENDING',
              createdAt: new Date().toISOString(),
              nickname: data.nickname
            };
            // Avoid duplicates
            if (!this.pendingRegistrations.some(r => r.id === data.registrationId)) {
              this.pendingRegistrations = [...this.pendingRegistrations, newRegistration];
            }
          }
        });

        // Subscribe to payment updates for this event
        this.stompClient?.subscribe(`/topic/event/${this.eventId}/payments`, (message) => {
          console.log('Received payment update via WebSocket:', message.body);
          // Reload orders when a payment is processed
          this.loadOrders();
          this.loadNeedsPaymentOrders();
        });
      },
      onStompError: (error) => {
        console.error('STOMP error:', error);
        this.connected = false;
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        this.connected = false;
      },
      onWebSocketClose: () => {
        console.log('WebSocket connection closed');
        this.connected = false;
      }
    });

    this.stompClient.activate();
  }

  private setupWakeUpListeners(): void {
    // Listen for visibility changes (device wake up / tab focus)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WebSocket] Page became visible, checking connection...');
        this.reconnectIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Listen for online events (network reconnection)
    this.onlineHandler = () => {
      console.log('[WebSocket] Device came online, reconnecting...');
      this.reconnectIfNeeded();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private removeWakeUpListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private reconnectIfNeeded(): void {
    // Force disconnect and reconnect to ensure fresh connection
    if (this.stompClient) {
      console.log('[WebSocket] Forcing reconnection...');
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
    // Small delay before reconnecting, then reload data
    setTimeout(() => {
      this.connect();
      this.loadOrders();
      this.loadPendingRegistrations();
      this.loadNeedsPaymentOrders();
    }, 500);
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
    // Single API call to mark all items as DONE and set order to READY
    this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/complete`, {})
      .subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to complete order:', err);
        }
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

  getTotalPayments(): number {
    return this.needsPaymentOrders.reduce((total, order) => total + this.getOrderTotal(order), 0);
  }

  getOrdersByGuestAll(): { nickname: string; orders: Order[]; total: number }[] {
    return this.getOrdersByGuest(this.needsPaymentOrders);
  }

  markOrderPaid(orderId: string): void {
    this.http.patch(`${environment.apiUrl}/api/orders/${orderId}/paid`, {})
      .subscribe({
        next: () => {
          this.needsPaymentOrders = this.needsPaymentOrders.filter(o => o.id !== orderId);
        },
        error: (err) => {
          console.error('Failed to mark order as paid:', err);
        }
      });
  }

  markTablePaid(orders: Order[]): void {
    this.pendingPaymentOrders = orders;
    this.showPaymentModal = true;
  }

  markGuestPaid(orders: Order[]): void {
    this.pendingPaymentOrders = orders;
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.pendingPaymentOrders = [];
  }

  confirmPayment(paymentMethod: 'CASH' | 'CARD'): void {
    const orders = this.pendingPaymentOrders;
    this.closePaymentModal();

    orders.forEach(order => {
      this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/paid`, {
        paymentMethod: paymentMethod,
        paidBy: this.currentUser
      }).subscribe({
        next: () => {
          this.needsPaymentOrders = this.needsPaymentOrders.filter(o => o.id !== order.id);
        },
        error: (err) => {
          console.error('Failed to mark order as paid:', err);
        }
      });
    });
  }

  onOrderDrop(event: CdkDragDrop<Order[]>, targetColumn: string): void {
    const order = event.item.data as Order;
    const previousContainer = event.previousContainer;
    const currentContainer = event.container;

    // If dropped in the same container, do nothing
    if (previousContainer === currentContainer) {
      return;
    }

    const previousStatus = order.status;
    const previousAssignedUser = order.assignedUser;
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    // Helper to optimistically move the item
    const optimisticMove = (newStatus: string, newAssignedUser?: string | null) => {
      // Remove from previous array
      const prevIndex = previousContainer.data.findIndex(o => o.id === order.id);
      if (prevIndex > -1) {
        previousContainer.data.splice(prevIndex, 1);
      }
      // Update order status
      order.status = newStatus;
      if (newAssignedUser !== undefined) {
        (order as any).assignedUser = newAssignedUser;
      }
      // Add to new array
      currentContainer.data.splice(currentIndex, 0, order);
    };

    // Helper to revert the move on error
    const revertMove = () => {
      // Remove from current array
      const currIndex = currentContainer.data.findIndex(o => o.id === order.id);
      if (currIndex > -1) {
        currentContainer.data.splice(currIndex, 1);
      }
      // Restore order status and assigned user
      order.status = previousStatus;
      order.assignedUser = previousAssignedUser;
      // Add back to previous array
      previousContainer.data.splice(previousIndex, 0, order);
    };

    // Determine action based on source and target columns
    if (order.status === 'ACTIVE' && targetColumn === 'IN_PROGRESS') {
      // Ordered -> In Progress: Start the order
      optimisticMove('IN_PROGRESS', this.currentUser);
      this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/status?status=IN_PROGRESS&user=${encodeURIComponent(this.currentUser)}`, {})
        .subscribe({
          next: () => {},
          error: (err) => {
            console.error('Failed to start order:', err);
            revertMove();
          }
        });
    } else if (order.status === 'IN_PROGRESS' && targetColumn === 'ACTIVE') {
      // In Progress -> Ordered: Return the order
      if (order.assignedUser === this.currentUser) {
        optimisticMove('ACTIVE', null);
        this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/status?status=ACTIVE`, {})
          .subscribe({
            next: () => {},
            error: (err) => {
              console.error('Failed to return order:', err);
              revertMove();
            }
          });
      }
    } else if (order.status === 'IN_PROGRESS' && targetColumn === 'READY') {
      // In Progress -> Ready: Complete the order
      if (order.assignedUser === this.currentUser) {
        optimisticMove('READY');
        // Mark all items as DONE
        order.items.forEach(item => {
          if (item.status !== 'CANCELLED') {
            item.status = 'DONE';
          }
        });
        this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/complete`, {})
          .subscribe({
            next: () => {},
            error: (err) => {
              console.error('Failed to complete order:', err);
              revertMove();
            }
          });
      }
    } else if (order.status === 'READY' && targetColumn === 'IN_PROGRESS') {
      // Ready -> In Progress: Move back (not a common action, but handle it)
      if (order.assignedUser === this.currentUser) {
        optimisticMove('IN_PROGRESS');
        this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/status?status=IN_PROGRESS`, {})
          .subscribe({
            next: () => {},
            error: (err) => {
              console.error('Failed to move order back to in progress:', err);
              revertMove();
            }
          });
      }
    }
  }

  ngOnDestroy(): void {
    this.removeWakeUpListeners();
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }
}
