import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { AttributeType, Category, CategoryAttribute } from '../../../core/models/category.model';
import { Icon } from '../../../shared/components/icon/icon';

interface AttributeDraft {
  id: number | null;
  attribute_name: string;
  attribute_type: AttributeType;
  optionsText: string;
  is_required: boolean;
  saving?: boolean;
}

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './category-form.html',
  styleUrl: './category-form.scss',
})
export class CategoryForm implements OnInit {
  categoryId: number | null = null;
  loading = signal(false);
  saving = signal(false);

  form = {
    category_name: '',
    sub_category: '',
    is_imei_required: false,
    is_serial_required: false,
    size_type: '' as '' | 'Big' | 'Small',
  };

  attributes = signal<AttributeDraft[]>([]);
  newAttribute: AttributeDraft = this.blankAttribute();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.categoryId = Number(idParam);
      this.load();
    }
  }

  private blankAttribute(): AttributeDraft {
    return { id: null, attribute_name: '', attribute_type: 'text', optionsText: '', is_required: false };
  }

  load(): void {
    if (!this.categoryId) return;
    this.loading.set(true);
    this.categoryService.get(this.categoryId).subscribe({
      next: (res) => {
        const cat = res.data as Category;
        this.form = {
          category_name: cat.category_name,
          sub_category: cat.sub_category ?? '',
          is_imei_required: !!cat.is_imei_required,
          is_serial_required: !!cat.is_serial_required,
          size_type: (cat.size_type ?? '') as '' | 'Big' | 'Small',
        };
        this.attributes.set(cat.attributes.map((a) => this.toDraft(a)));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this category.'));
      },
    });
  }

  private toDraft(a: CategoryAttribute): AttributeDraft {
    return {
      id: a.id,
      attribute_name: a.attribute_name,
      attribute_type: a.attribute_type,
      optionsText: (a.options ?? []).join(', '),
      is_required: !!a.is_required,
    };
  }

  save(): void {
    if (!this.form.category_name.trim()) {
      this.toast.error('Category name is required.');
      return;
    }
    this.saving.set(true);

    const payload = {
      category_name: this.form.category_name.trim(),
      sub_category: this.form.sub_category.trim() || null,
      is_imei_required: this.form.is_imei_required,
      is_serial_required: this.form.is_serial_required,
      size_type: this.form.size_type || null,
    };

    const request = this.categoryId
      ? this.categoryService.update(this.categoryId, payload)
      : this.categoryService.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(this.categoryId ? 'Category updated.' : 'Category created.');
        const id = this.categoryId ?? (res.data as Category)?.id;
        if (id) {
          this.router.navigate(['/categories', id, 'edit']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this category.'));
      },
    });
  }

  addAttribute(): void {
    if (!this.categoryId) {
      this.toast.error('Save the category first, then add its attributes.');
      return;
    }
    if (!this.newAttribute.attribute_name.trim()) {
      this.toast.error('Attribute name is required.');
      return;
    }
    const options = this.parseOptions(this.newAttribute.optionsText);
    if (this.newAttribute.attribute_type === 'select' && options.length === 0) {
      this.toast.error('Add at least one option for a select attribute.');
      return;
    }

    this.categoryService
      .addAttribute({
        category_id: this.categoryId,
        attribute_name: this.newAttribute.attribute_name.trim(),
        attribute_type: this.newAttribute.attribute_type,
        options,
        is_required: this.newAttribute.is_required,
      })
      .subscribe({
        next: () => {
          this.toast.success('Attribute added.');
          this.newAttribute = this.blankAttribute();
          this.load();
        },
        error: (err) => this.toast.error(extractErrorMessage(err, 'Could not add this attribute.')),
      });
  }

  private parseOptions(text: string): string[] {
    return text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async removeAttribute(attr: AttributeDraft): Promise<void> {
    if (!attr.id) return;
    const confirmed = await this.toast.confirm({
      title: `Remove attribute "${attr.attribute_name}"?`,
      danger: true,
      confirmText: 'Remove',
    });
    if (!confirmed) return;

    this.categoryService.deleteAttribute(attr.id).subscribe({
      next: () => {
        this.toast.success('Attribute removed.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not remove this attribute.')),
    });
  }
}
