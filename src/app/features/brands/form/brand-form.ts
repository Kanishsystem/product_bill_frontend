import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BrandService } from '../../../core/services/brand.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Brand } from '../../../core/models/brand.model';

@Component({
  selector: 'app-brand-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './brand-form.html',
  styleUrl: './brand-form.scss',
})
export class BrandForm implements OnInit {
  brandId: number | null = null;
  loading = signal(false);
  saving = signal(false);

  form = { brand_name: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private brandService: BrandService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.brandId = Number(idParam);
      this.load();
    }
  }

  load(): void {
    if (!this.brandId) return;
    this.loading.set(true);
    this.brandService.get(this.brandId).subscribe({
      next: (res) => {
        const brand = res.data as Brand;
        this.form = { brand_name: brand.brand_name };
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this brand.'));
      },
    });
  }

  save(): void {
    if (!this.form.brand_name.trim()) {
      this.toast.error('Brand name is required.');
      return;
    }
    this.saving.set(true);

    const payload = { brand_name: this.form.brand_name.trim() };
    const request = this.brandId
      ? this.brandService.update(this.brandId, payload)
      : this.brandService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.brandId ? 'Brand updated.' : 'Brand created.');
        this.router.navigate(['/brands']);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this brand.'));
      },
    });
  }
}
