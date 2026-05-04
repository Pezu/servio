import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Client } from '@stomp/stompjs';
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

interface CachedGuestOrders extends GuestOrders {
  aggregatedItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[];
  unpaidItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[];
  paidItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[];
  unpaidTotal: number;
  paidTotal: number;
}

interface EventData {
  id: string;
  name: string;
  logoPath?: string;
  requireValidation?: boolean;
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
  activeView: 'menu' | 'orders' | 'checkout' | 'team' | 'waiting' | 'nickname' | 'login' | 'payments' | 'customerInfo' | 'tableSelection' = 'menu';
  orderPointPayLater: boolean = false;
  orderPointMenuId: string | null = null;

  // Table selection (for pay-later order points whose name is M{n}.{m} with multiple siblings)
  tableSelectionOptions: { id: string; name: string }[] = [];
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

  // Cached aggregated items (to avoid recalculating in template)
  cachedAggregatedActiveItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[] = [];
  cachedAggregatedAllItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[] = [];
  cachedPaymentsDisplayItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[] = [];
  cachedPaidItems: { name: string; quantity: number; totalPrice: number; paid: boolean }[] = [];
  cachedGuestOrders: CachedGuestOrders[] = [];
  paymentFilter: 'all' | 'paid' | 'unpaid' = 'unpaid';
  paymentFilterDropdownOpen: boolean = false;
  paymentFilterOptions: { value: 'all' | 'paid' | 'unpaid'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' }
  ];

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

  nickname: string = '';
  processingPayment: boolean = false;

