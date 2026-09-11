import { Component, Input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="empty-state">
      <app-icon [name]="icon" [size]="34" color="var(--text-muted)"></app-icon>
      <p class="empty-title">{{ title }}</p>
      @if (subtitle) {
        <p class="empty-subtitle">{{ subtitle }}</p>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 3rem 1rem;
        text-align: center;
      }
      .empty-title {
        margin: 0;
        font-weight: 600;
        color: var(--text);
      }
      .empty-subtitle {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
    `,
  ],
})
export class EmptyState {
  @Input() title = 'Nothing here yet';
  @Input() subtitle: string | null = null;
  @Input() icon = 'products';
}
