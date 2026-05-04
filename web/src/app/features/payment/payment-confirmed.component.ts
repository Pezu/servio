import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-payment-confirmed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="message">Processing your order...</p>
    </div>
  `,
  styles: [`
    .loading-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      gap: 16px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: #4CAF50;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .message {
      color: #666;
      font-size: 14px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class PaymentConfirmedComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.confirmAndRedirect();
  }

  private confirmAndRedirect(): void {
    // Read from query params (primary) or fall back to cookies
    const queryParams = this.route.snapshot.queryParams;

    // Try to extract orderId from URL (Netopia might mangle query params)
    const fullUrl = window.location.href;
    console.log('[PaymentConfirmed] Full URL:', fullUrl);

    // Extract UUID from URL using regex (more robust than query params)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuidsInUrl = fullUrl.match(uuidRegex) || [];
    console.log('[PaymentConfirmed] UUIDs found in URL:', uuidsInUrl);

    // Helper to get first valid UUID from a value (could be string or array)
    const uuidValidateRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const extractValidUuid = (value: any): string | null => {
      if (!value) return null;
      if (Array.isArray(value)) {
        // Find first valid UUID in array
        return value.find((v: string) => uuidValidateRegex.test(v)) || null;
      }
      return uuidValidateRegex.test(value) ? value : null;
    };

    const eventId = extractValidUuid(queryParams['eventId']) || this.getCookie('paymentEventId') || uuidsInUrl[0] || null;
    const orderPointId = extractValidUuid(queryParams['orderPointId']) || this.getCookie('paymentOrderPointId') || uuidsInUrl[1] || null;
    const rawOrderId = queryParams['orderId'] || this.getCookie('pendingOrderId');
    const paymentType = queryParams['type'];

    // Extract valid UUID from orderId (handles array case from duplicate params)
    const pendingOrderId = extractValidUuid(rawOrderId) || uuidsInUrl[2] || null;
    const pendingPaymentReference = this.getCookie('pendingPaymentReference');
    const tableOrderPayment = localStorage.getItem('tableOrderPayment');

    console.log('[PaymentConfirmed] eventId:', eventId);
    console.log('[PaymentConfirmed] orderPointId:', orderPointId);
    console.log('[PaymentConfirmed] rawOrderId:', rawOrderId);
    console.log('[PaymentConfirmed] pendingOrderId (validated):', pendingOrderId);
    console.log('[PaymentConfirmed] type:', paymentType);
    console.log('[PaymentConfirmed] pendingPaymentReference:', pendingPaymentReference);
    console.log('[PaymentConfirmed] tableOrderPayment:', tableOrderPayment);

    // For table order payments, prioritize the payment reference flow
    if (tableOrderPayment === 'true' && pendingPaymentReference) {
      // Table order payment flow - payment completion is handled by Netopia IPN callback
      console.log('[PaymentConfirmed] Table order payment detected, using payment reference flow');
      this.deleteCookie('pendingPaymentReference');
      localStorage.setItem('paymentSuccess', 'true');
      this.redirect(eventId, orderPointId);
    } else if (pendingOrderId && !tableOrderPayment) {
      // Confirm the order (non-payLater flow)
      console.log('[PaymentConfirmed] Confirming order:', pendingOrderId);
      this.http.post<any>(`${environment.apiUrl}/api/orders/${pendingOrderId}/confirm`, {})
        .subscribe({
          next: (confirmedOrder) => {
            console.log('[PaymentConfirmed] Order confirmed:', confirmedOrder);
            this.deleteCookie('pendingOrderId');
            localStorage.setItem('paymentSuccess', 'true');
            localStorage.setItem('confirmedOrderId', confirmedOrder.id);
            this.redirect(eventId, orderPointId);
          },
          error: (err) => {
            console.error('[PaymentConfirmed] Order confirm error:', err);
            this.deleteCookie('pendingOrderId');
            localStorage.setItem('paymentError', 'true');
            this.redirect(eventId, orderPointId);
          }
        });
    } else if (pendingPaymentReference) {
      // Table order payment flow - payment completion is handled by Netopia IPN callback
      // Just clean up and redirect back with success
      console.log('[PaymentConfirmed] Table order payment completed via IPN, redirecting. Reference:', pendingPaymentReference);
      this.deleteCookie('pendingPaymentReference');
      localStorage.setItem('paymentSuccess', 'true');
      this.redirect(eventId, orderPointId);
    } else if (tableOrderPayment === 'true') {
      // Table order payment but reference already cleared - payment was likely completed via IPN
      console.log('[PaymentConfirmed] Table order payment without reference, assuming IPN completed');
      localStorage.setItem('paymentSuccess', 'true');
      this.redirect(eventId, orderPointId);
    } else {
      console.log('[PaymentConfirmed] No pending order or payment reference, redirecting');
      this.redirect(eventId, orderPointId);
    }
  }

  private redirect(eventId: string | null, orderPointId: string | null): void {
    this.deleteCookie('paymentEventId');
    this.deleteCookie('paymentOrderPointId');

    if (eventId && orderPointId) {
      this.router.navigate(['/event/customer', eventId, 'order-points', orderPointId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  private getCookie(name: string): string | null {
    // Use localStorage (matching registration.component.ts)
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  }

  private deleteCookie(name: string): void {
    // Use localStorage (matching registration.component.ts)
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  }
}