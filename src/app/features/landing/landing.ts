import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl, Title } from '@angular/platform-browser';
import { ThemeService } from '../../core/services/theme.service';

interface ShowcaseProduct {
  name: string;
  icon: SafeHtml;
}

/** Raw SVG markup for each showcase tile - hand-drawn line icons (same
 * stroke-icon convention as the rest of this page) rather than photography.
 * This page ships inside the billing app's own Angular build with no image
 * hosting/upload pipeline behind it, and hot-linking third-party stock
 * photos onto a client's live shop site is a fragile choice (broken images
 * the moment a hotlink policy changes) - a crisp, on-brand vector actually
 * holds up better here, and it renders instantly with zero extra network
 * requests. Swap in real product photography later (e.g. img tags pointing
 * at the shop's own uploaded photos) if/when that's available - the
 * `.sc-art`/`.floater` containers are sized to take either one. */
const ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.4"/><path d="M11 18h2"/><path d="M9.5 5h5"/></svg>`,
  watch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="8" rx="2.2"/><path d="M9 8V5.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8M9 16v2.4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V16"/></svg>`,
  buds: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="9" r="2.6"/><path d="M8.5 11.6v4.4a2 2 0 0 0 2 2"/><circle cx="16" cy="8" r="2.6"/><path d="M16 10.6V15"/></svg>`,
  tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9.5h12"/><path d="M9 4.6v2M9 12.2v2"/></svg>`,
  wash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.4"/><circle cx="12" cy="13.5" r="5.2"/><circle cx="12" cy="13.5" r="2"/><path d="M7 6h.01M10 6h.01"/></svg>`,
  ac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="7" rx="3"/><path d="M6 17.5 5 21M11 17.5l-.6 3.4M16 17.5l-1 3M20 17.5l-1.4 2.6"/><circle cx="18" cy="9.5" r="1"/></svg>`,
  kitchen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4h7l-1 5h-5l-1-5Z"/><path d="M7.3 9h9.4l-1.28 9.6A2 2 0 0 1 13.44 20h-2.88a2 2 0 0 1-1.98-1.4L7.3 9Z"/><path d="M8.6 13h6.8"/></svg>`,
};

