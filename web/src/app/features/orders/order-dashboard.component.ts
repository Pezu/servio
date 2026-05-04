import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: 'ORDERED' | 'CANCELLED';
  note?: string;
  paid?: boolean;
  vatRate?: number;
}

interface Order {
  id: string;
  orderNo: number;
  registrationId: string;
  eventId: string;
  orderPointId: string;
  orderPointName: string;
  groupId: string;
  status: string;
  assignedUser: string | null;
  note?: string;
  needsPayment: boolean;
  nickname?: string;
  items: OrderItem[];
}

/**
 * Aggregated item row on a kanban table card: lines with the same name + status
 * (and same paid flag) from any of the underlying orders are combined into one
 * row. The `sourceItemIds` link back to the underlying OrderItemEntities so the
 * delete button can fan out hard/soft cancellation across all of them.
 */
interface AggregatedKanbanItem {
  key: string;
  name: string;
  quantity: number;
  totalPrice: number;
  status: 'ORDERED' | 'CANCELLED';
  paid: boolean;
  note?: string;
  sourceItemIds: string[];
  sourceOrderIds: string[];
}

/**
 * A card representing one OrderGroup (backend-assigned). Orders join a group at
 * creation time only — same orderPoint + existing ACTIVE order. Once the group
 * leaves ACTIVE the door closes and any new order at the OP starts a new group.
 * Drag-drop and the four arrow handlers fan out to each underlying order.
 */
interface TableCard {
  groupId: string;
  orderPointId: string;
  orderPointName: string;
  status: string;
  orders: Order[];
  orderIds: string[];
  orderNos: number[];
  items: AggregatedKanbanItem[];
  total: number;
  assignedUser: string | null;
  hasNote: boolean;
  noteText: string;
}

/** Mirror of the backend CashRegisterReceiptResponse (mock ECR for now). */
interface CashRegisterReceiptResponse {
  status: 'OK' | 'ERROR';
  receiptNumber?: string;
  fiscalReceiptId?: string;
  cashRegisterSerial?: string;
  issuedAt?: string;
  totalAmount?: number;
  paymentMethod?: 'CASH' | 'CARD';
  errorCode?: string;
  errorMessage?: string;
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
        <h1 class="header-title">{{ activeView === 'orders' ? 'Orders' : 'Payments' }}</h1>
        @if (activeView === 'orders' && visibleOrdersCount > 0) {
          <span class="order-count">{{ visibleOrdersCount }} orders</span>
        }
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
        @if (visibleOrdersCount > 0) {
          <span class="tab-badge">{{ visibleOrdersCount }}</span>
        }
      </button>
      <button class="nav-tab" [class.active]="activeView === 'payments'" (click)="navigateTo('payments')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Payments
        @if (groupedPaymentOrders.length > 0) {
          <span class="tab-badge">{{ groupedPaymentOrders.length }}</span>
        }
      </button>
    </nav>
    
