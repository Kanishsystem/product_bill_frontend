import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ThemeService } from '../../core/services/theme.service';

/**
 * Public, unauthenticated marketing page for the shop's own customers -
 * lives at the app's root path ("/"), separate from the Login screen at
 * "/login" and everything behind the auth guard. Content/design mirrors the
 * standalone rasi-time-center.html landing page (also served statically at
 * public/welcome.html) - kept here too as a real Angular route so it's
 * reachable at a clean root URL without any static-file/SPA-fallback
 * quirks, and so it stays in the same build/deploy pipeline as the rest of
 * the app.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, AfterViewInit, OnDestroy {
  /** True once the page has been scrolled past the hero - toggles the
   * topbar's frosted/scrolled look (see .topbar.scrolled in landing.scss). */
  scrolled = false;

  private revealObserver?: IntersectionObserver;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  constructor(
    private titleService: Title,
    private themeService: ThemeService,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Rasi Time Center - Mobiles & Home Appliances');
    this.applyShopTheme();
  }

  ngAfterViewInit(): void {
    this.setUpScrollReveal();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 8;
  }

  /** Syncs this page's own --accent/--accent-2/--accent-deep tokens (see
   * landing.scss) to the shop's chosen Settings > Appearance color, instead
   * of always staying the hardcoded pink/magenta this page launched with.
   * This page is unauthenticated (see the class doc above), so it can't
   * call the protected `company/get` endpoint itself the way the rest of
   * the app does - but it's also already documented as a local-only link
   * (only reachable via this same machine's `ng serve`/build, not a public
   * internet URL), so reusing ThemeService's cached last-applied color
   * (populated by any admin login on this machine) is a reasonable stand-in
   * for "the shop's current theme" here. When the shop has never changed
   * their color (still the default), this deliberately leaves the page's
   * own hardcoded values in the DOM untouched - including the dark-mode
   * media query's own brighter pink shades - rather than overwriting them
   * with an inline style that would win over that @media block for every
   * visitor, customized or not. */
  private applyShopTheme(): void {
    const color = this.themeService.cachedThemeColor();
    if (color === ThemeService.DEFAULT_COLOR) {
      return;
    }
    const { base, light, deep } = this.themeService.accentPalette(color);
    const host = this.elementRef.nativeElement.style;
    host.setProperty('--accent', base);
    host.setProperty('--accent-2', light);
    host.setProperty('--accent-deep', deep);
  }

  /** Fades/slides each `.reveal` section into place as it scrolls into
   * view, instead of everything being visible (and static) the instant the
   * page loads - the hero already had its own load-in animation; this
   * extends the same idea down the page. Skipped entirely under
   * prefers-reduced-motion: every `.reveal` element is just marked visible
   * immediately, same as landing.scss's own reduced-motion override for the
   * hero. Uses IntersectionObserver rather than a scroll-position
   * calculation - cheaper, and correct regardless of each section's exact
   * height. */
  private setUpScrollReveal(): void {
    const revealEls = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.reveal');
    if (this.prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    revealEls.forEach((el) => this.revealObserver?.observe(el));
  }
}
