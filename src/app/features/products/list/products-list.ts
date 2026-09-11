import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState],
  templateUrl: './products-list.html',
  styleUrl: './products-list.scss',
})
export class ProductsList implements OnInit {
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);

  search = '';
  categoryFilter: number | '' = '';

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.categoryService.list().subscribe({ next: (res) => this.categories.set(res.data ?? []) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.productService
      .list({
        search: this.search || undefined,
        category_id: this.categoryFilter || undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load products.'));
        },
      });
  }

  async remove(product: Product): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${product.name}"?`,
      text: 'Products with purchase/sale history cannot be deleted - set them to inactive instead.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.toast.success('Product deleted.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not delete this product.')),
    });
  }
}