const SHOP_ADDRESS = 'No.5/2, Pondy Road, Marakkanam - 604303, Tamil Nadu';

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

  @ViewChild('showcaseTrack') private showcaseTrackRef?: ElementRef<HTMLElement>;

  /** The 8 categories the "Explore our products" scroller advertises, in
   * the same order the client asked for. */
  readonly products: ShowcaseProduct[];
  /** products, twice back to back - the actual DOM the scroller renders.
   * Auto-scroll and manual scroll/swipe both operate on this doubled strip;
   * once scrollLeft passes one full set's width, onShowcaseScroll() silently
   * subtracts that width so it looks like the strip loops forever without
   * ever visibly snapping back to the start. */
  readonly loopedProducts: ShowcaseProduct[];
  /** Which of the 8 *logical* products is currently front-and-center -
   * drives the active dot under the scroller. */
  activeShowcaseIndex = 0;

  /** Google's no-API-key "output=embed" form of a normal Maps search URL -
   * a real, live map of the shop's actual address, not a static image. */
  readonly mapEmbedUrl: SafeResourceUrl;

  readonly currentYear = new Date().getFullYear();

  private showcasePaused = false;
  private showcaseResumeTimer?: ReturnType<typeof setTimeout>;
  private showcaseRafId?: number;
  private revealObserver?: IntersectionObserver;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  constructor(
    private titleService: Title,
    private themeService: ThemeService,
    private elementRef: ElementRef<HTMLElement>,
    private sanitizer: DomSanitizer,
  ) {
    // The icon strings above are fixed developer-authored constants (never
    // user input), so trusting them as HTML is safe - Angular's default
    // innerHTML sanitizer is otherwise inconsistent about which inline SVG
    // attributes it keeps.
    const trust = (svg: string) => this.sanitizer.bypassSecurityTrustHtml(svg);
    this.products = [
      { name: 'Smartphones', icon: trust(ICONS.phone) },
      { name: 'Smartwatches', icon: trust(ICONS.watch) },
      { name: 'Earbuds', icon: trust(ICONS.buds) },
      { name: 'Televisions', icon: trust(ICONS.tv) },
      { name: 'Refrigerators', icon: trust(ICONS.fridge) },
      { name: 'Washing Machines', icon: trust(ICONS.wash) },
      { name: 'Air Conditioners', icon: trust(ICONS.ac) },
      { name: 'Kitchen Appliances', icon: trust(ICONS.kitchen) },
    ];
    this.loopedProducts = [...this.products, ...this.products];
    this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.google.com/maps?q=${encodeURIComponent(SHOP_ADDRESS)}&output=embed`,
    );
  }

  ngOnInit(): void {
    this.titleService.setTitle('Rasi Time Center - Mobiles & Home Appliances');
    this.applyShopTheme();
  }

  ngAfterViewInit(): void {
    this.setUpScrollReveal();
    if (!this.prefersReducedMotion) {
      this.startShowcaseAutoScroll();
    }
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    if (this.showcaseRafId !== undefined) {
      cancelAnimationFrame(this.showcaseRafId);
    }
    if (this.showcaseResumeTimer) {
      clearTimeout(this.showcaseResumeTimer);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 8;
  }

  // ---------------------------------------------------------------------
  // Product showcase scroller
  // ---------------------------------------------------------------------

  pauseShowcase(): void {
    this.showcasePaused = true;
  }

  resumeShowcase(): void {
    this.showcasePaused = false;
  }

  /** Arrow-button handler - scrolls by exactly one card, pauses the
   * auto-scroll briefly afterwards so a click doesn't immediately get
   * overridden by the marquee still nudging forward underneath it. */
  scrollShowcase(direction: 1 | -1): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    const cardWidth = this.cardWidth(track);
    track.scrollBy({ left: direction * cardWidth, behavior: 'smooth' });
    this.pauseForInteraction();
  }

  /** Dot-button handler - jumps to the Nth logical product (within the
   * first copy of the doubled strip). */
  goToShowcaseSlide(index: number): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    const cardWidth = this.cardWidth(track);
    track.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
    this.pauseForInteraction();
  }

  /** Fired on every scroll of the track, whether driven by the user
   * (swipe/drag/wheel) or by the auto-scroll loop below - keeps the loop
   * seamless and the active dot in sync either way. */
  onShowcaseScroll(): void {
    const track = this.showcaseTrackRef?.nativeElement;
    if (!track) {
      return;
    }
    this.wrapShowcase(track);
    const cardWidth = this.cardWidth(track);
    if (cardWidth > 0) {
      const setWidth = track.scrollWidth / 2;
      const raw = Math.round((track.scrollLeft % setWidth) / cardWidth);
      this.activeShowcaseIndex = ((raw % this.products.length) + this.products.length) % this.products.length;
    }
  }

  private pauseForInteraction(): void {
    this.pauseShowcase();
    if (this.showcaseResumeTimer) {
      clearTimeout(this.showcaseResumeTimer);
    }
    this.showcaseResumeTimer = setTimeout(() => this.resumeShowcase(), 2600);
  }

  private cardWidth(track: HTMLElement): number {
    return track.scrollWidth / (this.loopedProducts.length || 1);
  }

  /** Once scrollLeft passes (or drops below) one full copy of the product
   * list, silently jump back by exactly that width - since the second copy
   * is pixel-identical to the first, this is invisible to the eye and turns
   * a finite doubled strip into what reads as an infinite loop. */
  private wrapShowcase(track: HTMLElement): void {
    const setWidth = track.scrollWidth / 2;
    if (setWidth <= 0) {
      return;
    }
    if (track.scrollLeft >= setWidth) {
      track.scrollLeft -= setWidth;
    } else if (track.scrollLeft < 0) {
      track.scrollLeft += setWidth;
    }
  }

  /** A slow, continuous marquee-style drift - paused whenever the pointer
   * or a touch is over the strip (see pauseShowcase()/resumeShowcase(),
   * wired from landing.html) or right after the user has interacted with an
   * arrow/dot. Skipped entirely under prefers-reduced-motion (ngAfterViewInit
   * never calls this then), matching every other continuous animation on
   * this page. */
  private startShowcaseAutoScroll(): void {
    const step = () => {
      const track = this.showcaseTrackRef?.nativeElement;
      if (track && !this.showcasePaused) {
        track.scrollLeft += 0.55;
        this.onShowcaseScroll();
      }
      this.showcaseRafId = requestAnimationFrame(step);
    };
    this.showcaseRafId = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------

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
