import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ProductService } from '../../../core/services/product.service';
import { PartyService } from '../../../core/services/party.service';
import { CategoryService } from '../../../core/services/category.service';
import { BrandService } from '../../../core/services/brand.service';
import { UnitService } from '../../../core/services/unit.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { exGstFromInclusive, sellingPriceFromProfit } from '../../../core/utils/money';
import { Product } from '../../../core/models/product.model';
import { Party } from '../../../core/models/party.model';
import { Category } from '../../../core/models/category.model';
import { Brand } from '../../../core/models/brand.model';
import { Unit } from '../../../core/models/unit.model';
import {
  Purchase,
  PurchaseCreateInput,
  PurchaseItem,
  PurchaseItemInput,
  PurchasePaymentMode,
  PurchaseUpdateInput,
} from '../../../core/models/purchase.model';
import { Icon } from '../../../shared/components/icon/icon';

/** One row in the Items table. Whether it collects `units`, `serials`, or a
 * plain `quantity` is driven entirely by the selected product's category
 * flags - mirrors PurchaseService::buildLineRows() on the backend.
 * `productSearch` is this row's own type-to-search text, independent of
 * every other row's. */
interface LineDraft {
  productId: number | null;
  product: Product | null;
  productSearch: string;
  rate: number | null;
  discountPercent: number;
  gstRate: number | null;
  hsnCode: string;
  unit: string;
  units: { imei1: string; imei2: string }[];
  serials: string[];
  quantity: number;
}

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, DecimalPipe],
  templateUrl: './purchase-form.html',
  styleUrl: './purchase-form.scss',
})
export class PurchaseForm implements OnInit {
  saving = signal(false);

  /** Set when this screen is reached via /purchases/:id/edit instead of
   * /purchases/new - swaps the save flow for an in-place update() call and
   * hides the payment-collection UI (amount_paid is never touched by an
   * edit, only by the purchase detail page's own Record Payment card). The
   * server blocks the actual save if any of this purchase's stock has
   * already moved (sold/returned/damaged) - see PurchaseService::update(). */
  editMode = signal(false);
  editPurchaseId: number | null = null;
  editOriginalPurchase = signal<Purchase | null>(null);
  loadingForEdit = signal(false);

