import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.confirmAndRedirect();
  }

  private confirmAndRedirect(): void {
    const pendingOrderId = localStorage.getItem('pendingOrderId');
    const eventId = localStorage.getItem('paymentEventId');
    const orderPointId = localStorage.getItem('paymentOrderPointId');

    if (pendingOrderId) {
      // Confirm the order
      this.http.post<any>(`${environment.apiUrl}/api/orders/${pendingOrderId}/confirm`, {})
        .subscribe({
          next: (confirmedOrder) => {
            localStorage.removeItem('pendingOrderId');
            localStorage.setItem('paymentSuccess', 'true');
            localStorage.setItem('confirmedOrderId', confirmedOrder.id);
            this.redirect(eventId, orderPointId);
          },
          error: () => {
            localStorage.removeItem('pendingOrderId');
            localStorage.setItem('paymentError', 'true');
            this.redirect(eventId, orderPointId);
          }
        });
    } else {
      this.redirect(eventId, orderPointId);
    }
  }

  private redirect(eventId: string | null, orderPointId: string | null): void {
    localStorage.removeItem('paymentEventId');
    localStorage.removeItem('paymentOrderPointId');

    if (eventId && orderPointId) {
      this.router.navigate(['/event/customer', eventId, 'order-points', orderPointId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}