    <div class="dashboard-content">
      <!-- ORDERS VIEW -->
      @if (activeView === 'orders') {
        <!-- Kanban Board -->
        <div class="kanban-board">
          <!-- Ordered Column -->
          <div class="kanban-column">
            <div class="column-header column-ordered">
              <h3>Ordered@if (orderedTables.length > 0) {
                <span class="column-count">{{ orderedTables.length }}</span>
              }</h3>
            </div>
            <div class="column-content"
              cdkDropList
              #orderedList="cdkDropList"
              [cdkDropListData]="orderedTables"
              [cdkDropListConnectedTo]="[inProgressList]"
              [cdkDropListSortingDisabled]="true"
              (cdkDropListDropped)="onTableCardDrop($event, 'ACTIVE')">
              @for (card of orderedTables; track trackByTableCard($index, card)) {
                <div class="order-card" cdkDrag [cdkDragData]="card">
                  <div class="drag-placeholder" *cdkDragPlaceholder></div>
                  <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: card }"></ng-container>
                </div>
              }
              @if (orderedTables.length === 0) {
                <div class="column-empty">No orders</div>
              }
            </div>
          </div>
          <!-- In Progress Column -->
          <div class="kanban-column">
            <div class="column-header column-in-progress">
              <h3>In Progress@if (inProgressTables.length > 0) {
                <span class="column-count">{{ inProgressTables.length }}</span>
              }</h3>
            </div>
            <div class="column-content"
              cdkDropList
              #inProgressList="cdkDropList"
              [cdkDropListData]="inProgressTables"
              [cdkDropListConnectedTo]="[orderedList, readyList]"
              [cdkDropListSortingDisabled]="true"
              (cdkDropListDropped)="onTableCardDrop($event, 'IN_PROGRESS')">
              @for (card of inProgressTables; track trackByTableCard($index, card)) {
                <div class="order-card" cdkDrag [cdkDragData]="card" [cdkDragDisabled]="card.assignedUser !== currentUser">
                  <div class="drag-placeholder" *cdkDragPlaceholder></div>
                  <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: card }"></ng-container>
                </div>
              }
              @if (inProgressTables.length === 0) {
                <div class="column-empty">No orders</div>
              }
            </div>
          </div>
          <!-- Ready Column -->
          <div class="kanban-column">
            <div class="column-header column-ready">
              <h3>Ready@if (readyTables.length > 0) {
                <span class="column-count">{{ readyTables.length }}</span>
              }</h3>
            </div>
            <div class="column-content"
              cdkDropList
              #readyList="cdkDropList"
              [cdkDropListData]="readyTables"
              [cdkDropListConnectedTo]="[inProgressList]"
              [cdkDropListSortingDisabled]="true"
              (cdkDropListDropped)="onTableCardDrop($event, 'READY')">
              @for (card of readyTables; track trackByTableCard($index, card)) {
                <div class="order-card" cdkDrag [cdkDragData]="card" [cdkDragDisabled]="card.assignedUser !== currentUser">
                  <div class="drag-placeholder" *cdkDragPlaceholder></div>
                  <ng-container *ngTemplateOutlet="orderCardTemplate; context: { $implicit: card }"></ng-container>
                </div>
              }
              @if (readyTables.length === 0) {
                <div class="column-empty">No orders</div>
              }
            </div>
          </div>
        </div>
        <!-- Order Card Template (groups all orders at the same orderPoint) -->
        <ng-template #orderCardTemplate let-card>
          <!-- Card Header -->
          <div class="card-header">
            <span class="order-number">{{ formatOrderNos(card.orderNos) }}</span>
            <div class="header-center">
              <span class="order-point-name">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ card.orderPointName }}
              </span>
            </div>
            <span class="order-amount">{{ card.total.toFixed(2) }} RON</span>
          </div>
          <!-- Combined notes (one per source order) -->
          @if (card.hasNote) {
            <div class="order-note">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>{{ card.noteText }}</span>
            </div>
          }
          <!-- Items List (aggregated across the group's orders) -->
          <div class="items-list">
            @for (item of card.items; track item.key) {
              <div class="item-row" [class.item-cancelled]="item.status === 'CANCELLED'">
                <div class="item-info">
                  <span class="item-qty">{{ item.quantity }}x</span>
                  <span class="item-name" [innerHTML]="item.name"></span>
                  <span class="item-price">{{ item.totalPrice.toFixed(2) }}</span>
                </div>
                @if (item.note) {
                  <div class="item-note">{{ item.note }}</div>
                }
                @if (card.assignedUser === currentUser && !item.paid && item.status !== 'CANCELLED' && (
                  (card.status === 'ACTIVE' && item.status === 'ORDERED') ||
                  card.status === 'IN_PROGRESS'
                )) {
                  <div class="item-actions">
                    <button class="btn-item btn-cancel" (pointerdown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="removeOrderItemFromCard(card, item)">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                }
                @if (item.status === 'CANCELLED') {
                  <div class="item-status-icon">
                    <svg class="icon-cancelled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                }
              </div>
            }
          </div>
          <!-- Card Footer -->
          <div class="card-footer">
            <div class="card-actions">
              @if (card.status === 'ACTIVE') {
                <button class="arrow-btn arrow-btn-start" (pointerdown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="startTableCard(card)" title="Start">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              }
              @if (card.status === 'IN_PROGRESS' && card.assignedUser === currentUser) {
                <button class="arrow-btn arrow-btn-return" (pointerdown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="returnTableCard(card)" title="Return">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              }
              @if (card.status === 'IN_PROGRESS' && card.assignedUser === currentUser) {
                <button class="arrow-btn arrow-btn-complete" (pointerdown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="completeTableCard(card)" title="Complete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              }
              @if (card.status === 'READY' && card.assignedUser === currentUser) {
                <button class="arrow-btn arrow-btn-deliver" (pointerdown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="markTableCardDelivered(card)" title="Picked Up">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              }
            </div>
          </div>
        </ng-template>
      }
    
      <!-- VALIDATIONS VIEW -->
      @if (activeView === 'permissions') {
        <!-- Empty State -->
        @if (!loadingPending && pendingRegistrations.length === 0) {
          <div class="empty-state validations-empty">
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
        }
        <!-- Validation Cards Grid -->
        @if (pendingRegistrations.length > 0) {
          <div class="validations-grid">
            @for (registration of pendingRegistrations; track registration) {
              <div class="validation-card">
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
            }
          </div>
        }
      }
    
      <!-- PAYMENTS VIEW -->
      @if (activeView === 'payments') {
        <!-- Empty State -->
        @if (!loadingNeedsPayment && needsPaymentOrders.length === 0) {
          <div class="empty-state payments-empty">
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
        }
        <!-- Payments Grid -->
        @if (!loadingNeedsPayment && needsPaymentOrders.length > 0) {
          <div class="payments-container">
            <!-- Controls Bar -->
            <div class="payments-controls">
              <div class="view-toggle-bar">
                <button class="toggle-btn" [class.active]="paymentMode === 'table'" (click)="paymentMode = 'table'">Table</button>
                <button class="toggle-btn" [class.active]="paymentMode === 'guest'" (click)="paymentMode = 'guest'">Guest</button>
              </div>
            </div>
            <!-- TABLE MODE - Grouped by Table (Order Point) -->
            @if (paymentMode === 'table') {
              <div class="payments-by-table">
                @for (table of groupedPaymentOrders; track table.orderPointId) {
                  <div class="table-section">
                    <div class="table-section-header">
                      <div class="table-info">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="table-name">{{ table.orderPointName }}</span>
                        @if (table.creditValue) {
                          <span class="credit-badge">Credit: {{ table.creditValue | number:'1.0-2' }} RON</span>
                        }
                      </div>
                      <div class="table-header-right">
                        <span class="table-total-badge">{{ table.total | number:'1.0-2' }} RON</span>
                        <button class="btn-collect" (click)="markTablePaid(table.orders)">Collect</button>
                      </div>
                    </div>
                    <div class="table-items-list">
                      @for (item of table.aggregatedItems; track item.name) {
                        <div class="aggregated-item-row">
                          <span class="item-qty">{{ item.quantity }}x</span>
                          <span class="item-name" [innerHTML]="item.name"></span>
                          <span class="item-price">{{ item.totalPrice | number:'1.0-2' }} RON</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
            <!-- GUEST MODE - Tables as parents, Guests as children -->
            @if (paymentMode === 'guest') {
              <div class="payments-by-guest">
                @for (table of groupedPaymentOrders; track table.orderPointId) {
                  <div class="table-parent-card">
                    <div class="table-parent-header">
                      <div class="table-info">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="table-name">{{ table.orderPointName }}</span>
                        @if (table.creditValue) {
                          <span class="credit-badge">Credit: {{ table.creditValue | number:'1.0-2' }} RON</span>
                        }
                      </div>
                      <span class="table-total-badge">{{ table.total | number:'1.0-2' }} RON</span>
                    </div>
                    <div class="guest-children">
                      @for (guest of table.guests; track guest.nickname) {
                        <div class="guest-child-card">
                          <div class="guest-child-header">
                            <div class="guest-info">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span class="guest-nickname">{{ guest.nickname }}</span>
                            </div>
                            <div class="guest-header-right">
                              <span class="guest-total-badge">{{ guest.total | number:'1.0-2' }} RON</span>
                              <button class="btn-collect" (click)="markGuestPaid(guest.orders)">Collect</button>
                            </div>
                          </div>
                          <div class="guest-items-list">
                            @for (item of guest.aggregatedItems; track item.name) {
                              <div class="aggregated-item-row">
                                <span class="item-qty">{{ item.quantity }}x</span>
                                <span class="item-name" [innerHTML]="item.name"></span>
                                <span class="item-price">{{ item.totalPrice | number:'1.0-2' }} RON</span>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
    
    <!-- Payment Method Modal -->
    @if (showPaymentModal) {
      <div class="payment-modal-overlay" (click)="closePaymentModal()">
        <div class="payment-modal" (click)="$event.stopPropagation()">
          <div class="payment-modal-header">
            <h3>Select Payment Method</h3>
            <button class="modal-close-btn" (click)="closePaymentModal()" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          @if (cashRegisters.length > 0) {
            <div class="payment-modal-section-label">Cash register</div>
            <div class="payment-modal-body register-grid">
              @for (cr of cashRegisters; track cr.id) {
                <button class="payment-method-btn register"
                        [class.selected]="selectedCashRegisterDeviceId === cr.id"
                        (click)="selectedCashRegisterDeviceId = cr.id">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2m-8 0h8m-8 0a2 2 0 01-2-2V8a2 2 0 012-2h8a2 2 0 012 2v7a2 2 0 01-2 2M9 8h6" />
                  </svg>
                  {{ cr.name || 'Register' }}
                </button>
              }
            </div>
          }
          <div class="payment-modal-section-label">Payment method</div>
          <div class="payment-modal-body">
            <button class="payment-method-btn cash" (click)="confirmPayment('CASH')" [disabled]="!selectedCashRegisterDeviceId && cashRegisters.length > 0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Cash
            </button>
            <button class="payment-method-btn card" (click)="confirmPayment('CARD')" [disabled]="!selectedCashRegisterDeviceId && cashRegisters.length > 0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Card
            </button>
          </div>
        </div>
      </div>
    }
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
      border-radius: 0;
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
      border-radius: 0;
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
      border: 1px solid transparent;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-item svg { width: 14px; height: 14px; }
    .btn-cancel { background: transparent; color: #dc2626; border-color: #fecaca; }
    .btn-cancel:hover { background: transparent; color: #b91c1c; border-color: #dc2626; }

    .item-status-icon { display: flex; }
    .item-status-icon svg { width: 20px; height: 20px; }
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
      padding: 0;
      background: transparent;
      border-radius: 0;
      border: none;
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
      background: transparent;
      border: 1px solid #e8ecf1;
      border-radius: 0;
      padding: 3px;
    }
    .toggle-btn {
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 0;
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
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }
    @media (max-width: 700px) {
      .payments-by-table { grid-template-columns: 1fr; }
    }
    .table-section {
      background: transparent;
      border-radius: 0;
      padding: 16px;
      box-sizing: border-box;
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
      background: transparent;
      padding: 6px 0;
      border-radius: 0;
      border: none;
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
      background: transparent;
      border-radius: 0;
      border: none;
    }
    .aggregated-item-row .item-qty {
      font-weight: 600;
      color: #64748b;
      min-width: 30px;
      background: transparent;
      padding: 0;
      border-radius: 0;
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
    .table-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-collect {
      padding: 8px 18px;
      background: transparent;
      color: #16a34a;
      border: 1px solid #bbf7d0;
      border-radius: 0;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-collect:hover {
      background: #f0fdf4;
      border-color: #86efac;
    }

    /* Payments By Guest (Table as parent, Guests as children) */
    .payments-by-guest {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .table-parent-card {
      background: transparent;
      border-radius: 0;
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
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    @media (max-width: 700px) {
      .guest-children { grid-template-columns: 1fr; }
    }
    .guest-child-card {
      background: white;
      border-radius: 0;
      padding: 12px 16px;
      border: 1px solid #e8ecf1;
      box-sizing: border-box;
    }
    .guest-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
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
      background: transparent;
      padding: 4px 0;
      border-radius: 0;
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
      border-radius: 0;
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
      border: 1px solid #e8ecf1;
      background: transparent;
      border-radius: 0;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .modal-close-btn:hover {
      background: transparent;
      color: #334155;
      border-color: #cbd5e1;
    }
    .modal-close-btn svg { width: 16px; height: 16px; display: block; }
    .payment-modal-body {
      padding: 16px 24px 24px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .payment-modal-body.register-grid { padding-bottom: 8px; }
    .payment-modal-section-label {
      padding: 12px 24px 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #64748b;
      text-transform: uppercase;
    }
    .payment-method-btn.register {
      min-width: calc(50% - 8px);
      flex: 1 1 calc(50% - 8px);
      padding: 18px 12px;
      font-size: 14px;
    }
    .payment-method-btn.register.selected {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      color: #1d4ed8;
    }
    .payment-method-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .payment-method-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 16px;
      border: 1px solid #e8ecf1;
      border-radius: 0;
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
  cashRegisters: { id: string; name: string }[] = [];
  selectedCashRegisterDeviceId: string | null = null;

  // Cached kanban columns. One TableCard groups all orders at the same orderPoint
  // matching that column's status (ACTIVE / IN_PROGRESS / READY). Items inside the
  // card carry their source order's nickname so authorship is visible per item.
  orderedTables: TableCard[] = [];
  inProgressTables: TableCard[] = [];
  readyTables: TableCard[] = [];

  // Cached grouped payment data (keyed by orderPointId; recomputed only on data change)
  groupedPaymentOrders: {
    orderPointId: string;
    orderPointName: string;
    orders: Order[];
    creditValue?: number;
    aggregatedItems: { name: string; quantity: number; totalPrice: number }[];
    total: number;
    guests: { nickname: string; orders: Order[]; total: number; aggregatedItems: { name: string; quantity: number; totalPrice: number }[] }[];
  }[] = [];

  // Track by function for drag-drop performance
  trackByTableCard = (index: number, card: TableCard): string => card.groupId;

  formatOrderNos(nos: number[]): string {
    if (!nos.length) return '';
    if (nos.length === 1) return '#' + nos[0];
    return nos.map(n => '#' + n).join(', ');
  }

  startTableCard(card: TableCard): void {
    this.transitionGroup(card, 'IN_PROGRESS', this.currentUser);
  }

  returnTableCard(card: TableCard): void {
    this.transitionGroup(card, 'ACTIVE');
  }

  completeTableCard(card: TableCard): void {
    this.transitionGroup(card, 'READY');
  }

  markTableCardDelivered(card: TableCard): void {
    this.transitionGroup(card, 'DELIVERED');
  }

  /**
   * Single PATCH to /api/orders/groups/{groupId}/status — every non-terminal order
   * in the group is updated in one transaction, broadcast once. Avoids the visible
   * "half-moved group" flash that the per-order fan-out used to produce.
   */
  private transitionGroup(card: TableCard, status: string, user?: string): void {
    let url = `${environment.apiUrl}/api/orders/groups/${card.groupId}/status?status=${status}`;
    if (user) {
      url += `&user=${encodeURIComponent(user)}`;
    }
    this.http.patch(url, {}).subscribe({
      next: () => this.loadOrders(),
      error: (err) => console.error('Failed to update group status:', err)
    });
  }

  removeOrderItemFromCard(card: TableCard, item: AggregatedKanbanItem): void {
    // Fan out the delete across every underlying source line — one aggregated
    // row may map to multiple OrderItemEntities (different guests, same item).
    item.sourceItemIds.forEach((itemId, idx) => {
      const orderId = item.sourceOrderIds[idx];
      const sourceOrder = card.orders.find(o => o.id === orderId);
      if (sourceOrder) {
        this.removeOrderItem(sourceOrder, itemId);
      }
    });
  }

  private updateKanbanColumns(): void {
    // Ordered column: visible to everyone, grouped by orderPoint
    this.orderedTables = this.groupOrdersByTable(this.orders.filter(o => o.status === 'ACTIVE'));
    // In Progress / Ready: each user sees their own assigned orders, grouped by orderPoint
    this.inProgressTables = this.groupOrdersByTable(
      this.orders.filter(o => o.status === 'IN_PROGRESS' && o.assignedUser === this.currentUser)
    );
    this.readyTables = this.groupOrdersByTable(
      this.orders.filter(o => o.status === 'READY' && o.assignedUser === this.currentUser)
    );
  }

  // Header counter: only count what's actually rendered. Without this, a single
  // IN_PROGRESS/READY order assigned to another user makes the badge say "1 orders"
  // while every column on the current user's screen is empty.
  get visibleOrdersCount(): number {
    return this.orderedTables.reduce((s, t) => s + t.orders.length, 0)
      + this.inProgressTables.reduce((s, t) => s + t.orders.length, 0)
      + this.readyTables.reduce((s, t) => s + t.orders.length, 0);
  }

  private groupOrdersByTable(orders: Order[]): TableCard[] {
    const groups = new Map<string, Order[]>();
    for (const order of orders) {
      // Group key is the backend-assigned groupId, not the orderPointId, so two
      // orders at the same OP that took different lifecycles stay separate.
      const key = order.groupId || order.id;
      const existing = groups.get(key);
      if (existing) {
        existing.push(order);
      } else {
        groups.set(key, [order]);
      }
    }

    return Array.from(groups.entries()).map(([groupId, group]) => {
      // Sort by orderNo so the newest item additions appear at the bottom
      group.sort((a, b) => a.orderNo - b.orderNo);

      // Aggregate items across all orders in the group: same name + status + paid
      // collapses into one row, with source ids preserved for delete fan-out.
      const aggregated = new Map<string, AggregatedKanbanItem>();
      for (const order of group) {
        for (const item of order.items) {
          const key = `${item.name}::${item.status}::${item.paid ? 'p' : 'u'}`;
          const existing = aggregated.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            existing.totalPrice += item.price * item.quantity;
            existing.sourceItemIds.push(item.id);
            existing.sourceOrderIds.push(order.id);
          } else {
            aggregated.set(key, {
              key,
              name: item.name,
              quantity: item.quantity,
              totalPrice: item.price * item.quantity,
              status: item.status,
              paid: !!item.paid,
              note: item.note,
              sourceItemIds: [item.id],
              sourceOrderIds: [order.id]
            });
          }
        }
      }
      const items = Array.from(aggregated.values());

      const total = group.reduce((sum, o) => sum + this.getOrderTotal(o), 0);
      const assignedUser = group[0]?.assignedUser ?? null;
      const noteParts = group.map(o => o.note).filter((n): n is string => !!n);
      return {
        groupId,
        orderPointId: group[0]?.orderPointId || 'unknown',
        orderPointName: group[0]?.orderPointName || 'Unknown',
        status: group[0]?.status || '',
        orders: group,
        orderIds: group.map(o => o.id),
        orderNos: group.map(o => o.orderNo),
        items,
        total,
        assignedUser,
        hasNote: noteParts.length > 0,
        noteText: noteParts.join(' · ')
      };
    });
  }

  private updateGroupedPaymentOrders(): void {
    const groups = new Map<string, { orderPointName: string; orders: Order[] }>();
    for (const order of this.needsPaymentOrders) {
      const key = order.orderPointId || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, { orderPointName: order.orderPointName || 'Unknown', orders: [] });
      }
      groups.get(key)!.orders.push(order);
    }
    this.groupedPaymentOrders = Array.from(groups.entries()).map(([orderPointId, data]) => ({
      orderPointId,
      orderPointName: data.orderPointName,
      orders: data.orders,
      creditValue: this.creditValueMap.get(orderPointId),
      aggregatedItems: this.getAggregatedItems(data.orders),
      total: this.getGroupTotal(data.orders),
      guests: this.getOrdersByGuest(data.orders).map(g => ({
        ...g,
        aggregatedItems: this.getAggregatedItems(g.orders)
      }))
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
    }
    // Orders and payments are kept live via WebSocket; no fetch needed on tab switch.
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
        this.updateGroupedPaymentOrders();
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
      this.loadCashRegisters();
      this.connect();
    }
  }

  private loadCashRegisters(): void {
    this.http.get<{ id: string; name: string }[]>(`${environment.apiUrl}/api/events/${this.eventId}/cash-registers`)
      .subscribe({
        next: (registers) => {
          this.cashRegisters = registers || [];
          this.selectedCashRegisterDeviceId = this.cashRegisters[0]?.id ?? null;
        },
        error: (err) => {
          console.error('Failed to load cash registers:', err);
          this.cashRegisters = [];
        }
      });
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

        // Subscribe to payment updates for this event (mark-paid, payment-complete, etc.)
        this.stompClient?.subscribe(`/topic/event/${this.eventId}/payments`, (message) => {
          console.log('Received payment update via WebSocket:', message.body);
          this.loadNeedsPaymentOrders();
        });

        // Subscribe to async cash-register replies pushed by the agent.
        this.stompClient?.subscribe(`/topic/event/${this.eventId}/cash-register-reply`, (message) => {
          console.log('[CashRegister] Async ECR reply via WebSocket:', message.body);
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

  removeOrderItem(order: Order, itemId: string): void {
    // For in-progress orders we hard-delete the item; otherwise we soft-cancel it.
    if (order.status === 'IN_PROGRESS') {
      this.http.delete(`${environment.apiUrl}/api/orders/items/${itemId}`)
        .subscribe({
          next: () => this.loadOrders(),
          error: (err) => console.error('Failed to delete item:', err)
        });
    } else {
      this.updateItemStatus(itemId, 'CANCELLED');
    }
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
          this.updateGroupedPaymentOrders();
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

    // Push the receipt request to the backend; it builds the fiscal payload,
    // logs it, "talks" to the cash register, and returns the receipt response
    // (number, fiscal id, status, ...). Then mark the orders paid.
    this.http.post<CashRegisterReceiptResponse>(`${environment.apiUrl}/api/orders/cash-register/receipt`, {
      orderIds: orders.map(o => o.id),
      paymentMethod,
      operator: this.currentUser,
      cashRegisterDeviceId: this.selectedCashRegisterDeviceId
    }).subscribe({
      next: (receipt) => {
        console.log('[CashRegister] ECR response:', receipt);
      },
      error: (err) => {
        console.error('[CashRegister] Failed to print receipt:', err);
      }
    });

    orders.forEach(order => {
      this.http.patch(`${environment.apiUrl}/api/orders/${order.id}/paid`, {
        paymentMethod: paymentMethod,
        paidBy: this.currentUser
      }).subscribe({
        next: () => {
          this.needsPaymentOrders = this.needsPaymentOrders.filter(o => o.id !== order.id);
          this.updateGroupedPaymentOrders();
        },
        error: (err) => {
          console.error('Failed to mark order as paid:', err);
        }
      });
    });
  }

  onTableCardDrop(event: CdkDragDrop<TableCard[]>, targetColumn: string): void {
    const card = event.item.data as TableCard;
    if (event.previousContainer === event.container) {
      return;
    }

    // One atomic PATCH per drop — backend updates every order in the group in
    // a single transaction so the dashboard never sees a half-moved group.
    if (card.status === 'ACTIVE' && targetColumn === 'IN_PROGRESS') {
      this.transitionGroup(card, 'IN_PROGRESS', this.currentUser);
    } else if (card.status === 'IN_PROGRESS' && targetColumn === 'ACTIVE') {
      if (card.assignedUser === this.currentUser) {
        this.transitionGroup(card, 'ACTIVE');
      }
    } else if (card.status === 'IN_PROGRESS' && targetColumn === 'READY') {
      if (card.assignedUser === this.currentUser) {
        this.transitionGroup(card, 'READY');
      }
    } else if (card.status === 'READY' && targetColumn === 'IN_PROGRESS') {
      if (card.assignedUser === this.currentUser) {
        this.transitionGroup(card, 'IN_PROGRESS');
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
