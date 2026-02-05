import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { environment } from '../../../../environments/environment';

interface OrderNotification {
  orderId: string;
  orderNo: number;
  type: string;
  message: string;
  itemName?: string;
  orderClosed: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  orderable: boolean;
  price?: number;
  imagePath?: string;
  description?: string;
  children: MenuItem[];
}

interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

interface ApiOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  note?: string;
}

interface ApiOrder {
  id: string;
  orderNo: number;
  status: string;
  note?: string;
  items: ApiOrderItem[];
}

interface EventData {
  id: string;
  name: string;
  logoPath?: string;
}

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
})
export class RegistrationComponent implements OnInit, OnDestroy {
  eventId: string = '';
  orderPointId: string = '';
  registrationResponse: any = null;
  loading: boolean = false;
  error: string = '';

  // Navigation
  menuOpen: boolean = false;
  activeView: 'menu' | 'orders' | 'checkout' = 'menu';
  categoryNavExpanded: boolean = false;

  // Menu
  menuItems: MenuItem[] = [];
  loadingMenu: boolean = false;
  quantities: Map<string, number> = new Map();
  placingOrder: boolean = false;
  orderStatus: string = '';

  // Orders
  orders: ApiOrder[] = [];
  loadingOrders: boolean = false;

  // Event data
  eventData: EventData | null = null;

  // WebSocket and notifications
  private stompClient: Client | null = null;
  notifications: OrderNotification[] = [];
  activeOrderIds: Set<string> = new Set();
  connected: boolean = false;
  private audioContext: AudioContext | null = null;

  // Toast
  showingToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.eventId = params['eventId'];
      this.orderPointId = params['orderPointId'];

      const existingRegistration = this.getCookie('registrationResponse');
      const storedEventId = this.getCookie('eventId');

      console.log('[Init] Route params:', { eventId: this.eventId, orderPointId: this.orderPointId });
      console.log('[Init] Cookies:', {
        hasRegistration: !!existingRegistration,
        storedEventId,
        eventIdMatch: storedEventId === this.eventId
      });

      // Use existing registration only if we have both the registration AND a matching eventId
      if (existingRegistration && storedEventId === this.eventId) {
        this.registrationResponse = JSON.parse(existingRegistration);
        console.log('[Init] Using existing registration:', this.registrationResponse?.id);
        this.loadActiveOrders();
      } else {
        // Different event, missing eventId cookie, or no registration - clear and start fresh
        console.log('[Init] Creating new registration (no match or missing data)');
        this.clearAllCookies();
        this.registerToEvent();
      }

