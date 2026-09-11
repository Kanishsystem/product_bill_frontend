import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Category } from '../../../core/models/category.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [RouterLink, Icon, EmptyState],
  templateUrl: './categories-list.html',
  styleUrl: './categories-list.scss',
})
export class CategoriesList implements OnInit {
  categories = signal<Category[]>([]);
  loading = signal(true);

  constructor(
    private categoryService: CategoryService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.categoryService.list().subscribe({
      next: (res) => {
        this.categories.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load categories.'));
      },
    });
  }

  async remove(category: Category): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${category.category_name}"?`,
      text: 'Categories with products linked to them cannot be deleted.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!confirmed) {
      return;
    }
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.toast.success('Category deleted.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not delete this category.')),
    });
  }
}