  // Checkout confirmation
  orderConfirmed: boolean = false;
  checkoutItems: OrderItem[] = [];

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
    private router: Router,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.paymentFilterDropdownOpen) {
      const dropdown = this.elementRef.nativeElement.querySelector('.payment-filter-select');
      if (dropdown && !dropdown.contains(event.target)) {
        this.paymentFilterDropdownOpen = false;
      }
    }
  }

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

            // Add the deferred item from case 1a's add-to-cart trigger.
            if (this.pendingItemToAdd) {
              const current = this.getQuantity(this.pendingItemToAdd.id);
              this.quantities.set(this.pendingItemToAdd.id, current + 1);
              console.log('[Validation] Added pending item after approval:', this.pendingItemToAdd.name);
              this.pendingItemToAdd = null;
            }

            if (this.pendingOrderAfterCustomerInfo) {
              // Edge: 1b/2 hit PENDING (e.g. requireValidation flipped during
              // checkout). On approval, place the order directly so the user
              // doesn't have to press Pay again on the summary screen.
              this.pendingOrderAfterCustomerInfo = false;
              this.activeView = 'checkout';
              this.afterApproved();
              this.submitOrder(!!this.registrationResponse?.orderPointPayLater);
            } else {
              this.activeView = 'menu';
              this.afterApproved();
            }
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

          if (this.orderPointPayLater && this.isGroupedTableName(orderPoint.name)) {
            this.http.get<any[]>(`${environment.apiUrl}/api/register/order-points/${this.orderPointId}/group`)
              .subscribe({
                next: (group) => {
                  this.loading = false;
                  this.tableSelectionOptions = (group && group.length > 1)
                    ? group.map(g => ({ id: g.id, name: g.name }))
                    : [];
                  this.continueAfterOrderPointResolved();
                },
                error: () => {
                  this.loading = false;
                  this.tableSelectionOptions = [];
                  this.continueAfterOrderPointResolved();
                }
              });
          } else {
            this.loading = false;
            this.tableSelectionOptions = [];
            this.continueAfterOrderPointResolved();
          }
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

  private isGroupedTableName(name: string | null | undefined): boolean {
    return !!name && /^[A-Za-z]+\d+\.\d+$/.test(name);
  }

  private continueAfterOrderPointResolved(): void {
    // Always land on the menu after a fresh scan. For pay-later the customer
    // can browse and add items without being registered; the registration form
    // is deferred to checkout (see placeOrder). For non-pay-later, registration
    // is still required at add-to-cart time (handled in increaseQuantity).
    this.loadMenuItems();
    this.activeView = 'menu';
  }

  selectTable(option: { id: string; name: string }): void {
    this.orderPointId = option.id;
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
    const wasPlacingOrder = this.pendingOrderAfterCustomerInfo;
    this.pendingItemToAdd = null;
    this.pendingOrderAfterCustomerInfo = false;
    this.activeView = wasPlacingOrder ? 'checkout' : 'menu';
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

      if (this.pendingItemToAdd) {
        // Case 1a — came from add-to-cart on a pay-later require-validation OP.
        // Register and (on APPROVED) add the item, return to menu. Don't null
        // pendingItemToAdd before the call: when the server returns PENDING,
        // registerToEventAndThen flips to the waiting view and the polling
        // handler reads the flag to add the item on later approval.
        this.registerToEventAndThen(() => {
          if (this.pendingItemToAdd) {
            const current = this.getQuantity(this.pendingItemToAdd.id);
            this.quantities.set(this.pendingItemToAdd.id, current + 1);
            console.log('[CustomerInfo] Added pending item after registration:', this.pendingItemToAdd.name);
            this.pendingItemToAdd = null;
          }
          this.activeView = 'menu';
          this.afterApproved();
        });
        return;
      }

      if (this.pendingOrderAfterCustomerInfo) {
        // Case 1b / 2 — came from press-order on the checkout view without a
        // registration. Register and (on APPROVED) place the order directly
        // so the user doesn't have to press Pay again on the summary screen.
        this.registerToEventAndThen(() => {
          this.pendingOrderAfterCustomerInfo = false;
          this.activeView = 'checkout';
          this.afterApproved();
          this.submitOrder(!!this.registrationResponse?.orderPointPayLater);
        });
        return;
      }

      // Vestigial nickname-only fallback (no flag set) — kept for safety.
      this.registerToEvent();
    }).catch((err) => {
      console.error('[CustomerInfo] Error creating customer:', err);
      this.showToast('Failed to save customer info. Please try again.', 'error');
    });
  }

  // Side-effects to run once a registration is APPROVED and the customer can
  // place orders. Idempotent so it's safe to call from every approval site
  // (synchronous APPROVED, polling-based PENDING→APPROVED, matched-cookie
  // bootstrap, …).
  private afterApproved(): void {
    this.loadOrders();
    if (this.orderPointPayLater && this.orderPointId) {
      this.connectWebSocket();
      this.loadTeamPendingRegistrations();
    }
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
    // Case 1a only — pay-later order point + event.requireValidation=true +
    // no registration yet — must register up-front so the customer can be
    // validated before anything else. All other cases (1b, 2, or already
    // registered) just bump the cart; registration for those is deferred to
    // the press-place-order moment in the checkout view.
    const needsUpfrontRegistration =
      this.orderPointPayLater &&
      this.eventData?.requireValidation === true &&
      !this.registrationResponse;

    if (needsUpfrontRegistration) {
      console.log('[Menu] Pay-later + requireValidation, deferring add until registration');
      this.pendingItemToAdd = item;
      this.activeView = 'customerInfo';
      this.loadCustomerInfoToForm();
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
    console.log('[Checkout] Selected items:', selectedItems.length, 'menuItems:', this.menuItems.length);
    if (selectedItems.length === 0) {
      this.orderStatus = 'Please select at least one item';
      return;
    }
    this.orderStatus = '';
    this.orderConfirmed = false;
    this.checkoutItems = selectedItems;
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

    // No registration yet → show the customer-info form (sub-table picker +
    // name/phone). After submission, the server decides PENDING vs APPROVED.
    // Either way the user comes back to the checkout view to actually press
    // place-order again — we never auto-place from the registration form.
    if (!this.registrationResponse) {
      console.log('[PlaceOrder] No registration, showing customer info form');
      this.pendingOrderAfterCustomerInfo = true;
      this.activeView = 'customerInfo';
      this.loadCustomerInfoToForm();
      return;
    }

    // Pay-later order points always submit as pay-later (settled at the
    // counter). Non-pay-later goes through the Netopia flow inside submitOrder.
    this.submitOrder(!!this.registrationResponse?.orderPointPayLater);
  }

  submitOrder(payLater: boolean): void {

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

            this.showToast('Order placed', 'success');
            this.loadOrders();
          } else {
            // Pay now: proceed with payment
            this.setCookie('pendingOrderId', orderResponse.id, 1);
            this.setCookie('paymentEventId', this.eventId, 1);
            this.setCookie('paymentOrderPointId', this.orderPointId, 1);

            // Start payment with Netopia
            const returnUrl = `${window.location.origin}/payment/confirmed?eventId=${this.eventId}&orderPointId=${this.orderPointId}&orderId=${orderResponse.id}`;
            this.http.post<any>(`${environment.apiUrl}/api/payments/orders/${orderResponse.id}/start`, { returnUrl }).subscribe({
              next: (paymentResponse) => {
                if (paymentResponse.payment?.paymentURL) {
                  this.quantities.clear();
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
          this.updateCachedAggregatedItems();
        },
        error: (err) => {
          console.error('Error loading order point orders:', err);
        }
      });
  }

  // Update cached aggregated items when orderPointOrders changes
  private updateCachedAggregatedItems(): void {
    this.cachedAggregatedActiveItems = this.getAggregatedItems(this.orderPointOrders, true);
    this.cachedAggregatedAllItems = this.getAggregatedItems(this.orderPointOrders, false);
    this.cachedPaidItems = this.getPaidAggregatedItems(this.orderPointOrders);
    // Display items: show unpaid if there are unpaid items, otherwise show all
    this.cachedPaymentsDisplayItems = this.hasAnyUnpaidItems()
      ? this.cachedAggregatedActiveItems
      : this.cachedAggregatedAllItems;

    // Cache guest orders with their aggregated items
    const guestOrders = this.getOrderPointOrdersByGuest();
    this.cachedGuestOrders = guestOrders.map(guest => {
      const unpaidItems = this.getAggregatedItems(guest.orders, true);
      const paidItems = this.getPaidAggregatedItems(guest.orders);
      const allItems = this.getAggregatedItems(guest.orders, false);
      const unpaidTotal = guest.orders.reduce((s, o) => s + this.getOrderUnpaidTotal(o), 0);
      const paidTotal = guest.orders.reduce((s, o) => s + this.getOrderPaidTotal(o), 0);
      return {
        ...guest,
        aggregatedItems: allItems,
        unpaidItems,
        paidItems,
        unpaidTotal,
        paidTotal
      };
    });
  }

  togglePaymentFilterDropdown(): void {
    this.paymentFilterDropdownOpen = !this.paymentFilterDropdownOpen;
  }

  selectPaymentFilter(value: 'all' | 'paid' | 'unpaid'): void {
    this.paymentFilter = value;
    this.paymentFilterDropdownOpen = false;
  }

  getPaymentFilterLabel(): string {
    return this.paymentFilterOptions.find(o => o.value === this.paymentFilter)?.label || 'All';
  }

  getFilteredOrderPointItems(): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    if (this.paymentFilter === 'paid') return this.cachedPaidItems;
    if (this.paymentFilter === 'unpaid') return this.cachedAggregatedActiveItems;
    return this.cachedAggregatedAllItems;
  }

  getFilteredOrderPointGroups(): { label: string | null; items: { name: string; quantity: number; totalPrice: number; paid: boolean }[] }[] {
    if (this.paymentFilter === 'paid') return [{ label: null, items: this.cachedPaidItems }];
    if (this.paymentFilter === 'unpaid') return [{ label: null, items: this.cachedAggregatedActiveItems }];
    const groups: { label: string; items: { name: string; quantity: number; totalPrice: number; paid: boolean }[] }[] = [];
    if (this.cachedAggregatedActiveItems.length) groups.push({ label: 'UNPAID', items: this.cachedAggregatedActiveItems });
    if (this.cachedPaidItems.length) groups.push({ label: 'PAID', items: this.cachedPaidItems });
    return groups;
  }

  getFilteredGuestGroups(guest: CachedGuestOrders): { label: string | null; items: { name: string; quantity: number; totalPrice: number; paid: boolean }[] }[] {
    if (this.paymentFilter === 'paid') return [{ label: null, items: guest.paidItems }];
    if (this.paymentFilter === 'unpaid') return [{ label: null, items: guest.unpaidItems }];
    const groups: { label: string; items: { name: string; quantity: number; totalPrice: number; paid: boolean }[] }[] = [];
    if (guest.unpaidItems.length) groups.push({ label: 'UNPAID', items: guest.unpaidItems });
    if (guest.paidItems.length) groups.push({ label: 'PAID', items: guest.paidItems });
    return groups;
  }

  getFilteredOrderPointTotal(): number {
    if (this.paymentFilter === 'paid') return this.getPaidOrderPointTotal();
    if (this.paymentFilter === 'unpaid') return this.getUnpaidOrderPointTotal();
    return this.getOrderPointOrdersTotal();
  }

  getFilteredGuestItems(guest: CachedGuestOrders): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    if (this.paymentFilter === 'paid') return guest.paidItems;
    if (this.paymentFilter === 'unpaid') return guest.unpaidItems;
    return guest.aggregatedItems;
  }

  getVisibleGuests(): CachedGuestOrders[] {
    return this.cachedGuestOrders.filter(guest => this.getFilteredGuestItems(guest).length > 0);
  }

  getFilteredGuestTotal(guest: CachedGuestOrders): number {
    if (this.paymentFilter === 'paid') return guest.paidTotal;
    if (this.paymentFilter === 'unpaid') return guest.unpaidTotal;
    return guest.total;
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
    // Reset the paid/unpaid filter to its default whenever the user toggles between tabs.
    this.paymentFilter = 'unpaid';
    this.paymentFilterDropdownOpen = false;
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

  // Aggregates only active (non-paid, non-cancelled) items for unpaid view
  getAggregatedActiveItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    return this.getAggregatedItems(orders, true);
  }

  // Aggregates all items (excluding cancelled) for total view
  getAggregatedAllItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number }[] {
    return this.getAggregatedItems(orders, false);
  }

  // Helper to aggregate items with optional unpaid-only filter
  private getAggregatedItems(orders: ApiOrder[], unpaidOnly: boolean): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    return this.aggregateItemsBy(orders, item => !(unpaidOnly && item.paid));
  }

  private getPaidAggregatedItems(orders: ApiOrder[]): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    return this.aggregateItemsBy(orders, item => !!item.paid);
  }

  private aggregateItemsBy(orders: ApiOrder[], predicate: (item: ApiOrderItem) => boolean): { name: string; quantity: number; totalPrice: number; paid: boolean }[] {
    const itemMap = new Map<string, { name: string; quantity: number; totalPrice: number; paid: boolean }>();

    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) {
        continue;
      }
      for (const item of order.items) {
        if (item.status === 'CANCELLED') {
          continue;
        }
        if (!predicate(item)) {
          continue;
        }
        const isPaid = !!item.paid;
        const key = `${item.name} ${isPaid}`;
        const existing = itemMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.price * item.quantity;
        } else {
          itemMap.set(key, {
            name: item.name,
            quantity: item.quantity,
            totalPrice: item.price * item.quantity,
            paid: isPaid
          });
        }
      }
    }

    return Array.from(itemMap.values()).sort((a, b) => {
      // Unpaid first, then paid; stable within each group
      if (a.paid === b.paid) return 0;
      return a.paid ? 1 : -1;
    });
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

  getPaidOrderPointTotal(): number {
    return this.orderPointOrders.reduce((sum, o) => sum + this.getOrderPaidTotal(o), 0);
  }

  getOrderPaidTotal(order: ApiOrder): number {
    return order.items
      .filter(item => item.paid && item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
    // Customer-facing app no longer subscribes to any WebSocket topics —
    // menu, orders, and payments views are fed exclusively by HTTP requests.
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