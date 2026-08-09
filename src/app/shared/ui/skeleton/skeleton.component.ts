import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div
      class="animate-pulse rounded-xl bg-border/60"
      [style.height]="height"
      [style.width]="width"
      [attr.aria-hidden]="true"
    ></div>
  `,
})
export class SkeletonComponent {
  @Input() height = '1rem';
  @Input() width = '100%';
}
