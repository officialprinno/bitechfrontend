import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <div
      class="rounded-2xl border border-danger/30 bg-surface-1 px-6 py-8 text-center shadow-soft"
      role="alert"
    >
      <h2 class="font-display text-lg font-semibold text-danger">{{ title }}</h2>
      @if (message) {
        <p class="mt-2 text-sm text-[var(--text-secondary)]">{{ message }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class ErrorStateComponent {
  @Input() title = 'Hitilafu imetokea';
  @Input() message = '';
}
