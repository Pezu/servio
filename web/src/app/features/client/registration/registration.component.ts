import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { environment } from '../../../../environments/environment';

interface MenuItem {
  id: string;
  name: string;
  orderable: boolean;
  price?: number;
  imagePath?: string;
  description?: string;
  allergenIds?: string[];
  children: MenuItem[];
}

interface Allergen {
  id: string;
  number: number;
  name: string;
  active: boolean;
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
  paid?: boolean;
}

interface ApiOrder {
  id: string;
  orderNo: number;
  status: string;
  note?: string;
  nickname?: string;
  needsPayment?: boolean;
  registrationId?: string;
  items: ApiOrderItem[];
}

interface GuestOrders {
  nickname: string;
  registrationId: string;
  orders: ApiOrder[];
  total: number;
}

interface EventData {
  id: string;
  name: string;
  logoPath?: string;
}

interface PendingTeamRegistration {
  id: string;
  orderPointId: string;
  orderPointName: string;
  validationStatus: string;
  createdAt: string;
  nickname?: string;
}

interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  prefix: string;
  phone: string;
  email?: string;
}

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  activeView: 'menu' | 'orders' | 'checkout' | 'team' | 'waiting' | 'nickname' | 'login' | 'payments' | 'customerInfo' = 'menu';
  orderPointPayLater: boolean = false;
  orderPointMenuId: string | null = null;
  categoryNavExpanded: boolean = false;

  // Customer info form (for non-payLater order points)
  customerFirstName: string = '';
  customerLastName: string = '';
  customerCountryCode: string = '+40';
  customerPhoneNumber: string = '';
  countryCodes: { code: string; name: string; flag: string }[] = [
    { code: '+40', name: 'Romania', flag: '🇷🇴' },
    { code: '+1', name: 'USA', flag: '🇺🇸' },
    { code: '+44', name: 'UK', flag: '🇬🇧' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+43', name: 'Austria', flag: '🇦🇹' },
    { code: '+36', name: 'Hungary', flag: '🇭🇺' },
    { code: '+359', name: 'Bulgaria', flag: '🇧🇬' },
    { code: '+373', name: 'Moldova', flag: '🇲🇩' },
    { code: '+380', name: 'Ukraine', flag: '🇺🇦' },
  ];

  // Validation polling
  private validationPollInterval: any = null;

  // Menu
  menuItems: MenuItem[] = [];
  allergens: Allergen[] = [];
  loadingMenu: boolean = false;
  quantities: Map<string, number> = new Map();
  placingOrder: boolean = false;
  orderStatus: string = '';

  // Orders
  orders: ApiOrder[] = [];
  orderPointOrders: ApiOrder[] = []; // All orders at the order point (for payLater)
  loadingOrders: boolean = false;
  ordersGroupMode: 'table' | 'guest' = 'table';
  ordersViewMode: 'total' | 'order' = 'total';

  // Event data
  eventData: EventData | null = null;

  // WebSocket (for team/orderpoint features only)
  private stompClient: Client | null = null;
  connected: boolean = false;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  // Toast
  showingToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';

  // Payment choice dialog
  showPaymentChoice: boolean = false;
  nickname: string = '';
  processingPayment: boolean = false;

  // Checkout confirmation
  orderConfirmed: boolean = false;

  // Flag to continue order after customer info is submitted
  pendingOrderAfterCustomerInfo: boolean = false;

  // Item pending to add after registration (for non-payLater deferred registration)
  pendingItemToAdd: MenuItem | null = null;

  // Tip modal
  showTipModal: boolean = false;
  tipOrderAmount: number = 0;
  selectedTipPercent: number = 0;
  customTipAmount: number = 0;
  pendingTipPaymentType: 'order' | 'guest' | 'orderpoint' | null = null;
  pendingTipPaymentId: string | null = null;
  pendingTipGuest: GuestOrders | null = null;

  // Team
  teamPendingRegistrations: PendingTeamRegistration[] = [];
  loadingTeam: boolean = false;
  approvedMembers: string[] = [];

  // Order categories collapse state (delivered collapsed by default)
  orderCategoryExpanded = {
    ready: true,
    inProgress: true,
    ordered: true,
    delivered: false
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Ensure activeView is menu at start
    this.activeView = 'menu';
    console.log('[Init] Starting, activeView:', this.activeView);

    this.route.params.subscribe(params => {
      this.eventId = params['eventId'];
      this.orderPointId = params['orderPointId'];
      console.log('[Init] In route subscribe, activeView:', this.activeView);

      const existingRegistration = this.getCookie('registrationResponse');
      const storedEventId = this.getCookie('eventId');

      console.log('[Init] Route params:', { eventId: this.eventId, orderPointId: this.orderPointId });
      console.log('[Init] Cookies:', {
        hasRegistration: !!existingRegistration,
        storedEventId,
        eventIdMatch: storedEventId === this.eventId
      });

      // Use existing registration only if we have both the registration AND a matching eventId AND matching orderPointId
      const storedOrderPointId = this.getCookie('orderPointId');
      const orderPointMatches = storedOrderPointId === this.orderPointId;

      console.log('[Init] Stored orderPointId:', storedOrderPointId);
      console.log('[Init] Current orderPointId:', this.orderPointId);
      console.log('[Init] Order points match:', orderPointMatches);

      if (existingRegistration && storedEventId === this.eventId && orderPointMatches) {
        this.registrationResponse = JSON.parse(existingRegistration);
        console.log('[Init] Using existing registration:', this.registrationResponse?.id);

        // Fetch order point info to get menuId before loading menu
        if (this.orderPointId) {
          this.http.get<any>(`${environment.apiUrl}/api/register/order-points/${this.orderPointId}/info`)
            .subscribe({
              next: (orderPoint) => {
                this.orderPointMenuId = orderPoint.menuId || null;
                console.log('[Init] Order point info loaded, menuId:', this.orderPointMenuId);
                this.loadMenuItems();
              },
              error: () => {
                // Fall back to event menu if order point info fails
                this.loadMenuItems();
              }
            });
        } else {
          this.loadMenuItems();
        }

        // Re-check validation status from server (in case it was approved)
        this.http.get<any>(`${environment.apiUrl}/api/register/${this.registrationResponse.id}`)
          .subscribe({
            next: (registration) => {
              this.registrationResponse = registration;
              this.orderPointPayLater = registration.orderPointPayLater || false;
              this.setCookie('registrationResponse', JSON.stringify(registration), 7);
              console.log('[Init] Registration loaded, validationStatus:', registration.validationStatus, 'orderPointPayLater:', this.orderPointPayLater);

              if (registration.validationStatus === 'PENDING') {
                this.activeView = 'waiting';
                this.loadApprovedMembers();
                this.startValidationPolling();
              } else {
                this.activeView = 'menu';
                this.loadOrders();
                // Connect WebSocket and load pending registrations for real-time badge updates
                if (this.orderPointPayLater && this.orderPointId) {
                  this.connectWebSocket();
                  this.loadTeamPendingRegistrations();
                }
              }
            },
            error: (err) => {
              console.error('Error checking registration status:', err);
              // Registration might not exist anymore, create new one
              this.clearAllCookies();
              this.checkOrderPointAndRegister();
            }
          });
      } else {
        // Different event, different order point, or no registration - clear and start fresh
        console.log('[Init] Creating new registration (no match or missing data)');
        this.clearAllCookies();
        this.checkOrderPointAndRegister();
      }

      this.loadAllergens();
      this.loadEventData();
      this.checkPaymentResult();
    });
  }

  private checkPaymentResult(): void {
    const paymentSuccess = localStorage.getItem('paymentSuccess');
    const paymentError = localStorage.getItem('paymentError');
    const confirmedOrderId = localStorage.getItem('confirmedOrderId');
    const tableOrderPayment = localStorage.getItem('tableOrderPayment');

    console.log('[Payment] Checking payment result:', {
      paymentSuccess,
      paymentError,
      confirmedOrderId,
      tableOrderPayment,
      hasRegistration: !!this.registrationResponse,
      registrationId: this.registrationResponse?.id
    });

    if (paymentSuccess) {
      localStorage.removeItem('paymentSuccess');
      localStorage.removeItem('tableOrderPayment');

      // Check if this was a table order payment
      if (tableOrderPayment === 'true') {
        console.log('[Payment] Table order payment processing, showing orders view');
        this.activeView = 'orders';
        this.showToast('Order placed! Payment is being processed.', 'success');
        this.loadOrders();
        return;
      }

      // Clear the confirmed order ID and show success
      if (confirmedOrderId) {
        console.log('[Payment] Order confirmed:', confirmedOrderId);
        localStorage.removeItem('confirmedOrderId');
        this.showToast('Order placed! Payment is being processed.', 'success');
        this.loadOrders();
      }
    } else if (paymentError) {
      localStorage.removeItem('paymentError');
      localStorage.removeItem('confirmedOrderId');
      localStorage.removeItem('tableOrderPayment');
      this.showToast('There was an issue processing your order. Please try again.', 'error');
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
    this.deleteCookie('eventId');
    this.deleteCookie('activeOrders'); // Clean up legacy data when switching order points
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
    this.stopValidationPolling();
    this.removeWakeUpListeners();
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
    const needsConnection = this.activeView === 'team' ||
                           (this.activeView === 'orders' && this.orderPointPayLater);
    if (needsConnection) {
      // Force disconnect and reconnect to ensure fresh connection
      if (this.stompClient) {
        console.log('[WebSocket] Forcing reconnection...');
        this.stompClient.deactivate();
        this.stompClient = null;
        this.connected = false;
      }
      // Small delay before reconnecting
      setTimeout(() => {
        this.connectWebSocket();
      }, 500);
    }
  }

  private stopValidationPolling(): void {
    if (this.validationPollInterval) {
      clearInterval(this.validationPollInterval);
      this.validationPollInterval = null;
    }
  }

  private startValidationPolling(): void {
    this.stopValidationPolling();
    this.validationPollInterval = setInterval(() => {
      this.checkValidationStatus();
    }, 3000); // Poll every 3 seconds
  }

  private checkValidationStatus(): void {
    if (!this.registrationResponse?.id) return;

    this.http.get<any>(`${environment.apiUrl}/api/register/${this.registrationResponse.id}`)
      .subscribe({
        next: (registration) => {
          if (registration.validationStatus === 'APPROVED') {
            this.stopValidationPolling();
            this.registrationResponse = registration;
            this.orderPointPayLater = registration.orderPointPayLater || false;
            this.setCookie('registrationResponse', JSON.stringify(registration), 7);

            // Add the pending item if exists (deferred from before approval)
            if (this.pendingItemToAdd) {
              const current = this.getQuantity(this.pendingItemToAdd.id);
              this.quantities.set(this.pendingItemToAdd.id, current + 1);
              console.log('[Validation] Added pending item after approval:', this.pendingItemToAdd.name);
              this.pendingItemToAdd = null;
            }

            this.activeView = 'menu';
          }
        },
        error: (err) => {
          console.error('Error checking validation status:', err);
        }
      });
  }

  // Navigation
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  navigateTo(view: 'menu' | 'orders' | 'team' | 'login' | 'payments'): void {
    console.log('[Nav] navigateTo called with:', view, 'stack:', new Error().stack);
    this.activeView = view;
    this.closeMenu();
    if (view === 'orders') {
      this.loadOrders();
      // Ensure WebSocket is connected for real-time table order updates
      if (this.orderPointPayLater) {
        this.connectWebSocket();
      }
    } else if (view === 'team') {
      this.loadTeamPendingRegistrations();
      // Ensure WebSocket is connected for real-time updates
      this.connectWebSocket();
    }
  }

  checkOrderPointAndRegister(retryCount: number = 0): void {
    console.log('[CheckOP] Starting, orderPointId:', this.orderPointId, 'retry:', retryCount);
    if (!this.orderPointId) {
      console.log('[CheckOP] No orderPointId, registering directly');
      this.registerToEvent();
      return;
    }

    this.loading = true;
    console.log('[CheckOP] Fetching order point info...');
    this.http.get<any>(`${environment.apiUrl}/api/register/order-points/${this.orderPointId}/info`)
      .subscribe({
        next: (orderPoint) => {
          console.log('[CheckOP] Order point info received:', orderPoint);
          this.orderPointPayLater = orderPoint.payLater;
          this.orderPointMenuId = orderPoint.menuId || null;
          this.loading = false;

          // Load menu items now that we have the order point info
          this.loadMenuItems();

          // Show menu directly for all order points, registration happens when adding items
          console.log('[CheckOP] Showing menu (registration deferred until adding items)');
          this.activeView = 'menu';
          console.log('[CheckOP] activeView is now:', this.activeView);
        },
        error: (err) => {
          console.error('[CheckOP] Error fetching order point info:', err, 'retry:', retryCount);
          // Retry up to 2 times with increasing delay (helps with iOS first-load issues)
          if (retryCount < 2) {
            const delay = (retryCount + 1) * 500;
            console.log(`[CheckOP] Retrying in ${delay}ms...`);
            setTimeout(() => this.checkOrderPointAndRegister(retryCount + 1), delay);
          } else {
            // Fall back to normal registration after retries exhausted
            console.error('[CheckOP] All retries failed, falling back to direct registration');
            this.loading = false;
            this.registerToEvent();
          }
        }
      });
  }

  submitNickname(): void {
    this.registerToEvent();
  }

  // Customer methods
  private getStoredCustomerId(): string | null {
    return this.getCookie('customerId');
  }

  private saveCustomerId(customerId: string): void {
    this.setCookie('customerId', customerId, 365);
  }

  private loadCustomerInfoToForm(): void {
    const customerId = this.getStoredCustomerId();
    if (customerId) {
      // Fetch customer data from backend
      this.http.get<CustomerData>(`${environment.apiUrl}/api/customers/${customerId}`)
        .subscribe({
          next: (customer) => {
            this.customerFirstName = customer.firstName;
            this.customerLastName = customer.lastName;
            this.customerCountryCode = customer.prefix;
            this.customerPhoneNumber = customer.phone;
          },
          error: (err) => {
            console.error('[Customer] Error fetching customer:', err);
            // Customer might not exist anymore, clear the stored ID
            this.deleteCookie('customerId');
          }
        });
    }
  }

  isCustomerInfoValid(): boolean {
    return this.customerFirstName.trim().length > 0 &&
           this.customerLastName.trim().length > 0 &&
           this.customerPhoneNumber.trim().length >= 6;
  }

  cancelCustomerInfo(): void {
    this.pendingItemToAdd = null;
    this.pendingOrderAfterCustomerInfo = false;
    this.activeView = 'menu';
  }

  private createOrFindCustomer(): Promise<CustomerData> {
    return new Promise((resolve, reject) => {
      const body = {
        firstName: this.customerFirstName.trim(),
        lastName: this.customerLastName.trim(),
        prefix: this.customerCountryCode,
        phone: this.customerPhoneNumber.trim()
      };
      this.http.post<CustomerData>(`${environment.apiUrl}/api/customers`, body)
        .subscribe({
          next: (customer) => {
            this.saveCustomerId(customer.id);
            resolve(customer);
          },
          error: (err) => reject(err)
        });
    });
  }

  submitCustomerInfo(): void {
    if (!this.isCustomerInfoValid()) return;

    // Set nickname as firstName + lastName for display purposes
    this.nickname = `${this.customerFirstName.trim()} ${this.customerLastName.trim()}`;

    // Create or find customer first, then proceed with the flow
    this.createOrFindCustomer().then((customer) => {
      console.log('[CustomerInfo] Created/found customer:', customer.id);

      // Check if we have a pending item to add (deferred registration for non-payLater)
      if (this.pendingItemToAdd) {
        const itemToAdd = this.pendingItemToAdd;
        this.pendingItemToAdd = null;

        // Register first, then add the item
        this.registerToEventAndThen(() => {
          // Add the pending item after successful registration
          const current = this.getQuantity(itemToAdd.id);
          this.quantities.set(itemToAdd.id, current + 1);
          console.log('[CustomerInfo] Added pending item after registration:', itemToAdd.name);
          this.activeView = 'menu';
        });
        return;
      }

      // Check if we need to continue with an order
      if (this.pendingOrderAfterCustomerInfo) {
        this.pendingOrderAfterCustomerInfo = false;

        if (this.registrationResponse?.id) {
          // Registration exists - update it with customer info
          const body = {
            firstName: this.customerFirstName.trim(),
            lastName: this.customerLastName.trim(),
            prefix: this.customerCountryCode,
            phone: this.customerPhoneNumber.trim(),
            email: null
          };
          this.http.post<any>(`${environment.apiUrl}/api/register/${this.registrationResponse.id}/customer`, body)
            .subscribe({
              next: (response) => {
                console.log('[CustomerInfo] Updated registration with customer:', response.customerId);
                this.registrationResponse = response;
                this.setCookie('registrationResponse', JSON.stringify(response), 7);
                this.activeView = 'checkout';
                this.placeOrder();
              },
              error: (err) => {
                console.error('[CustomerInfo] Error updating registration with customer:', err);
                // Continue with order anyway
                this.activeView = 'checkout';
                this.placeOrder();
              }
            });
          return;
        } else {
          // No registration yet - create one then place order
          this.registerToEventAndThen(() => {
            this.activeView = 'checkout';
            this.placeOrder();
          });
          return;
        }
      } else {
        // Normal registration flow (for payLater nickname submission)
        this.registerToEvent();
      }
    }).catch((err) => {
      console.error('[CustomerInfo] Error creating customer:', err);
      this.showToast('Failed to save customer info. Please try again.', 'error');
    });
  }

  private registerToEventAndThen(callback: () => void): void {
    this.loading = true;
    this.error = '';

    const customerId = this.getStoredCustomerId();
    if (!customerId) {
      this.error = 'Customer info is required';
      this.loading = false;
      return;
    }

    const url = `${environment.apiUrl}/api/register/events/${this.eventId}/with-customer`;
    const body = {
      orderPointId: this.orderPointId || null,
      nickname: this.nickname?.trim() || null,
      customerId: customerId
    };

    console.log('[Register] Creating/finding registration with customerId:', body);
    this.http.post<any>(url, body).subscribe({
      next: (response) => {
        console.log('[Register] Registration response:', response);
        this.registrationResponse = response;
        this.orderPointPayLater = response.orderPointPayLater || false;
        this.setCookie('registrationResponse', JSON.stringify(response), 7);
        this.setCookie('orderPointId', this.orderPointId, 7);
        this.setCookie('eventId', this.eventId, 7);
        this.loading = false;

        // Check if validation is pending (for payLater order points)
        if (response.validationStatus === 'PENDING') {
          console.log('[Register] Status is PENDING, showing waiting view');
          this.activeView = 'waiting';
          this.loadApprovedMembers();
          this.startValidationPolling();
          // pendingItemToAdd is already set, will be added after approval
        } else {
          callback();
        }
      },
      error: (err) => {
        console.error('[Register] Error:', err);
        this.error = 'Failed to register. Please try again.';
        this.loading = false;
      }
    });
  }

  registerToEvent(retryCount: number = 0): void {
    this.loading = true;
    this.error = '';

    // Check if we have customerId to include
    const customerId = this.getStoredCustomerId();

    let request$;

    if (customerId) {
      // Use the new endpoint with customerId
      const url = `${environment.apiUrl}/api/register/events/${this.eventId}/with-customer`;
      const body = {
        orderPointId: this.orderPointId || null,
        nickname: this.nickname?.trim() || null,
        customerId: customerId
      };
      console.log('[Register] Creating registration with customerId, URL:', url, 'retry:', retryCount);
      console.log('[Register] Request body:', body);
      request$ = this.http.post<any>(url, body);
    } else {
      // Use the original endpoint with query params
      let url = `${environment.apiUrl}/api/register/events/${this.eventId}`;
      const params: string[] = [];

      if (this.orderPointId) {
        params.push(`orderPointId=${this.orderPointId}`);
      }
      if (this.nickname && this.nickname.trim()) {
        params.push(`nickname=${encodeURIComponent(this.nickname.trim())}`);
      }
      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      console.log('[Register] Creating registration with URL:', url, 'retry:', retryCount);
      console.log('[Register] Nickname being sent:', this.nickname);
      request$ = this.http.post<any>(url, {});
    }

    request$.subscribe({
      next: (response) => {
        console.log('[Register] Response:', response);
        console.log('[Register] validationStatus:', response.validationStatus);
        this.registrationResponse = response;
        this.orderPointPayLater = response.orderPointPayLater || false;
        this.setCookie('registrationResponse', JSON.stringify(response), 7);
        this.setCookie('orderPointId', this.orderPointId, 7);
        this.setCookie('eventId', this.eventId, 7);
        this.loading = false;

        // Check if validation is pending
        if (response.validationStatus === 'PENDING') {
          console.log('[Register] Status is PENDING, showing waiting view');
          this.activeView = 'waiting';
          this.loadApprovedMembers();
          this.startValidationPolling();
        } else {
          console.log('[Register] Status is not PENDING, showing menu');
          this.activeView = 'menu';
          this.loadOrders();
          // Connect WebSocket and load pending registrations for real-time badge updates
          if (this.orderPointPayLater && this.orderPointId) {
            this.connectWebSocket();
            this.loadTeamPendingRegistrations();
          }
        }
      },
      error: (err) => {
        console.error('[Register] Error:', err, 'retry:', retryCount);
        // Retry up to 2 times with increasing delay (helps with iOS first-load issues)
        if (retryCount < 2) {
          const delay = (retryCount + 1) * 500;
          console.log(`[Register] Retrying in ${delay}ms...`);
          setTimeout(() => this.registerToEvent(retryCount + 1), delay);
        } else {
          this.error = 'Failed to register. Please try again.';
          this.loading = false;
        }
      }
    });
  }

  // Menu methods
  loadMenuItems(): void {
    this.loadingMenu = true;

    // If order point has a specific menu assigned, try to load that menu first
    if (this.orderPointMenuId) {
      const menuUrl = `${environment.apiUrl}/api/menu/menus/${this.orderPointMenuId}/tree`;
      console.log('[Menu] Loading menu by menuId:', this.orderPointMenuId);

      this.http.get<MenuItem[]>(menuUrl)
        .subscribe({
          next: (items) => {
            if (items && items.length > 0) {
              console.log('[Menu] Loaded menu items by menuId:', items.length);
              this.menuItems = items;
              this.loadingMenu = false;
            } else {
              // Menu exists but has no items, fall back to event menu
              console.log('[Menu] Menu by menuId is empty, falling back to event menu');
              this.loadEventMenu();
            }
          },
          error: (err) => {
            console.error('[Menu] Error loading menu by menuId, falling back to event menu:', err);
            this.loadEventMenu();
          }
        });
    } else {
      // No specific menu assigned, load event's default menu
      this.loadEventMenu();
    }
  }

  private loadEventMenu(): void {
    const eventMenuUrl = `${environment.apiUrl}/api/events/${this.eventId}/menu`;
    console.log('[Menu] Loading event menu');

    this.http.get<MenuItem[]>(eventMenuUrl)
      .subscribe({
        next: (items) => {
          console.log('[Menu] Loaded event menu items:', items.length);
          this.menuItems = items;
          this.loadingMenu = false;
        },
        error: (err) => {
          console.error('[Menu] Error loading event menu:', err);
          this.loadingMenu = false;
        }
      });
  }

  loadAllergens(): void {
    this.http.get<Allergen[]>(`${environment.apiUrl}/api/allergens/active`)
      .subscribe({
        next: (allergens) => {
          this.allergens = allergens;
        },
        error: (err) => {
          console.error('Error loading allergens:', err);
        }
      });
  }

  getAllergenNames(allergenIds: string[]): string {
    if (!allergenIds?.length) return '';
    return allergenIds
      .map(id => this.allergens.find(a => a.id === id))
      .filter(a => a)
      .map(a => a!.name)
      .join(', ');
  }

  getQuantity(itemId: string): number {
    return this.quantities.get(itemId) || 0;
  }

  increaseQuantity(item: MenuItem): void {
    // Require registration before adding items (for all order points)
    if (!this.registrationResponse) {
      const customerId = this.getStoredCustomerId();
      if (customerId) {
        // Customer ID exists - fetch customer data and register directly
        console.log('[Menu] No registration but customerId exists, fetching customer data');
        this.pendingItemToAdd = item;
        this.http.get<CustomerData>(`${environment.apiUrl}/api/customers/${customerId}`)
          .subscribe({
            next: (customer) => {
              this.nickname = `${customer.firstName} ${customer.lastName}`;
              this.registerToEventAndThen(() => {
                // Add the pending item after successful registration
                if (this.pendingItemToAdd) {
                  const current = this.getQuantity(this.pendingItemToAdd.id);
                  this.quantities.set(this.pendingItemToAdd.id, current + 1);
                  console.log('[Register] Added pending item after registration:', this.pendingItemToAdd.name);
                  this.pendingItemToAdd = null;
                }
                this.activeView = 'menu';
              });
            },
            error: (err) => {
              console.error('[Menu] Error fetching customer, showing form:', err);
              // Customer might not exist anymore, clear ID and show form
              this.deleteCookie('customerId');
              this.activeView = 'customerInfo';
              this.loadCustomerInfoToForm();
            }
          });
      } else {
        // No customer info - show form
        console.log('[Menu] No registration yet, showing customer info form');
        this.pendingItemToAdd = item;
        this.activeView = 'customerInfo';
        this.loadCustomerInfoToForm();
      }
      return;
    }

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
    this.orderConfirmed = false;
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

    // For non-payLater order points, require registration before ordering
    // (This is a safety check - normally registration happens when adding items)
    if (!this.orderPointPayLater && !this.registrationResponse) {
      console.log('[PlaceOrder] No registration, showing customer info form');
      this.pendingOrderAfterCustomerInfo = true;
      this.activeView = 'customerInfo';
      this.loadCustomerInfoToForm();
      return;
    }

    // Check if pay later is enabled for this order point
    if (this.registrationResponse?.orderPointPayLater) {
      this.showPaymentChoice = true;
      return;
    }

    // Otherwise proceed with normal payment flow
    this.submitOrder(false);
  }

  closePaymentChoice(): void {
    this.showPaymentChoice = false;
  }

  submitOrder(payLater: boolean): void {
    this.showPaymentChoice = false;

    const selectedItems = this.getSelectedItems();
    const registrationResponse = this.getCookie('registrationResponse');
    const orderPointId = this.getCookie('orderPointId');

    if (!registrationResponse || !orderPointId) {
      this.orderStatus = 'Error: Missing registration data';
      return;
    }

    const registration = JSON.parse(registrationResponse);
    const orderItems = selectedItems.map(item => ({
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      price: item.menuItem.price || 0,
      quantity: item.quantity
    }));

    const orderRequest = {
      registrationId: registration.id,
      orderPointId: orderPointId,
      payLater: payLater,
      orderItems: orderItems
    };

    console.log('[Order] Creating order with registrationId:', registration.id, 'payLater:', payLater);

    this.placingOrder = true;
    this.orderStatus = '';

    // First create the order
    this.http.post<any>(`${environment.apiUrl}/api/orders`, orderRequest)
      .subscribe({
        next: (orderResponse) => {
          if (payLater) {
            // Pay later: order is already ACTIVE with needsPayment flag
            // Clear cart and show success
            this.quantities.clear();
            this.placingOrder = false;
            this.activeView = 'menu';

            this.showToast('Order placed! Pay at the counter.', 'success');
            this.loadOrders();
          } else {
            // Pay now: proceed with payment
            this.setCookie('pendingOrderId', orderResponse.id, 1);
            this.setCookie('paymentEventId', this.eventId, 1);
            this.setCookie('paymentOrderPointId', this.orderPointId, 1);

            const totalAmount = this.getTotalPrice();

            // Start payment with Netopia
            const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&orderId=${orderResponse.id}`;
            this.http.post<any>(`${environment.apiUrl}/api/payments/orders/${orderResponse.id}/start`, { returnUrl }).subscribe({
              next: (paymentResponse) => {
                this.quantities.clear();

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
          }
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

    // For payLater order points, also load all orders at the order point
    console.log('[Orders] orderPointPayLater:', this.orderPointPayLater, 'orderPointId:', this.orderPointId);
    if (this.orderPointPayLater && this.orderPointId) {
      this.loadOrderPointOrders();
    }
  }

  loadOrderPointOrders(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    console.log('[Orders] Loading order point orders for:', this.orderPointId);
    this.http.get<ApiOrder[]>(`${environment.apiUrl}/api/orders/order-points/${this.orderPointId}?registrationId=${this.registrationResponse.id}`)
      .subscribe({
        next: (orders) => {
          console.log('[Orders] Loaded order point orders:', orders.length);
          this.orderPointOrders = orders;
        },
        error: (err) => {
          console.error('Error loading order point orders:', err);
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

  getInProgressOrdersCount(): number {
    return this.orders.filter(order =>
      order.status === 'ACTIVE' || order.status === 'IN_PROGRESS' || order.status === 'READY'
    ).length;
  }

  getFirstInProgressOrderColor(): string {
    const inProgressOrders = this.orders.filter(order =>
      order.status === 'ACTIVE' || order.status === 'IN_PROGRESS' || order.status === 'READY'
    );
    if (inProgressOrders.length === 0) return '#757575';

    // Find the oldest order (lowest orderNo = first created)
    const oldestOrder = inProgressOrders.reduce((oldest, current) =>
      current.orderNo < oldest.orderNo ? current : oldest
    );
    return this.getStatusColor(oldestOrder.status);
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

  getOrdersByStatus(status: string): ApiOrder[] {
    return this.orders.filter(order => order.status === status);
  }

  // Orders by status for the new Orders view
  getOrderedOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'ACTIVE');
  }

  getInProgressOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'IN_PROGRESS');
  }

  getReadyOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'READY');
  }

  getDeliveredOrders(): ApiOrder[] {
    return this.orders.filter(order => order.status === 'DELIVERED');
  }

  toggleOrderCategory(category: 'ready' | 'inProgress' | 'ordered' | 'delivered'): void {
    this.orderCategoryExpanded[category] = !this.orderCategoryExpanded[category];
  }

  // Order point orders methods (for payLater)
  setOrdersGroupMode(mode: 'table' | 'guest'): void {
    this.ordersGroupMode = mode;
  }

  setOrdersViewMode(mode: 'total' | 'order'): void {
    this.ordersViewMode = mode;
  }

  getOrderPointOrdersTotal(): number {
    return this.orderPointOrders.reduce((total, order) => total + this.getOrderTotal(order), 0);
  }

  getAggregatedOrderItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number }[] {
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

  // Aggregates only active (non-paid, non-cancelled) items for total view
  getAggregatedActiveItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number }[] {
    const itemMap = new Map<string, { quantity: number; totalPrice: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        // Only include non-paid, non-cancelled items
        if (item.paid || item.status === 'CANCELLED') {
          continue;
        }
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

  getOrderPointOrdersByGuest(): GuestOrders[] {
    const groups = new Map<string, { nickname: string; registrationId: string; orders: ApiOrder[] }>();

    for (const order of this.orderPointOrders) {
      const registrationId = order.registrationId || 'unknown';
      if (!groups.has(registrationId)) {
        groups.set(registrationId, {
          nickname: order.nickname || 'Unknown',
          registrationId: registrationId,
          orders: []
        });
      }
      groups.get(registrationId)!.orders.push(order);
    }

    return Array.from(groups.values()).map(group => ({
      nickname: group.nickname,
      registrationId: group.registrationId,
      orders: group.orders,
      total: group.orders.reduce((sum, o) => sum + this.getOrderTotal(o), 0)
    }));
  }

  // Payment methods for order point orders
  getOrderUnpaidTotal(order: ApiOrder): number {
    return order.items
      .filter(item => !item.paid && item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  hasUnpaidItems(order: ApiOrder): boolean {
    return order.items.some(item => !item.paid && item.status !== 'CANCELLED');
  }

  getActiveItems(order: ApiOrder): ApiOrderItem[] {
    return order.items.filter(item => !item.paid && item.status !== 'CANCELLED');
  }

  getOrdersWithUnpaidItems(): ApiOrder[] {
    return this.orderPointOrders.filter(o => this.hasUnpaidItems(o));
  }

  getUnpaidOrderPointTotal(): number {
    return this.orderPointOrders.reduce((sum, o) => sum + this.getOrderUnpaidTotal(o), 0);
  }

  getGuestOrdersWithUnpaidItems(guest: GuestOrders): ApiOrder[] {
    return guest.orders.filter(o => this.hasUnpaidItems(o));
  }

  getGuestUnpaidTotal(guest: GuestOrders): number {
    return guest.orders.reduce((sum, o) => sum + this.getOrderUnpaidTotal(o), 0);
  }

  hasAnyUnpaidItems(): boolean {
    return this.orderPointOrders.some(o => this.hasUnpaidItems(o));
  }

  guestHasUnpaidItems(guest: GuestOrders): boolean {
    return guest.orders.some(o => this.hasUnpaidItems(o));
  }

  payOrder(order: ApiOrder): void {
    if (this.processingPayment) return;

    // Show tip modal first
    this.tipOrderAmount = this.getOrderUnpaidTotal(order);
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'order';
    this.pendingTipPaymentId = order.id;
    this.pendingTipGuest = null;
    this.showTipModal = true;
  }

  private executeOrderPayment(orderId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=order`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/orders/${orderId}/start`, { returnUrl, tip }).subscribe({
      next: (paymentResponse) => {
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  payAllOrders(): void {
    if (this.processingPayment) return;
    if (!this.hasAnyUnpaidItems()) return;

    // Show tip modal first
    this.tipOrderAmount = this.getUnpaidOrderPointTotal();
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'orderpoint';
    this.pendingTipPaymentId = this.orderPointId;
    this.pendingTipGuest = null;
    this.showTipModal = true;
  }

  private executeOrderPointPayment(orderPointId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=orderpoint`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/order-points/${orderPointId}/start`, { returnUrl, tip }).subscribe({
      next: (paymentResponse) => {
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  payGuestOrders(guest: GuestOrders): void {
    if (this.processingPayment) return;
    if (!this.guestHasUnpaidItems(guest)) return;

    // Show tip modal first
    this.tipOrderAmount = this.getGuestUnpaidTotal(guest);
    this.selectedTipPercent = 0;
    this.customTipAmount = 0;
    this.pendingTipPaymentType = 'guest';
    this.pendingTipPaymentId = guest.registrationId;
    this.pendingTipGuest = guest;
    this.showTipModal = true;
  }

  private executeGuestPayment(registrationId: string, tip: number): void {
    this.processingPayment = true;

    // Store payment info for redirect back
    this.setCookie('paymentEventId', this.eventId, 1);
    this.setCookie('paymentOrderPointId', this.orderPointId, 1);
    localStorage.setItem('tableOrderPayment', 'true');

    const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&type=guest`;
    this.http.post<any>(`${environment.apiUrl}/api/payments/registrations/${registrationId}/start`, { returnUrl, tip }).subscribe({
      next: (paymentResponse) => {
        console.log('[Payment] Guest payment response:', paymentResponse);
        if (paymentResponse.payment?.paymentURL) {
          // Store the payment reference for completion after redirect
          console.log('[Payment] Storing reference:', paymentResponse.reference);
          this.setCookie('pendingPaymentReference', paymentResponse.reference, 1);
          console.log('[Payment] Stored pendingPaymentReference:', localStorage.getItem('pendingPaymentReference'));
          window.location.href = paymentResponse.payment.paymentURL;
        } else {
          this.showToast('Payment URL not received', 'error');
          this.processingPayment = false;
        }
      },
      error: (err) => {
        console.error('Payment error:', err);
        this.showToast('Failed to start payment', 'error');
        this.processingPayment = false;
        this.showTipModal = false;
      }
    });
  }

  // Tip modal methods
  selectTipPercent(percent: number): void {
    this.selectedTipPercent = percent;
    if (percent !== -1) {
      this.customTipAmount = 0;
    }
  }

  getTipAmount(): number {
    if (this.selectedTipPercent === -1) {
      return this.customTipAmount || 0;
    }
    return (this.tipOrderAmount * this.selectedTipPercent) / 100;
  }

  getTipTotal(): number {
    return this.tipOrderAmount + this.getTipAmount();
  }

  isTipValid(): boolean {
    if (this.selectedTipPercent === -1) {
      return this.customTipAmount >= 0;
    }
    return true;
  }

  closeTipModal(): void {
    this.showTipModal = false;
    this.pendingTipPaymentType = null;
    this.pendingTipPaymentId = null;
    this.pendingTipGuest = null;
  }

  confirmTipAndPay(): void {
    if (!this.isTipValid()) return;

    const tip = this.getTipAmount();
    // Keep modal open and show processing state until redirect
    this.processingPayment = true;

    switch (this.pendingTipPaymentType) {
      case 'order':
        if (this.pendingTipPaymentId) {
          this.executeOrderPayment(this.pendingTipPaymentId, tip);
        }
        break;
      case 'guest':
        if (this.pendingTipPaymentId) {
          this.executeGuestPayment(this.pendingTipPaymentId, tip);
        }
        break;
      case 'orderpoint':
        if (this.pendingTipPaymentId) {
          this.executeOrderPointPayment(this.pendingTipPaymentId, tip);
        }
        break;
    }
    // Don't close modal - page will redirect to Netopia
  }

  // Team methods
  loadTeamPendingRegistrations(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    this.loadingTeam = true;
    this.http.get<PendingTeamRegistration[]>(
      `${environment.apiUrl}/api/register/order-points/${this.orderPointId}/pending?excludeRegistrationId=${this.registrationResponse.id}`
    ).subscribe({
      next: (registrations) => {
        this.teamPendingRegistrations = registrations;
        this.loadingTeam = false;
      },
      error: (err) => {
        console.error('Error loading team pending registrations:', err);
        this.loadingTeam = false;
      }
    });
  }

  loadApprovedMembers(): void {
    if (!this.orderPointId || !this.registrationResponse?.id) return;

    this.http.get<any[]>(
      `${environment.apiUrl}/api/register/order-points/${this.orderPointId}/approved?excludeRegistrationId=${this.registrationResponse.id}`
    ).subscribe({
      next: (registrations) => {
        this.approvedMembers = registrations
          .map(r => r.nickname)
          .filter((name: string | null) => name && name.trim() !== '');
      },
      error: (err) => {
        console.error('Error loading approved members:', err);
      }
    });
  }

  approveTeamRegistration(registrationId: string): void {
    if (!this.registrationResponse?.id) return;

    this.http.post<PendingTeamRegistration>(
      `${environment.apiUrl}/api/register/${registrationId}/approve-by-client?approverRegistrationId=${this.registrationResponse.id}`,
      {}
    ).subscribe({
      next: () => {
        this.showToast('Registration approved!', 'success');
        this.loadTeamPendingRegistrations();
      },
      error: (err) => {
        console.error('Error approving registration:', err);
        this.showToast('Failed to approve registration', 'error');
      }
    });
  }

  // Login methods
  loginWithFacebook(): void {
    console.log('Login with Facebook clicked');
    // TODO: Implement Facebook OAuth login
    this.showToast('Facebook login coming soon', 'success');
  }

  loginWithGoogle(): void {
    console.log('Login with Google clicked');
    // TODO: Implement Google OAuth login
    this.showToast('Google login coming soon', 'success');
  }

  // Storage methods (using localStorage instead of cookies for better iOS support)
  getCookie(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  }

  setCookie(name: string, value: string, days: number): void {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  deleteCookie(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  }

  // WebSocket methods (for team/orderpoint features only)
  private connectWebSocket(): void {
    if (this.stompClient?.active) {
      console.log('[WebSocket] Already connected');
      return;
    }
    if (!this.orderPointId) {
      console.log('[WebSocket] No order point ID, skipping WebSocket connection');
      return;
    }

    console.log('[WebSocket] Connecting for orderpoint:', this.orderPointId);

    // Setup wake-up listeners if not already done
    if (!this.visibilityHandler) {
      this.setupWakeUpListeners();
    }

    this.stompClient = new Client({
      webSocketFactory: () => new (SockJS as any)(`${environment.apiUrl}/ws`),
      // Heartbeat: send every 10s, expect every 10s
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Auto reconnect with increasing delay (1s, 2s, 4s... max 30s)
      reconnectDelay: 2000,
      onConnect: () => {
        this.connected = true;

        // Subscribe to order point registration updates (for team page)
        if (this.orderPointId) {
          console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/registrations');
          this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/registrations`, (message) => {
            console.log('[WebSocket] Received registration update:', message.body);
            const data = JSON.parse(message.body);
            if (data.type === 'REGISTRATION_APPROVED') {
              // Remove the approved registration from the team pending list
              this.teamPendingRegistrations = this.teamPendingRegistrations.filter(r => r.id !== data.registrationId);
            }
          });

          // Subscribe to validation requests (when someone new needs approval)
          console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/validation-requests');
          this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/validation-requests`, (message) => {
            console.log('[WebSocket] Received validation request:', message.body);
            const data = JSON.parse(message.body);
            if (data.type === 'VALIDATION_REQUESTED' && data.registrationId !== this.registrationResponse?.id) {
              // Add the new pending registration to the list (use spread to trigger change detection)
              const newRegistration: PendingTeamRegistration = {
                id: data.registrationId,
                orderPointId: data.orderPointId || this.orderPointId,
                orderPointName: data.orderPointName || '',
                validationStatus: 'PENDING',
                createdAt: new Date().toISOString(),
                nickname: data.nickname
              };
              // Check if not already in the list
              if (!this.teamPendingRegistrations.find(r => r.id === data.registrationId)) {
                this.teamPendingRegistrations = [...this.teamPendingRegistrations, newRegistration];
              }
            }
          });

          // Subscribe to order updates for real-time table orders (order point specific)
          if (this.orderPointPayLater) {
            console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/orders for table order updates');
            this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/orders`, (message) => {
              console.log('[WebSocket] Received order point order update:', message.body);
              // Reload order point orders when any order update is received
              this.loadOrderPointOrders();
            });

            // Also subscribe to payment updates for this order point
            console.log('[WebSocket] Subscribing to /topic/orderpoint/' + this.orderPointId + '/payments for payment updates');
            this.stompClient?.subscribe(`/topic/orderpoint/${this.orderPointId}/payments`, (message) => {
              console.log('[WebSocket] Received payment update:', message.body);
              // Reload order point orders when payment status changes
              this.loadOrderPointOrders();
            });
          }
        }
      },
      onStompError: (error) => {
        console.error('[WebSocket] STOMP error:', error);
        this.connected = false;
      },
      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
      },
      onWebSocketClose: () => {
        console.log('[WebSocket] Connection closed');
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

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
}