import { Component, Input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [attr.type]="type"
      [disabled]="disabled || loading"
      class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-[var(--motion-base)] ease-[var(--motion-ease)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      [class]="variantClass"
    >
      @if (loading) {
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        ></span>
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: ButtonVariant = 'primary';
  @Input() disabled = false;
  @Input() loading = false;

  get variantClass(): string {
    switch (this.variant) {
      case 'secondary':
        return 'bg-surface-1 text-ink border border-border hover:bg-signal-muted';
      case 'ghost':
        return 'bg-transparent text-signal hover:bg-signal-muted';
      default:
        return 'bg-signal text-[var(--text-inverse)] hover:bg-signal-hover';
    }
  }
}
