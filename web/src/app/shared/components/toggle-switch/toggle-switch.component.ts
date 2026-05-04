import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleSwitchComponent),
      multi: true
    }
  ],
  template: `
    <label class="toggle-switch" [class.disabled]="disabled">
      <input
        type="checkbox"
        class="toggle-checkbox"
        [checked]="checked"
        [disabled]="disabled"
        (change)="onToggle($event)">
      @if (label) {
        <span class="toggle-label">{{ label }}</span>
      }
    </label>
    `,
  styles: [`
    .toggle-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .toggle-switch.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .toggle-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      border-radius: 0;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid #cbd5e1;
      background: white;
      display: inline-grid;
      place-content: center;
      margin: 0;
      flex-shrink: 0;
    }
    .toggle-checkbox:checked {
      background: white;
      border-color: #cbd5e1;
    }
    .toggle-checkbox:checked::before {
      content: '';
      width: 10px;
      height: 10px;
      background: #475569;
      clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
    }
    .toggle-checkbox:disabled {
      cursor: not-allowed;
    }
    .toggle-label {
      font-size: 14px;
      color: #475569;
      user-select: none;
    }
  `]
})
export class ToggleSwitchComponent implements ControlValueAccessor {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label = '';
  @Output() change = new EventEmitter<boolean>();

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  onToggle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.checked = input.checked;
    this.onChange(this.checked);
    this.onTouched();
    this.change.emit(this.checked);
  }

  // ControlValueAccessor implementation
  writeValue(value: boolean): void {
    this.checked = value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
