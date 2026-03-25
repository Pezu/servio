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
    </div>
  `,
  styles: [`
    .loading-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: #4CAF50;
      border-radius: 50%;
      animation: spin 1s linear infinite;
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

    console.log('[PaymentConfirmed] eventId:', eventId);
    console.log('[PaymentConfirmed] orderPointId:', orderPointId);
    console.log('[PaymentConfirmed] rawOrderId:', rawOrderId);
    console.log('[PaymentConfirmed] pendingOrderId (validated):', pendingOrderId);
    console.log('[PaymentConfirmed] type:', paymentType);
    console.log('[PaymentConfirmed] pendingPaymentReference:', pendingPaymentReference);

    if (pendingOrderId) {
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
      // Complete the payment (payLater table order flow)
      console.log('[PaymentConfirmed] Completing payment with reference:', pendingPaymentReference);
      this.http.post<any>(`${environment.apiUrl}/api/payments/complete`, {
        reference: pendingPaymentReference
      }).subscribe({
          next: (response) => {
            console.log('[PaymentConfirmed] Payment complete response:', response);
            this.deleteCookie('pendingPaymentReference');
            localStorage.setItem('paymentSuccess', 'true');
            this.redirect(eventId, orderPointId);
          },
          error: (err) => {
            console.error('[PaymentConfirmed] Payment complete error:', err);
            this.deleteCookie('pendingPaymentReference');
            localStorage.setItem('paymentError', 'true');
            this.redirect(eventId, orderPointId);
          }
        });
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
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let c of ca) {
      c = c.trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
    return null;
  }

  private deleteCookie(name: string): void {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }
}