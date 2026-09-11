import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandService } from '../../../core/services/brand.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Brand } from '../../../core/models/brand.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-brands-list',
  standalone: true,
  imports: [RouterLink, Icon, EmptyState],
  templateUrl: './brands-list.html',
  styleUrl: './brands-list.scss',
})
export class BrandsList implements OnInit {
  brands = signal<Brand[]>([]);
  loading = signal(true);

  constructor(
    private brandService: BrandService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.brandService.list().subscribe({
      next: (res) => {
        this.brands.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load brands.'));
      },
    });
  }

  async remove(brand: Brand): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${brand.brand_name}"?`,
      text: 'Brands with products linked to them cannot be deleted.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!confirmed) {
      return;
    }
    this.brandService.delete(brand.id).subscribe({
      next: () => {
        this.toast.success('Brand deleted.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not delete this brand.')),
    });
  }
}
