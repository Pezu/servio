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

@Component({
  selector: 'app-order-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="header-title">Orders</h1>
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

    <div style="min-height: calc(100vh - 60px); background: #f5f5f5; padding: 20px;">
      <div style="max-width: 1000px; margin: 0 auto;">
        <div *ngIf="orders.length === 0"
             style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px; text-align: center; color: #999;">
          No orders yet. Waiting for orders...
        </div>

        <div *ngFor="let order of orders"
             style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 12px; overflow: hidden;">

          <!-- Order Header (clickable) -->
          <div (click)="toggleOrder(order.id)"
               style="padding: 16px 20px; cursor: pointer; display: flex; align-items: center; border-bottom: 1px solid #eee;"
               [style.background]="getStatusColor(order.status)"
               [style.color]="'white'">
            <div style="width: 10%; font-weight: 600; font-size: 18px;">
              <span *ngIf="order.assignedUser">🔒 </span>{{ order.orderNo }}
            </div>
            <div style="width: 15%; font-size: 12px; font-weight: 500;">
              {{ order.orderPointName }}
            </div>
            <div style="width: 16.67%; font-size: 12px; font-style: italic; opacity: 0.9;">
              {{ order.note }}
            </div>
            <div style="width: 16.67%; font-size: 12px; opacity: 0.9;">
              {{ order.assignedUser }}
            </div>
            <div style="width: 8.33%; text-align: center; font-weight: 600;">
              {{ getOrderTotal(order).toFixed(2) }} RON
            </div>
            <div style="width: 16.67%; display: flex; gap: 8px; justify-content: center;">
              <button *ngIf="order.status === 'ACTIVE'"
                      (click)="startOrder(order.id); $event.stopPropagation()"
                      style="padding: 8px 16px; border: none; border-radius: 4px; background: rgba(255,255,255,0.3); color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                Start
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser"
                      (click)="returnOrder(order.id); $event.stopPropagation()"
                      style="padding: 8px 16px; border: none; border-radius: 4px; background: rgba(255,255,255,0.3); color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                Return
              </button>
              <button *ngIf="order.status === 'IN_PROGRESS' && order.assignedUser === currentUser"
                      (click)="completeOrder(order); $event.stopPropagation()"
                      style="padding: 8px 16px; border: none; border-radius: 4px; background: #4CAF50; color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                Complete
              </button>
              <button *ngIf="order.status === 'READY' && order.assignedUser === currentUser"
                      (click)="markOrderDelivered(order.id); $event.stopPropagation()"
                      style="padding: 8px 16px; border: none; border-radius: 4px; background: #9C27B0; color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                Picked Up
              </button>
            </div>
            <div style="width: 16.67%; text-align: center;">
              <span style="padding: 6px 14px; border-radius: 16px; font-size: 12px; font-weight: 500; background: rgba(255,255,255,0.2);">
                {{ order.status }}
              </span>
            </div>
          </div>

          <!-- Order Items (always visible) -->
          <div style="background: #fafafa;">
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr *ngFor="let item of order.items" style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 20px; color: #333; width: 41.67%;">{{ item.name }}</td>
                  <td style="padding: 12px 20px; color: #666; width: 25%; font-size: 12px; font-style: italic;">{{ item.note }}</td>
                  <td style="padding: 12px 20px; text-align: right;">
                    <div *ngIf="order.assignedUser === currentUser" style="display: flex; gap: 8px; justify-content: flex-end;">
                      <button *ngIf="item.status === 'ORDERED'"
                              (click)="updateItemStatus(item.id, 'DONE'); $event.stopPropagation()"
                              style="padding: 6px 12px; border: none; border-radius: 4px; background: #4CAF50; color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                        Ready
                      </button>
                      <button *ngIf="item.status === 'ORDERED'"
                              (click)="updateItemStatus(item.id, 'CANCELLED'); $event.stopPropagation()"
                              style="padding: 6px 12px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: 12px; font-weight: 500;">
                        Cancel
                      </button>
                    </div>
                  </td>
                  <td style="padding: 12px 20px; text-align: center; color: #666; width: 16.67%;">{{ item.price.toFixed(2) }} RON</td>
                  <td style="padding: 12px 20px; text-align: center; font-weight: 500; width: 8.33%;">{{ item.quantity }}</td>
                  <td style="padding: 12px 20px; text-align: center; width: 8.33%;">
                    <span [style.background]="getItemStatusColor(item.status)"
                          style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; color: white;">
                      {{ item.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    /* Header Styles */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: white;
      border-bottom: 1px solid #eee;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-left { display: flex; align-items: center; }
    .header-title { font-size: 18px; font-weight: 600; color: #333; margin: 0; }
    .header-right { display: flex; align-items: center; gap: 12px; }

    /* User Menu */
    .user-menu-wrapper { position: relative; }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }

    .user-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      min-width: 180px;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      z-index: 1000;
    }
    .user-dropdown.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .user-info {
      padding: 12px 16px;
    }
    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    .dropdown-divider {
      height: 1px;
      background: #eee;
      margin: 0;
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: none;
      font-size: 14px;
      color: #666;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }
    .dropdown-item:hover {
      background: #f5f5f5;
      color: #333;
    }
    .dropdown-item svg {
      width: 18px;
      height: 18px;
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
