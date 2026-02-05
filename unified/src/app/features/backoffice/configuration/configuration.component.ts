import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs-container">
      <div class="card">
        <div class="tab-header">
          <div class="tab-nav">
            <button class="tab-btn" [class.active]="activeTab === 'roles'" (click)="setActiveTab('roles')">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Roles
            </button>
          </div>
        </div>

        <!-- Roles Tab Content -->
        @if (activeTab === 'roles') {
          <div class="card-body">
            <div class="text-center py-4 text-muted">Roles management coming soon</div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tabs-container { margin-bottom: 24px; }
    .card { background: var(--white); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .tab-header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid var(--border-color); background: var(--white); }
    .tab-nav { display: flex; gap: 0; }
    .tab-btn { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border: none; background: none; font-size: 14px; font-weight: 500; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s ease; }
    .tab-btn:hover { color: var(--text-dark); }
    .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
    .tab-btn svg { width: 18px; height: 18px; }
    .card-body { padding: 20px; }
    .text-center { text-align: center; }
    .py-4 { padding-top: 24px; padding-bottom: 24px; }
    .text-muted { color: var(--text-muted); }
  `]
})
export class ConfigurationComponent {
  activeTab: 'roles' = 'roles';

  setActiveTab(tab: 'roles'): void {
    this.activeTab = tab;
  }
}