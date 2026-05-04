import { Component, Input, Output, EventEmitter } from '@angular/core';


@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
  template: `
    @if (isOpen) {
      <div class="modal-overlay" (mousedown)="onOverlayClick($event)">
        <div class="modal" [class]="sizeClass" (mousedown)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button class="close-btn" (click)="close.emit()" type="button" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <ng-content></ng-content>
          </div>
          @if (showFooter) {
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="close.emit()" type="button">
                {{ cancelText }}
              </button>
              <button
                class="btn btn-primary"
                [disabled]="submitDisabled || saving"
                (click)="submit.emit()"
                type="button">
                @if (saving) {
                  <span class="spinner"></span>
                }
                {{ saving ? savingText : submitText }}
              </button>
            </div>
          }
        </div>
      </div>
    }
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
      border-radius: 0;
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
      border: 1px solid #e5e7eb;
      background: transparent;
      border-radius: 0;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.15s ease;
    }
    .close-btn:hover {
      background: transparent;
      color: #1e293b;
      border-color: #cbd5e1;
    }
    .close-btn svg { width: 16px; height: 16px; display: block; }
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
      border-radius: 0;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 0;
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
      background: white;
      border-color: #cbd5e1;
      color: #1e293b;
    }
    .btn-primary {
      background: white;
      border: 1px solid #3b82f6;
      color: #3b82f6;
    }
    .btn-primary:hover:not(:disabled) {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #3b82f6;
    }
    .btn-primary:disabled {
      background: white;
      border-color: #94a3b8;
      color: #94a3b8;
      cursor: not-allowed;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
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
