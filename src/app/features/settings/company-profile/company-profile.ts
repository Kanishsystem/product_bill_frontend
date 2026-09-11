import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../../core/services/company.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { CompanyProfile } from '../../../core/models/company.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './company-profile.html',
  styleUrl: './company-profile.scss',
})
export class CompanyProfileComponent implements OnInit, OnDestroy {
  loading = signal(true);
  saving = signal(false);
  form: Partial<CompanyProfile> = {};

  /** Uploading/removing the invoice heading image happens immediately on
   * pick (its own request, not part of the Save-changes form) - a separate
   * busy flag so it doesn't disable the rest of the form's Save button. */
  uploadingHeaderImage = signal(false);

  /** Full, directly-loadable URL for form.header_image_path (which is only
   * a path relative to the backend, same convention every API call uses),
   * or null when no image has been uploaded - drives both the preview here
   * and (indirectly, via the saved company profile) the printed invoice. */
  headerImageUrl(): string | null {
    return this.form.header_image_path ? `${environment.apiBaseUrl}/${this.form.header_image_path}` : null;
  }

  /** The last color actually saved on the server - used to revert the live preview if the user navigates away without saving. */
  private savedThemeColor: string | undefined;

  readonly defaultThemeColor = ThemeService.DEFAULT_COLOR;

  /** A handful of ready-made options so most shops can pick a color without hunting through a color wheel. */
  readonly themePresets: { label: string; color: string }[] = [
    { label: 'Pink (default)', color: '#e8296b' },
    { label: 'Blue', color: '#1d63d1' },
    { label: 'Green', color: '#1a9e5c' },
    { label: 'Purple', color: '#7c3aed' },
    { label: 'Orange', color: '#e8730a' },
    { label: 'Teal', color: '#0d9488' },
  ];

  constructor(
    private companyService: CompanyService,
    private theme: ThemeService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.companyService.get().subscribe({
      next: (res) => {
        this.form = res.data ?? {};
        if (!this.form.theme_color) {
          this.form.theme_color = this.defaultThemeColor;
        }
        this.savedThemeColor = this.form.theme_color;
        this.loading.set(false);
      },
      error: () => {
        // No profile row yet (fresh install before migrations/seeders ran) - start blank.
        this.form.theme_color = this.defaultThemeColor;
        this.savedThemeColor = this.defaultThemeColor;
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    // Leaving the page without saving - put the real saved color back so an
    // unsaved preview doesn't linger app-wide for the rest of the session.
    if (this.savedThemeColor && this.form.theme_color !== this.savedThemeColor) {
      this.theme.setTheme(this.savedThemeColor);
    }
  }

  /** Live-preview the color across the app as soon as it's picked, before Save is even clicked. */
  previewTheme(hex: string | undefined): void {
    this.form.theme_color = hex;
    this.theme.setTheme(hex);
  }

  resetTheme(): void {
    this.previewTheme(this.defaultThemeColor);
  }

  /** Fired by the file input's (change) event. Uploads immediately (rather
   * than waiting for Save) so the preview and the printed invoice update
   * together as soon as it succeeds - there's no "unsaved" state for this
   * field the way there is for the rest of the form. */
  onHeaderImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingHeaderImage.set(true);
    this.companyService.uploadHeaderImage(file).subscribe({
      next: (res) => {
        this.form = res.data ?? this.form;
        this.uploadingHeaderImage.set(false);
        this.toast.success('Invoice heading image saved.');
        // Let the same file be re-picked immediately (e.g. after Remove) -
        // a file input doesn't fire (change) again for the same filename
        // otherwise.
        input.value = '';
      },
      error: (err) => {
        this.uploadingHeaderImage.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not upload that image.'));
        input.value = '';
      },
    });
  }

  removeHeaderImage(): void {
    this.uploadingHeaderImage.set(true);
    this.companyService.removeHeaderImage().subscribe({
      next: (res) => {
        this.form = res.data ?? this.form;
        this.uploadingHeaderImage.set(false);
        this.toast.success('Invoice heading image removed - back to the plain text heading.');
      },
      error: (err) => {
        this.uploadingHeaderImage.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not remove the image.'));
      },
    });
  }

  save(): void {
    if (!this.form.shop_name || !this.form.gstin) {
      this.toast.error('Shop name and GSTIN are required.');
      return;
    }
    this.saving.set(true);
    this.companyService.update(this.form).subscribe({
      next: (res) => {
        this.form = res.data ?? this.form;
        this.savedThemeColor = this.form.theme_color;
        this.theme.setTheme(this.form.theme_color);
        this.saving.set(false);
        this.toast.success('Company profile saved.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save the company profile.'));
      },
    });
  }
}
