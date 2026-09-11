import { Component, Input } from '@angular/core';

/**
 * Minimal inline-SVG icon set covering the nav/action icons this app needs,
 * so we don't pull in an icon font or library just for a couple dozen glyphs.
 * Usage: <app-icon name="dashboard"></app-icon>
 */
const ICONS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  purchase: 'M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2m6 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  sales: 'M3 3h2l2.4 12.4A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.96-1.6L21.5 8H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  stock: 'M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M3 7l9 4m0 0 9-4m-9 4v10',
  reports: 'M4 19h16M7 19V9m5 10V5m5 14v-7',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a7.9 7.9 0 0 0-.15-1.5l2.05-1.6-2-3.46-2.42.98a8 8 0 0 0-2.6-1.5L14.5 2h-5l-.38 2.92a8 8 0 0 0-2.6 1.5l-2.42-.98-2 3.46 2.05 1.6A8 8 0 0 0 4 12c0 .51.05 1.01.15 1.5l-2.05 1.6 2 3.46 2.42-.98a8 8 0 0 0 2.6 1.5L9.5 22h5l.38-2.92a8 8 0 0 0 2.6-1.5l2.42.98 2-3.46-2.05-1.6c.1-.49.15-.99.15-1.5Z',
  categories: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  products: 'M21 8 12 3 3 8l9 5 9-5Zm0 0v8l-9 5m0-13v13m0-13L3 8v8l9 5',
  parties: 'M16 11a4 4 0 1 0-4-4M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0M15 20a6 6 0 0 1 6-6',
  users: 'M16 11a4 4 0 1 0-4-4M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0M15 20a6 6 0 0 1 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m6 14 5-5-5-5m5 5H9',
  search: 'M21 21l-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Zm-4.27 13a2 2 0 0 1-3.46 0',
  cart: 'M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2m6 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  barcode: 'M4 4v16M8 4v16M12 4v10M16 4v16M20 4v16',
  warning: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  camera: 'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  brand: 'M20.59 13.41 13 21l-9-9V4a2 2 0 0 1 2-2h8l9 9a2 2 0 0 1 0 2.41ZM7 7h.01',
  unit: 'M2 8h20v8H2V8Zm4 0v4M10 8v4M14 8v4M18 8v4',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff:
    'M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2M6.1 6.5C3.9 8 2 12 2 12s4 8 11 8c1.9 0 3.6-.45 5.1-1.15M17.9 17.5C20.1 16 22 12 22 12s-1.6-3.2-4.4-5.4A12.6 12.6 0 0 0 12 4c-.7 0-1.4.06-2.05.18',
  payment: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4h-4Z',
  invoice: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h8M8 17h8M8 9h2',
  lock: 'M6 10V7a6 6 0 1 1 12 0v3m-13 0h14a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1Zm7 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  check: 'M5 12.5 10 17.5 19 7',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      [attr.stroke]="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path"></path>
    </svg>
  `,
})
export class Icon {
  @Input() name = 'dashboard';
  @Input() size = 20;
  @Input() color = 'currentColor';

  get path(): string {
    return ICONS[this.name] ?? ICONS['dashboard'];
  }
}