      this.loadMenuItems();
      this.loadEventData();
      this.checkPaymentResult();
    });
  }

  private checkPaymentResult(): void {
    const paymentSuccess = localStorage.getItem('paymentSuccess');
    const paymentError = localStorage.getItem('paymentError');
    const confirmedOrderId = localStorage.getItem('confirmedOrderId');

    console.log('[Payment] Checking payment result:', {
      paymentSuccess,
      paymentError,
      confirmedOrderId,
      hasRegistration: !!this.registrationResponse,
      registrationId: this.registrationResponse?.id
    });

    if (paymentSuccess) {
      localStorage.removeItem('paymentSuccess');
      this.showToast('Order placed successfully!', 'success');

      // Add the confirmed order to active orders and connect WebSocket
      if (confirmedOrderId) {
        console.log('[Payment] Adding order to active orders:', confirmedOrderId);
        localStorage.removeItem('confirmedOrderId');
        this.activeOrderIds.add(confirmedOrderId);
        this.saveActiveOrders();
        this.connectWebSocket();
      }
    } else if (paymentError) {
      localStorage.removeItem('paymentError');
      localStorage.removeItem('confirmedOrderId');
      this.showToast('Payment failed. Please try again.', 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showingToast = true;
    setTimeout(() => {
      this.showingToast = false;
    }, 4000);
  }

  private clearAllCookies(): void {
    this.deleteCookie('registrationResponse');
    this.deleteCookie('orderPointId');
    this.deleteCookie('activeOrders');
    this.deleteCookie('eventId');
    this.activeOrderIds.clear();
    this.disconnectWebSocket();
  }

  loadEventData(): void {
    this.http.get<EventData>(`${environment.apiUrl}/api/events/${this.eventId}`)
      .subscribe({
        next: (event) => {
          this.eventData = event;
        },
        error: (err) => {
          console.error('Error loading event data:', err);
        }
      });
  }

  getLogoUrl(logoPath: string): string {
    return `${environment.apiUrl}/api/images/${logoPath}`;
  }

  getItemImageUrl(imagePath: string): string {
    return `${environment.apiUrl}/api/images/${imagePath}`;
  }

  ngOnDestroy(): void {
    this.disconnectWebSocket();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  // Navigation
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  navigateTo(view: 'menu' | 'orders'): void {
    this.activeView = view;
    this.closeMenu();
    if (view === 'orders') {
      this.loadOrders();
    }
  }

  registerToEvent(): void {
    this.loading = true;
    this.error = '';

    this.http.post(`${environment.apiUrl}/api/register/events/${this.eventId}`, {})
      .subscribe({
        next: (response) => {
          this.registrationResponse = response;
          this.setCookie('registrationResponse', JSON.stringify(response), 7);
          this.setCookie('orderPointId', this.orderPointId, 7);
          this.setCookie('eventId', this.eventId, 7);
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to register: ' + (err.message || 'Unknown error');
          this.loading = false;
        }
      });
  }

  // Menu methods
  loadMenuItems(): void {
    this.loadingMenu = true;
    this.http.get<MenuItem[]>(`${environment.apiUrl}/api/events/${this.eventId}/menu`)
      .subscribe({
        next: (items) => {
          this.menuItems = items;
          this.loadingMenu = false;
        },
        error: (err) => {
          console.error('Error loading menu:', err);
          this.loadingMenu = false;
        }
      });
  }

  getQuantity(itemId: string): number {
    return this.quantities.get(itemId) || 0;
  }

  increaseQuantity(item: MenuItem): void {
    const current = this.getQuantity(item.id);
    this.quantities.set(item.id, current + 1);
  }

  decreaseQuantity(item: MenuItem): void {
    const current = this.getQuantity(item.id);
    if (current > 0) {
      this.quantities.set(item.id, current - 1);
    }
  }

  getSelectedItems(): OrderItem[] {
    const items: OrderItem[] = [];
    this.collectSelectedItems(this.menuItems, items);
    return items;
  }

  private collectSelectedItems(menuItems: MenuItem[], result: OrderItem[]): void {
    for (const item of menuItems) {
      if (item.orderable) {
        const qty = this.getQuantity(item.id);
        if (qty > 0) {
          result.push({ menuItem: item, quantity: qty });
        }
      }
      if (item.children && item.children.length > 0) {
        this.collectSelectedItems(item.children, result);
      }
    }
  }

  getTotalItems(): number {
    return this.getSelectedItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.getSelectedItems().reduce((sum, item) => {
      return sum + (item.menuItem.price || 0) * item.quantity;
    }, 0);
  }

  goToCheckout(): void {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) {
      this.orderStatus = 'Please select at least one item';
      return;
    }
    this.orderStatus = '';
    this.activeView = 'checkout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToMenu(): void {
    this.activeView = 'menu';
  }

  placeOrder(): void {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) {
      this.orderStatus = 'Please select at least one item';
      return;
    }

    const registrationResponse = this.getCookie('registrationResponse');
    const orderPointId = this.getCookie('orderPointId');

    if (!registrationResponse || !orderPointId) {
      this.orderStatus = 'Error: Missing registration data';
      return;
    }

    const registration = JSON.parse(registrationResponse);
    const orderItems = selectedItems.map(item => ({
      name: item.menuItem.name,
      price: item.menuItem.price || 0,
      quantity: item.quantity
    }));

    const orderRequest = {
      registrationId: registration.id,
      orderPointId: orderPointId,
      orderItems: orderItems
    };

    console.log('[Order] Creating order with registrationId:', registration.id);

    this.placingOrder = true;
    this.orderStatus = '';

    // First create the order (will be in DRAFT status)
    this.http.post<any>(`${environment.apiUrl}/api/orders`, orderRequest)
      .subscribe({
        next: (orderResponse) => {
          // Store order ID for confirmation after payment
          localStorage.setItem('pendingOrderId', orderResponse.id);
          localStorage.setItem('paymentEventId', this.eventId);
          localStorage.setItem('paymentOrderPointId', this.orderPointId);

          const totalAmount = this.getTotalPrice();

          // Start payment with Netopia
          this.http.post<any>(`${environment.apiUrl}/api/payments/netopia/start`, {
            orderId: 'ORDER_' + orderResponse.orderNo,
            amount: totalAmount
          }).subscribe({
            next: (paymentResponse) => {
              // Clear cart before redirecting
              this.quantities.clear();

              // Redirect to Netopia payment page
              if (paymentResponse.payment?.paymentURL) {
                window.location.href = paymentResponse.payment.paymentURL;
              } else {
                this.orderStatus = 'Payment URL not received';
                this.placingOrder = false;
              }
            },
            error: (err) => {
              console.error('Payment error:', err);
              this.orderStatus = 'Failed to start payment: ' + (err.error?.message || err.message || 'Unknown error');
              this.placingOrder = false;
            }
          });
        },
        error: (err) => {
          this.orderStatus = 'Failed to create order: ' + (err.message || 'Unknown error');
          this.placingOrder = false;
        }
      });
  }

  // Orders methods
  loadOrders(): void {
    if (!this.registrationResponse?.id) return;

    this.loadingOrders = true;
    this.http.get<ApiOrder[]>(`${environment.apiUrl}/api/orders/registrations/${this.registrationResponse.id}`)
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loadingOrders = false;
        },
        error: (err) => {
          console.error('Error loading orders:', err);
          this.loadingOrders = false;
        }
      });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return '#2196F3';
      case 'IN_PROGRESS': return '#FF9800';
      case 'READY': return '#4CAF50';
      case 'DELIVERED': return '#4CAF50';
      case 'CANCELLED': return '#f44336';
      default: return '#757575';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Pending';
      case 'IN_PROGRESS': return 'In Progress';
      case 'READY': return 'Ready';
      case 'DELIVERED': return 'Delivered';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  getItemStatusLabel(status: string): string {
    switch (status) {
      case 'ORDERED': return 'Ordered';
      case 'IN_PROGRESS': return 'Preparing';
      case 'DONE': return 'Ready';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  getOrderTotal(order: ApiOrder): number {
    return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Cookie methods
  getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  setCookie(name: string, value: string, days: number): void {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  }

  deleteCookie(name: string): void {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  // WebSocket methods
  private loadActiveOrders(): void {
    const activeOrdersJson = this.getCookie('activeOrders');
    console.log('[Init] Loading active orders from cookie:', activeOrdersJson);
    if (activeOrdersJson) {
      const orderIds = JSON.parse(activeOrdersJson) as string[];
      orderIds.forEach(id => this.activeOrderIds.add(id));
      console.log('[Init] Active order IDs loaded:', orderIds);
      if (this.activeOrderIds.size > 0) {
        this.connectWebSocket();
      }
    }
  }

  private saveActiveOrders(): void {
    const orderIds = Array.from(this.activeOrderIds);
    if (orderIds.length > 0) {
      this.setCookie('activeOrders', JSON.stringify(orderIds), 7);
    } else {
      this.deleteCookie('activeOrders');
    }
  }

  private connectWebSocket(): void {
    if (this.stompClient?.active) {
      console.log('[WebSocket] Already connected');
      return;
    }
    if (!this.registrationResponse?.id) {
      console.log('[WebSocket] No registration ID, cannot connect');
      return;
    }

    const registrationId = this.registrationResponse.id;
    console.log('[WebSocket] Connecting for registration:', registrationId);

    this.stompClient = new Client({
      webSocketFactory: () => new (SockJS as any)(`${environment.apiUrl}/ws`),
      onConnect: () => {
        this.connected = true;
        console.log('[WebSocket] Connected, subscribing to /topic/registration/' + registrationId);
        this.stompClient?.subscribe(`/topic/registration/${registrationId}`, (message) => {
          console.log('[WebSocket] Received message:', message.body);
          const notification = JSON.parse(message.body) as OrderNotification;
          this.handleNotification(notification);
        });
      },
      onStompError: (error) => {
        console.error('[WebSocket] STOMP error:', error);
        this.connected = false;
      },
      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
      }
    });

    this.stompClient.activate();
  }

  private disconnectWebSocket(): void {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
  }

  private handleNotification(notification: OrderNotification): void {
    this.notifications.unshift(notification);
    this.playBeep();

    // Auto-dismiss: 2s if on orders view, 5s otherwise
    const dismissTime = this.activeView === 'orders' ? 2000 : 5000;
    setTimeout(() => {
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, dismissTime);

    // Refresh orders if on orders view
    if (this.activeView === 'orders') {
      this.loadOrders();
    }

    if (notification.orderClosed) {
      this.activeOrderIds.delete(notification.orderId);
      this.saveActiveOrders();

      if (this.activeOrderIds.size === 0) {
        this.disconnectWebSocket();
      }
    }
  }

  onNotificationClick(notification: OrderNotification, index: number): void {
    this.notifications.splice(index, 1);
    if (this.activeView !== 'orders') {
      this.navigateTo('orders');
    }
  }

  private playBeep(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {
      console.error('Could not play beep:', e);
    }
  }

  dismissNotification(index: number): void {
    this.notifications.splice(index, 1);
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'ORDER_TAKEN':
      case 'ITEM_STARTED':
        return '#FF9800';
      case 'ITEM_READY':
        return '#4CAF50';
      case 'ORDER_READY':
        return '#2196F3';
      case 'ORDER_DELIVERED':
        return '#9C27B0';
      case 'ORDER_CANCELLED':
      case 'ITEM_CANCELLED':
        return '#f44336';
      default:
        return '#757575';
    }
  }

  scrollToSection(sectionId: string): void {
    this.categoryNavExpanded = false;
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 140;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  }

  toggleCategoryNav(): void {
    this.categoryNavExpanded = !this.categoryNavExpanded;
  }
}