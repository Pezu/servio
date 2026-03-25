import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (mousedown)="onOverlayClick($event)">
      <div class="modal" [class]="sizeClass" (mousedown)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="close-btn" (click)="close.emit()" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <div class="modal-footer" *ngIf="showFooter">
          <button class="btn btn-secondary" (click)="close.emit()" type="button">
            {{ cancelText }}
          </button>
          <button
            class="btn btn-primary"
            [disabled]="submitDisabled || saving"
            (click)="submit.emit()"
            type="button">
            <span class="spinner" *ngIf="saving"></span>
            {{ saving ? savingText : submitText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    }
    .modal.modal-sm { max-width: 400px; }
    .modal.modal-lg { max-width: 700px; }
    .modal.modal-xl { max-width: 900px; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    .close-btn {
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
      transition: all 0.15s ease;
    }
    .close-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 0 0 16px 16px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-secondary {
      background: white;
      border: 1px solid #e5e7eb;
      color: #475569;
    }
    .btn-secondary:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .btn-primary {
      background: #3b82f6;
      border: 1px solid #3b82f6;
      color: white;
    }
    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
      border-color: #2563eb;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() submitText = 'Save';
  @Input() savingText = 'Saving...';
  @Input() cancelText = 'Cancel';
  @Input() submitDisabled = false;
  @Input() saving = false;
  @Input() showFooter = true;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();

  get sizeClass(): string {
    return this.size !== 'md' ? `modal-${this.size}` : '';
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
