import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-border bg-surface-1/80 px-6 py-10 text-center shadow-soft">
      <h2 class="font-display text-lg font-semibold text-ink">{{ title }}</h2>
      @if (message) {
        <p class="mt-2 text-sm text-[var(--text-secondary)]">{{ message }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message = '';
}
