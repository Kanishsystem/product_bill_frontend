import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { BrandService } from '../../../core/services/brand.service';
import { UnitService } from '../../../core/services/unit.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { exGstFromInclusive, inclusiveFromExGst, profitPercentFromPrices, sellingPriceFromProfit } from '../../../core/utils/money';
import { Category } from '../../../core/models/category.model';
import { Brand } from '../../../core/models/brand.model';
import { Unit } from '../../../core/models/unit.model';
import { Product } from '../../../core/models/product.model';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm implements OnInit {
  productId: number | null = null;
  loading = signal(false);
  saving = signal(false);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);
  units = signal<Unit[]>([]);

  form: {
    name: string;
    category_id: number | '';
    brand_id: number | null;
    unit_id: number | null;
    /** GST-inclusive - what the user actually paid/pays per unit. Converted
     * down to an ex-GST base_price on save (purchase-line GST math elsewhere
     * in the app needs base_price to stay ex-GST - see core/utils/money.ts). */
    purchase_price: number | null;
    /** When set, selling_price auto-fills from purchase_price + this markup;
     * left blank, selling_price is just a plain manually-typed field like
     * before. Editing selling_price by hand always works either way - it
     * only gets recalculated the next time purchase price/GST%/profit% change. */
    profit_percent: number | null;
    selling_price: number | null;
    tax_rate: number | null;
    hsn_sac_code: string;
    barcode: string;
    status: 'active' | 'inactive';
  } = {
    name: '',
    category_id: '',
    brand_id: null,
    unit_id: null,
    purchase_price: null,
    profit_percent: null,
    selling_price: null,
    tax_rate: 18,
    hsn_sac_code: '',
    barcode: '',
    status: 'active',
  };

  /** Dynamic attribute values keyed by attribute_name, rendered from the selected category's attribute list. */
  attributeValues: Record<string, string> = {};

  // ---- "+" quick-add modals for Category / Brand / Unit - mirrors the
  // pattern already used on the Purchase form's Add Product modal, so a
  // brand-new category/brand/unit can be created without losing this form. ----

  showCategoryModal = signal(false);
  savingCategoryModal = signal(false);
  categoryModalForm = {
    category_name: '',
    sub_category: '',
    is_imei_required: false,
    is_serial_required: false,
    size_type: '' as '' | 'Big' | 'Small',
  };

  showBrandModal = signal(false);
  savingBrandModal = signal(false);
  brandModalForm = { brand_name: '' };

  showUnitModal = signal(false);
  savingUnitModal = signal(false);
  unitModalForm = { unit_name: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private categoryService: CategoryService,
    private brandService: BrandService,
    private unitService: UnitService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.categoryService.list().subscribe({ next: (res) => this.categories.set(res.data ?? []) });
    this.brandService.list().subscribe({ next: (res) => this.brands.set(res.data ?? []) });
    this.unitService.list().subscribe({
      next: (res) => {
        const units = res.data ?? [];
        this.units.set(units);
        // Default a brand-new product to the "Nos" unit, same as the old
        // free-text field's DEFAULT 'Nos' - only if nothing's been picked yet.
        if (!this.productId && this.form.unit_id === null) {
          const nos = units.find((u) => u.unit_name.toLowerCase() === 'nos');
          if (nos) this.form.unit_id = nos.id;
        }
      },
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.productId = Number(idParam);
      this.load();
    }
  }

  get selectedCategory(): Category | undefined {
    return this.categories().find((c) => c.id === this.form.category_id);
  }

  /** Ex-GST cost, derived from the GST-inclusive Purchase Price field - this
   * is what actually gets stored as products.base_price. */
  get exGstBasePrice(): number {
    return exGstFromInclusive(this.form.purchase_price ?? 0, this.form.tax_rate ?? 0);
  }

  load(): void {
    if (!this.productId) return;
    this.loading.set(true);
    this.productService.get(this.productId).subscribe({
      next: (res) => {
        const p = res.data as Product;
        const baseExGst = Number(p.base_price) || 0;
        const taxRate = Number(p.tax_rate) || 0;
        const purchasePriceInclusive = inclusiveFromExGst(baseExGst, taxRate) || 0;
        this.form = {
          name: p.name,
          category_id: p.category_id,
          brand_id: p.brand_id ?? null,
          unit_id: p.unit_id ?? null,
          purchase_price: purchasePriceInclusive || null,
          // Profit % is now purchase-price-driven (GST-inclusive basis), not
          // ex-GST-cost-driven - see recomputeSellingPrice()/money.ts.
          profit_percent: profitPercentFromPrices(purchasePriceInclusive, Number(p.selling_price) || 0),
          selling_price: Number(p.selling_price) || 0,
          tax_rate: taxRate,
          hsn_sac_code: p.hsn_sac_code,
          barcode: p.barcode ?? '',
          status: p.status,
        };
        this.attributeValues = { ...(p.attributes ?? {}) };
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this product.'));
      },
    });
  }

  /** Recomputes Selling Price from the GST-inclusive Purchase Price + profit %
   * - called whenever Purchase Price or Profit % change. Selling Price is
   * GST-inclusive too: selling price = purchase price * (1 + profit%/100),
   * e.g. purchase 10000 + profit 10% = 11000. Does nothing if Profit % is
   * blank, so a purely manual selling price is left alone. */
  recomputeSellingPrice(): void {
    if (this.form.profit_percent === null || this.form.profit_percent === undefined) return;
    this.form.selling_price = sellingPriceFromProfit(this.form.purchase_price ?? 0, this.form.profit_percent);
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.category_id || !this.form.hsn_sac_code.trim()) {
      this.toast.error('Name, category and HSN/SAC code are required.');
      return;
    }
    if (this.form.selling_price === null || this.form.tax_rate === null) {
      this.toast.error('Selling price and GST % are required.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: this.form.name.trim(),
      category_id: this.form.category_id,
      brand_id: this.form.brand_id ?? null,
      base_price: this.exGstBasePrice,
      selling_price: this.form.selling_price,
      tax_rate: this.form.tax_rate,
      hsn_sac_code: this.form.hsn_sac_code.trim(),
      barcode: this.form.barcode.trim() || null,
      unit_id: this.form.unit_id ?? null,
      status: this.form.status,
      attributes: this.attributeValues,
    };

    const request = this.productId
      ? this.productService.update(this.productId, payload)
      : this.productService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.productId ? 'Product updated.' : 'Product created.');
        this.router.navigate(['/products']);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this product.'));
      },
    });
  }

  // ---- Add Category modal ----

  openCategoryModal(): void {
    this.categoryModalForm = {
      category_name: '',
      sub_category: '',
      is_imei_required: false,
      is_serial_required: false,
      size_type: '',
    };
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
  }

  submitCategoryModal(): void {
    const name = this.categoryModalForm.category_name.trim();
    if (!name) {
      this.toast.error('Category name is required.');
      return;
    }
    this.savingCategoryModal.set(true);
    this.categoryService
      .create({
        category_name: name,
        sub_category: this.categoryModalForm.sub_category.trim() || null,
        is_imei_required: this.categoryModalForm.is_imei_required,
        is_serial_required: this.categoryModalForm.is_serial_required,
        size_type: this.categoryModalForm.size_type || null,
      })
      .subscribe({
        next: (res) => {
          this.savingCategoryModal.set(false);
          const created = res.data as Category;
          this.categories.update((rows) => [...rows, created]);
          this.form.category_id = created.id;
          this.showCategoryModal.set(false);
          this.toast.success(`Category "${created.category_name}" added.`);
        },
        error: (err) => {
          this.savingCategoryModal.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not create this category.'));
        },
      });
  }

  // ---- Add Brand modal ----

  openBrandModal(): void {
    this.brandModalForm = { brand_name: '' };
    this.showBrandModal.set(true);
  }

  closeBrandModal(): void {
    this.showBrandModal.set(false);
  }

  submitBrandModal(): void {
    const name = this.brandModalForm.brand_name.trim();
    if (!name) {
      this.toast.error('Brand name is required.');
      return;
    }
    this.savingBrandModal.set(true);
    this.brandService.create({ brand_name: name }).subscribe({
      next: (res) => {
        this.savingBrandModal.set(false);
        const created = res.data as Brand;
        this.brands.update((rows) => [...rows, created]);
        this.form.brand_id = created.id;
        this.showBrandModal.set(false);
        this.toast.success(`Brand "${created.brand_name}" added.`);
      },
      error: (err) => {
        this.savingBrandModal.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not create this brand.'));
      },
    });
  }

  // ---- Add Unit modal ----

  openUnitModal(): void {
    this.unitModalForm = { unit_name: '' };
    this.showUnitModal.set(true);
  }

  closeUnitModal(): void {
    this.showUnitModal.set(false);
  }

  submitUnitModal(): void {
    const name = this.unitModalForm.unit_name.trim();
    if (!name) {
      this.toast.error('Unit name is required.');
      return;
    }
    this.savingUnitModal.set(true);
    this.unitService.create({ unit_name: name }).subscribe({
      next: (res) => {
        this.savingUnitModal.set(false);
        const created = res.data as Unit;
        this.units.update((rows) => [...rows, created]);
        this.form.unit_id = created.id;
        this.showUnitModal.set(false);
        this.toast.success(`Unit "${created.unit_name}" added.`);
      },
      error: (err) => {
        this.savingUnitModal.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not create this unit.'));
      },
    });
  }
}
