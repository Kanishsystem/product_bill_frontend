import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Icon } from '../../../shared/components/icon/icon';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  /** Shown in the mobile bottom nav (kept short - only the most-used screens). */
  inBottomNav?: boolean;
  /**
   * URL prefix that decides whether this nav item is highlighted - defaults
   * to `path` itself (exact match, or match + "/..."). Only good enough when
   * nothing else on the menu shares that same prefix.
   */
  activeMatch?: string;
  /**
   * Custom active-match, for a nav item whose URL space overlaps another
   * item's (Billing and Sales both live under /sales) and so can't be told
   * apart by a plain prefix - takes priority over `activeMatch`/`path` when
   * present. Receives the current path only (no query string).
   */
  matches?: (path: string) => boolean;
}

/** True for the Billing/"Edit Bill" screens specifically - /sales/new and
 * /sales/:id/edit - as opposed to the plain sales list/detail pages, which
 * also live under /sales (see the Sales nav item below). Kept as a named
 * function, not inlined, so Billing's and Sales' matchers can share it and
 * never drift apart into two different ideas of where "Billing" ends. */
function isBillingRoute(path: string): boolean {
  return path === '/sales/new' || /^\/sales\/\d+\/edit$/.test(path);
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Icon],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  /** Current URL (path + query), kept in sync with the router so isActive()
   * re-evaluates on every navigation even under zoneless change detection -
   * NavigationEnd already triggers Angular's own CD tick, this signal just
   * gives the template something to read that actually changes. */
  private currentUrl = signal(this.router.url);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', inBottomNav: true },
    { label: 'Billing', path: '/sales/new', icon: 'sales', inBottomNav: true, matches: isBillingRoute },
    { label: 'Sales', path: '/sales', icon: 'invoice', matches: (path) => !isBillingRoute(path) && (path === '/sales' || /^\/sales\/\d+$/.test(path)) },
    { label: 'Purchase', path: '/purchases', icon: 'purchase' },
    { label: 'Stock', path: '/stock', icon: 'stock', inBottomNav: true },
    { label: 'Products', path: '/products', icon: 'products' },
    { label: 'Categories', path: '/categories', icon: 'categories' },
    { label: 'Brands', path: '/brands', icon: 'brand' },
    { label: 'Units', path: '/units', icon: 'unit' },
    { label: 'Parties', path: '/parties', icon: 'parties' },
    { label: 'Payments', path: '/payments', icon: 'payment' },
    { label: 'Reports', path: '/reports', icon: 'reports', inBottomNav: true },
    { label: 'Users', path: '/users', icon: 'users' },
    { label: 'Settings', path: '/settings', icon: 'settings' },
  ];

  get bottomNavItems(): NavItem[] {
    return this.navItems.filter((item) => item.inBottomNav);
  }

  constructor(public auth: AuthService) {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  isActive(item: NavItem): boolean {
    const url = this.currentUrl().split('?')[0];
    if (item.matches) return item.matches(url);
    const match = item.activeMatch ?? item.path;
    return url === match || url.startsWith(match + '/');
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