  suppliers = signal<Party[]>([]);
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);
  units = signal<Unit[]>([]);

  form = {
    supplier_id: null as number | null,
    supplier_invoice_no: '',
    purchase_date: new Date().toISOString().slice(0, 10),
  };

  paymentMode: PurchasePaymentMode = 'cash';
  /** Bound to the Amount Paid `<input type="number">`. Angular's
   * NumberValueAccessor writes back a real JS number (or null) the moment
   * the user types - only ever a string when we set it ourselves ('' or a
   * `.toFixed(2)`). Never call `.trim()` on this directly - use
   * `amountPaidEntered()` below (same gotcha as billing.ts's Cash Received
   * field, and sale-detail.ts's Record Payment amount field). */
  amountPaidText: string | number | null = '';

  supplierSearch = '';
  supplierDropdownOpen = signal(false);

  /** Which line's product dropdown is currently open, if any - only one at
   * a time, so a plain index is enough (no per-line signal needed). */
  openProductDropdownIndex = signal<number | null>(null);

  lines = signal<LineDraft[]>([this.blankLine()]);

  // ---- "+ " quick-add modals (Supplier / Product) - both stay on this same
  // screen so an in-progress purchase (other lines, IMEIs/serials already
  // typed) is never lost, unlike navigating away to /parties/new or
  // /products/new. ----

  showSupplierModal = signal(false);
  savingSupplierModal = signal(false);
  supplierModalForm = { name: '', phone: '', gstin: '', address: '' };

  showProductModal = signal(false);
  savingProductModal = signal(false);
  /** Which line's "+" opened the product modal, so the newly-created product
   * can be selected straight into that row once it's saved. */
  private productModalLineIndex: number | null = null;
  productModalForm = {
    name: '',
    category_id: '' as number | '',
    brand_id: null as number | null,
    unit_id: null as number | null,
    /** GST-inclusive - converted down to an ex-GST base_price on submit, same
     * as the standalone Product form (see core/utils/money.ts). */
    purchase_price: null as number | null,
    /** Optional markup - when set, auto-fills selling_price; left blank,
     * selling_price is just typed in directly as before. */
    profit_percent: null as number | null,
    selling_price: null as number | null,
    tax_rate: 18 as number | null,
    hsn_sac_code: '',
    barcode: '',
  };

  // ---- Add Category / Brand / Unit quick-add modals, nested inside the Add
  // Product modal so a brand-new category/brand/unit never requires leaving
  // this half-filled purchase. ----

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
    private router: Router,
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private partyService: PartyService,
    private categoryService: CategoryService,
    private brandService: BrandService,
    private unitService: UnitService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editMode.set(true);
      this.editPurchaseId = Number(idParam);
    }

    this.partyService.list({ party_type: 'supplier' }).subscribe({
      next: (res) => this.suppliers.set(res.data ?? []),
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load suppliers.')),
    });
    // Products need to be loaded before mapping an existing purchase's items
    // back into line drafts (each line's product/productSearch is looked up
    // from this catalog) - load the purchase only once it's in.
    this.productService.list({ status: 'active' }).subscribe({
      next: (res) => {
        this.products.set(res.data ?? []);
        if (this.editMode() && this.editPurchaseId) {
          this.loadForEdit(this.editPurchaseId);
        }
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load products.')),
    });
    this.categoryService.list().subscribe({
      next: (res) => this.categories.set(res.data ?? []),
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load categories.')),
    });
    this.brandService.list().subscribe({
      next: (res) => this.brands.set(res.data ?? []),
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load brands.')),
    });
    this.unitService.list().subscribe({
      next: (res) => this.units.set(res.data ?? []),
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load units.')),
    });
  }

  /** Loads an already-saved purchase and rebuilds the on-screen item lines
   * from it, so this same table can be used to fix a mistake instead of
   * only ever recording a fresh purchase. Called once products() is loaded -
   * see ngOnInit. Purchase items are stored one row per physical unit (see
   * PurchaseService::buildLineRows()), so consecutive same-product IMEI/
   * Serial rows are re-grouped back into the one line they were originally
   * entered as. */
  private loadForEdit(id: number): void {
    this.loadingForEdit.set(true);
    this.purchaseService.get(id).subscribe({
      next: (res) => {
        this.loadingForEdit.set(false);
        const purchase = res.data;
        if (!purchase) {
          this.toast.error('This purchase could not be found.');
          return;
        }
        const anyMoved = (purchase.items ?? []).some((i) => i.stock_status !== 'in_stock');
        if (anyMoved) {
          this.toast.error(
            "Some stock from this purchase has already moved (sold/returned/damaged) - saving changes here may be blocked. Record a correction purchase instead if that happens.",
          );
        }
        this.editOriginalPurchase.set(purchase);
        this.form = {
          supplier_id: purchase.supplier_id,
          supplier_invoice_no: purchase.supplier_invoice_no,
          purchase_date: purchase.purchase_date,
        };
        this.supplierSearch = purchase.supplier_name;
        this.paymentMode = purchase.payment_mode;
        this.lines.set(this.mapItemsToLines(purchase.items ?? []));
      },
      error: (err) => {
        this.loadingForEdit.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this purchase.'));
        this.router.navigate(['/purchases']);
      },
    });
  }

  private mapItemsToLines(items: PurchaseItem[]): LineDraft[] {
    const lines: LineDraft[] = [];
    for (const item of items) {
      const isImei = !!item.imei1;
      const isSerial = !isImei && !!item.serial_no;
      const last = lines[lines.length - 1];
      if (last && last.productId === item.product_id && (isImei || isSerial)) {
        if (isImei) {
          last.units = [...last.units, { imei1: item.imei1 ?? '', imei2: item.imei2 ?? '' }];
        } else {
          last.serials = [...last.serials, item.serial_no ?? ''];
        }
        continue;
      }
      const product = this.products().find((p) => p.id === item.product_id) ?? null;
      lines.push({
        productId: item.product_id,
        product,
        productSearch: product ? this.productDisplay(product) : item.product_name,
        rate: Number(item.rate),
        discountPercent: Number(item.discount_percent) || 0,
        gstRate: Number(item.gst_rate),
        hsnCode: item.hsn_sac_code ?? '',
        unit: item.unit ?? 'Nos',
        units: isImei ? [{ imei1: item.imei1 ?? '', imei2: item.imei2 ?? '' }] : [],
        serials: isSerial ? [item.serial_no ?? ''] : [],
        quantity: isImei || isSerial ? 1 : Number(item.quantity) || 1,
      });
    }
    return lines.length > 0 ? lines : [this.blankLine()];
  }

  /** Ex-GST cost derived from the Add Product modal's GST-inclusive Purchase
   * Price field - what actually gets stored as the new product's base_price. */
  get productModalExGstBasePrice(): number {
    return exGstFromInclusive(this.productModalForm.purchase_price ?? 0, this.productModalForm.tax_rate ?? 0);
  }

  /** Recomputes the modal's Selling Price from the GST-inclusive Purchase
   * Price + profit % - Selling Price is GST-inclusive too: selling price =
   * purchase price * (1 + profit%/100). Does nothing if Profit % is blank,
   * so a manually-typed selling price is left alone. */
  recomputeModalSellingPrice(): void {
    if (this.productModalForm.profit_percent === null || this.productModalForm.profit_percent === undefined) return;
    this.productModalForm.selling_price = sellingPriceFromProfit(
      this.productModalForm.purchase_price ?? 0,
      this.productModalForm.profit_percent,
    );
  }

  private defaultUnitId(): number | null {
    const nos = this.units().find((u) => u.unit_name.toLowerCase() === 'nos');
    return nos ? nos.id : null;
  }

  // ---- Add Supplier modal ----

  openSupplierModal(): void {
    this.supplierModalForm = { name: this.supplierSearch.trim(), phone: '', gstin: '', address: '' };
    this.showSupplierModal.set(true);
  }

  closeSupplierModal(): void {
    this.showSupplierModal.set(false);
  }

  submitSupplierModal(): void {
    const name = this.supplierModalForm.name.trim();
    if (!name) {
      this.toast.error('Supplier name is required.');
      return;
    }
    this.savingSupplierModal.set(true);
    this.partyService
      .create({
        party_type: 'supplier',
        name,
        phone: this.supplierModalForm.phone.trim() || null,
        gstin: this.supplierModalForm.gstin.trim() || null,
        address: this.supplierModalForm.address.trim() || null,
      })
      .subscribe({
        next: (res) => {
          this.savingSupplierModal.set(false);
          const created = res.data as Party;
          this.suppliers.update((rows) => [...rows, created]);
          this.selectSupplier(created);
          this.showSupplierModal.set(false);
          this.toast.success(`Supplier "${created.name}" added.`);
        },
        error: (err) => {
          this.savingSupplierModal.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not create this supplier.'));
        },
      });
  }

  // ---- Add Product modal ----

  openProductModal(lineIndex: number): void {
    const line = this.lines()[lineIndex];
    this.productModalLineIndex = lineIndex;
    this.productModalForm = {
      name: line?.productSearch.trim() ?? '',
      category_id: '',
      brand_id: null,
      unit_id: this.defaultUnitId(),
      purchase_price: null,
      profit_percent: null,
      selling_price: null,
      tax_rate: 18,
      hsn_sac_code: '',
      barcode: '',
    };
    this.showProductModal.set(true);
  }

  closeProductModal(): void {
    this.showProductModal.set(false);
  }

  submitProductModal(): void {
    const f = this.productModalForm;
    if (!f.name.trim() || !f.category_id) {
      this.toast.error('Product name and category are required.');
      return;
    }
    if (!f.hsn_sac_code.trim()) {
      this.toast.error('HSN/SAC code is required.');
      return;
    }
    if (f.selling_price === null || f.tax_rate === null) {
      this.toast.error('Selling price and GST % are required.');
      return;
    }
    this.savingProductModal.set(true);
    this.productService
      .create({
        name: f.name.trim(),
        category_id: f.category_id as number,
        brand_id: f.brand_id ?? null,
        base_price: this.productModalExGstBasePrice,
        selling_price: f.selling_price,
        tax_rate: f.tax_rate,
        hsn_sac_code: f.hsn_sac_code.trim(),
        barcode: f.barcode.trim() || null,
        unit_id: f.unit_id ?? null,
        status: 'active',
        attributes: {},
      })
      .subscribe({
        next: (res) => {
          this.savingProductModal.set(false);
          const created = res.data as Product;
          this.products.update((rows) => [...rows, created]);
          if (this.productModalLineIndex !== null) {
            const line = this.lines()[this.productModalLineIndex];
            if (line) this.selectProductForLine(line, created);
          }
          this.showProductModal.set(false);
          this.toast.success(`Product "${created.name}" added.`);
        },
        error: (err) => {
          this.savingProductModal.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not create this product.'));
        },
      });
  }

  // ---- Add Category modal (nested inside Add Product) ----

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
          this.productModalForm.category_id = created.id;
          this.showCategoryModal.set(false);
          this.toast.success(`Category "${created.category_name}" added.`);
        },
        error: (err) => {
          this.savingCategoryModal.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not create this category.'));
        },
      });
  }

  // ---- Add Brand modal (nested inside Add Product) ----

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
        this.productModalForm.brand_id = created.id;
        this.showBrandModal.set(false);
        this.toast.success(`Brand "${created.brand_name}" added.`);
      },
      error: (err) => {
        this.savingBrandModal.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not create this brand.'));
      },
    });
  }

  // ---- Add Unit modal (nested inside Add Product) ----

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
        this.productModalForm.unit_id = created.id;
        this.showUnitModal.set(false);
        this.toast.success(`Unit "${created.unit_name}" added.`);
      },
      error: (err) => {
        this.savingUnitModal.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not create this unit.'));
      },
    });
  }

  // ---- Supplier combobox (type-to-search over the already-loaded list) ----

  supplierDisplay(s: Party): string {
    return s.name + (s.phone ? ' — ' + s.phone : '');
  }

  filteredSuppliers(): Party[] {
    const q = this.supplierSearch.trim().toLowerCase();
    if (!q) return this.suppliers();
    return this.suppliers().filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone ?? '').toLowerCase().includes(q),
    );
  }

  onSupplierSearchChange(): void {
    this.supplierDropdownOpen.set(true);
    if (this.form.supplier_id !== null) {
      const current = this.suppliers().find((s) => s.id === this.form.supplier_id);
      if (!current || this.supplierDisplay(current) !== this.supplierSearch) {
        this.form.supplier_id = null;
      }
    }
  }

  openSupplierDropdown(): void {
    this.supplierDropdownOpen.set(true);
  }

  onSupplierBlur(): void {
    setTimeout(() => this.supplierDropdownOpen.set(false), 150);
  }

  selectSupplier(s: Party): void {
    this.form.supplier_id = s.id;
    this.supplierSearch = this.supplierDisplay(s);
    this.supplierDropdownOpen.set(false);
  }

  // ---- Product combobox, one independent instance per row ----

  productDisplay(p: Product): string {
    return p.name + (p.category_name ? ' (' + p.category_name + ')' : '');
  }

  filteredProducts(line: LineDraft): Product[] {
    const q = line.productSearch.trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand_name ?? '').toLowerCase().includes(q) ||
        (p.hsn_sac_code ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }

  onProductSearchChange(line: LineDraft, i: number): void {
    this.openProductDropdownIndex.set(i);
    if (line.productId !== null && line.product && this.productDisplay(line.product) !== line.productSearch) {
      line.productId = null;
      line.product = null;
    }
  }

  openProductDropdown(i: number): void {
    this.openProductDropdownIndex.set(i);
  }

  onProductBlur(): void {
    setTimeout(() => this.openProductDropdownIndex.set(null), 150);
  }

  isProductDropdownOpen(i: number): boolean {
    return this.openProductDropdownIndex() === i;
  }

  selectProductForLine(line: LineDraft, product: Product): void {
    line.productId = product.id;
    line.productSearch = this.productDisplay(product);
    this.openProductDropdownIndex.set(null);
    this.onProductChange(line);
  }

  private blankLine(): LineDraft {
    return {
      productId: null,
      product: null,
      productSearch: '',
      rate: null,
      discountPercent: 0,
      gstRate: null,
      hsnCode: '',
      unit: 'Nos',
      units: [],
      serials: [],
      quantity: 1,
    };
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, this.blankLine()]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  onProductChange(line: LineDraft): void {
    const product = this.products().find((p) => p.id === line.productId) ?? null;
    line.product = product;
    if (!product) return;

    line.hsnCode = product.hsn_sac_code;
    line.unit = product.unit_name ?? product.unit ?? 'Nos';
    line.gstRate = Number(product.tax_rate);
    line.rate = Number(product.base_price) || null;

    if (product.is_imei_required) {
      line.units = [{ imei1: '', imei2: '' }];
      line.serials = [];
    } else if (product.is_serial_required) {
      line.serials = [''];
      line.units = [];
    } else {
      line.units = [];
      line.serials = [];
      line.quantity = 1;
    }
  }

  addUnit(line: LineDraft): void {
    line.units = [...line.units, { imei1: '', imei2: '' }];
  }

  removeUnit(line: LineDraft, index: number): void {
    line.units = line.units.filter((_, i) => i !== index);
  }

  addSerial(line: LineDraft): void {
    line.serials = [...line.serials, ''];
  }

  removeSerial(line: LineDraft, index: number): void {
    line.serials = line.serials.filter((_, i) => i !== index);
  }

  /** Client-side estimate only - the server computes the authoritative,
   * tax-split totals once the purchase is saved. */
  lineQuantity(line: LineDraft): number {
    if (line.product?.is_imei_required) return line.units.length;
    if (line.product?.is_serial_required) return line.serials.length;
    return line.quantity || 0;
  }

  lineTaxableAmount(line: LineDraft): number {
    const rate = Number(line.rate) || 0;
    const discount = Number(line.discountPercent) || 0;
    const salePrice = rate * (1 - discount / 100);
    return salePrice * this.lineQuantity(line);
  }

  lineGstAmount(line: LineDraft): number {
    const gst = Number(line.gstRate) || 0;
    return this.lineTaxableAmount(line) * (gst / 100);
  }

  lineEstimatedTotal(line: LineDraft): number {
    return this.lineTaxableAmount(line) + this.lineGstAmount(line);
  }

  subtotalExclGst(): number {
    return this.lines().reduce((sum, line) => sum + this.lineTaxableAmount(line), 0);
  }

  grandEstimatedTotal(): number {
    return this.lines().reduce((sum, line) => sum + this.lineEstimatedTotal(line), 0);
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  setPaymentMode(mode: PurchasePaymentMode): void {
    this.paymentMode = mode;
  }

  useFullAmount(): void {
    this.amountPaidText = this.grandEstimatedTotal().toFixed(2);
  }

  /** True once the user has typed/set SOME value into Amount Paid - see the
   * NumberValueAccessor note on amountPaidText above. */
  amountPaidEntered(): boolean {
    return this.amountPaidText !== '' && this.amountPaidText !== null && this.amountPaidText !== undefined;
  }

  /** Client-side estimate only. Amount Paid is now a required field on a
   * new purchase (validate() blocks submission while it's blank), so this
   * only ever sees a real entered value here - "blank" no longer reaches
   * save(). */
  balanceDueEstimate(): number {
    if (!this.amountPaidEntered()) return 0;
    const paid = Number(this.amountPaidText) || 0;
    const due = this.grandEstimatedTotal() - paid;
    return due > 0 ? due : 0;
  }

  private validate(): string | null {
    if (!this.form.supplier_id) return 'Select a supplier.';
    if (!this.form.supplier_invoice_no.trim()) return "Supplier's invoice number is required.";
    if (!this.form.purchase_date) return 'Purchase date is required.';
    if (!this.editMode() && !this.amountPaidEntered()) {
      return 'Amount Paid is required - enter what was actually paid, or click Full for the full amount.';
    }
    if (this.lines().length === 0) return 'Add at least one line item.';

    for (const [i, line] of this.lines().entries()) {
      const n = i + 1;
      if (!line.productId) return `Line ${n}: select a product.`;
      if (line.rate === null || line.rate < 0) return `Line ${n}: enter a valid rate.`;

      if (line.product?.is_imei_required) {
        if (line.units.length === 0) return `Line ${n}: add at least one IMEI unit.`;
        const imeis = new Set<string>();
        for (const u of line.units) {
          if (!u.imei1.trim()) return `Line ${n}: IMEI1 is required for every unit.`;
          if (imeis.has(u.imei1.trim())) return `Line ${n}: duplicate IMEI1 "${u.imei1.trim()}" in this purchase.`;
          imeis.add(u.imei1.trim());
        }
      } else if (line.product?.is_serial_required) {
        if (line.serials.length === 0) return `Line ${n}: add at least one serial number.`;
        for (const s of line.serials) {
          if (!s.trim()) return `Line ${n}: serial number cannot be blank.`;
        }
      } else if (!line.quantity || line.quantity <= 0) {
        return `Line ${n}: quantity must be greater than 0.`;
      }
    }
    return null;
  }

  save(): void {
    const error = this.validate();
    if (error) {
      this.toast.error(error);
      return;
    }

    const items: PurchaseItemInput[] = this.lines().map((line) => {
      const item: PurchaseItemInput = {
        product_id: line.productId as number,
        rate: Number(line.rate),
        discount_percent: line.discountPercent || 0,
        gst_rate: line.gstRate ?? undefined,
        hsn_sac_code: line.hsnCode || undefined,
        unit: line.unit || undefined,
      };
      if (line.product?.is_imei_required) {
        item.units = line.units.map((u) => ({
          imei1: u.imei1.trim(),
          imei2: u.imei2.trim() || undefined,
        }));
      } else if (line.product?.is_serial_required) {
        item.serials = line.serials.map((s) => s.trim());
      } else {
        item.quantity = line.quantity;
      }
      return item;
    });

    if (this.editMode() && this.editPurchaseId) {
      const updatePayload: PurchaseUpdateInput = {
        id: this.editPurchaseId,
        supplier_id: this.form.supplier_id as number,
        supplier_invoice_no: this.form.supplier_invoice_no.trim(),
        purchase_date: this.form.purchase_date,
        payment_mode: this.paymentMode,
        items,
      };
      this.saving.set(true);
      this.purchaseService.update(updatePayload).subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(`Purchase updated — total ₹${res.data?.total_amount}.`);
          this.router.navigate(['/purchases', res.data?.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not save these changes.'));
        },
      });
      return;
    }

    const payload: PurchaseCreateInput = {
      supplier_id: this.form.supplier_id as number,
      supplier_invoice_no: this.form.supplier_invoice_no.trim(),
      purchase_date: this.form.purchase_date,
      payment_mode: this.paymentMode,
      items,
    };
    if (this.amountPaidEntered()) {
      payload.amount_paid = Number(this.amountPaidText);
    }

    this.saving.set(true);
    this.purchaseService.create(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Purchase recorded — total ₹${res.data?.total_amount}.`);
        this.router.navigate(['/purchases', res.data?.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not save this purchase.'));
      },
    });
  }
}
