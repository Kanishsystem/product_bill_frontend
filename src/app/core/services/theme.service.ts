import { Injectable } from '@angular/core';

/**
 * Applies the shop's chosen brand color app-wide by overriding the CSS
 * custom properties every screen already reads (--brand, --brand-dark,
 * --brand-darker, --brand-light, --brand-gradient - see styles.scss :root).
 * No component/template needs to change: they all read these variables at
 * render time, so setting them on <html> cascades everywhere instantly,
 * including the printed invoice's grand-total box and heading rule.
 *
 * Only one color is stored (company_profile.theme_color); the darker/
 * lighter shades used around the app are derived from it here so the
 * palette always stays visually consistent, the same way the original
 * hardcoded pink/magenta palette was one hue at different lightness levels.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  static readonly DEFAULT_COLOR = '#e8296b';
  private static readonly STORAGE_KEY = 'pb_theme_color';

  /** Call once at app bootstrap so the last-known color paints before the company profile API call resolves (or if it fails, e.g. on the login page before auth). */
  applyCachedTheme(): void {
    this.apply(this.readCache() ?? ThemeService.DEFAULT_COLOR);
  }

  /** Call after the company profile loads/saves with its theme_color. */
  setTheme(hexColor: string | null | undefined): void {
    const color = this.isValidHex(hexColor) ? (hexColor as string) : ThemeService.DEFAULT_COLOR;
    this.apply(color);
    this.writeCache(color);
  }

  isValidHex(value: string | null | undefined): boolean {
    return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  /** The last color setTheme()/applyCachedTheme() applied (from
   * company_profile.theme_color, cached in localStorage), or the default if
   * nothing's been cached yet - e.g. this browser has never had an admin
   * session. Public so a page that can't call the authenticated
   * `company/get` endpoint itself (the public Landing page - see
   * accentPalette() below) can still read "the shop's current theme color"
   * without duplicating the cache-read logic. */
  cachedThemeColor(): string {
    const cached = this.readCache();
    return this.isValidHex(cached) ? (cached as string) : ThemeService.DEFAULT_COLOR;
  }

  /** Derives a light/base/deep 3-stop accent palette from a single hex color,
   * using the same HSL shading apply() uses for --brand-light/--brand-dark -
   * for a page (the public Landing page) that keeps its own separate CSS
   * variable names (--accent/--accent-2/--accent-deep) instead of adopting
   * the app-wide --brand* tokens, so it can still sync its accent color to
   * Settings > Appearance without pulling in the whole --brand* scheme (and
   * without this service needing to know Landing's variable names). */
  accentPalette(hex: string): { base: string; light: string; deep: string } {
    const color = this.isValidHex(hex) ? hex : ThemeService.DEFAULT_COLOR;
    return {
      base: color,
      light: this.shade(color, 0.18),
      deep: this.shade(color, -0.32),
    };
  }

  private apply(hex: string): void {
    const root = document.documentElement.style;
    root.setProperty('--brand', hex);
    root.setProperty('--brand-dark', this.shade(hex, -0.16));
    root.setProperty('--brand-darker', this.shade(hex, -0.32));
    root.setProperty('--brand-light', this.tint(hex, 0.88));
    root.setProperty('--brand-gradient', `linear-gradient(135deg, ${this.shade(hex, 0.18)} 0%, ${hex} 100%)`);
  }

  /** factor < 0 darkens, > 0 lightens (as a fraction toward white), by moving lightness in HSL space. */
  private shade(hex: string, factor: number): string {
    const [h, s, l] = this.hexToHsl(hex);
    const newL = Math.min(1, Math.max(0, l + factor));
    return this.hslToHex(h, s, newL);
  }

  /** Blends the color toward white by `amount` (0-1) - used for the pale highlight background. */
  private tint(hex: string, amount: number): string {
    const [h, s, l] = this.hexToHsl(hex);
    const newL = l + (1 - l) * amount;
    // Pull saturation down a touch too, same as the original pale pink (#fce4ee is much less saturated than #e8296b).
    const newS = s * 0.5;
    return this.hslToHex(h, newS, newL);
  }

  private hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / d) % 6;
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  private hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (v: number) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private readCache(): string | null {
    try {
      return localStorage.getItem(ThemeService.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeCache(hex: string): void {
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, hex);
    } catch {
      // Private browsing / storage disabled - theme still applies for this page load, just won't be cached.
    }
  }
}
