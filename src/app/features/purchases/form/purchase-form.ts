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
  /** The purchase_item id this line was loaded from, when editing (a plain
   * quantity line) - null for a brand-new line added during this edit, or
   * when creating a fresh purchase. Mutually exclusive with existingIds. */
  existingId: number | null;
  /** Same idea, for a legacy grouped multi-unit line (one id per unit/
   * serial, same order as `units`/`serials`) - see mapItemsToLines(). */
  existingIds: number[] | null;
  /** True once ANY unit/batch quantity this line brought into stock has
   * already been sold/returned/damaged (or partially drawn down) - the
   * fields below are then shown read-only and can't be saved changed; see
   * PurchaseService::update()'s doc comment for why. Always false for a
   * brand-new line. */
  locked: boolean;
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

  /** Mirrors PurchaseService::purchaseLineHasMoved(): checked first (and
   * permanently) is whether any sale has EVER referenced this line's stock
   * - a sale return restores stock_status/quantity back to normal but never
   * deletes the sale record it created, so a fully-returned line can look
   * completely untouched below while still being locked. Otherwise, a
   * serialized unit no longer in_stock, or a batch row whose remaining
   * stock_quantity no longer matches what this line originally purchased (a
   * PARTIAL sale - stock_status alone stays 'in_stock' for that case, so
   * stock_quantity is what actually catches it). */
  private itemHasMoved(item: PurchaseItem): boolean {
    if (item.stock_item_id === null) return false;
    // Explicit numeric/boolean check, not raw truthiness - has_sale_history
    // can arrive as the JSON boolean `false`, or (depending on the backend's
    // PDO driver/config) the string "0", which JS treats as truthy (only ""
    // is falsy). A bare `if (item.has_sale_history)` there made every line
    // - including a brand-new, never-sold one - look already-sold on setups
    // where that happened. See PurchaseService::get()'s matching fix.
    if (item.has_sale_history === true || Number(item.has_sale_history) === 1) return true;
    const isSerialized = !!item.imei1 || !!item.serial_no;
    if (isSerialized) return item.stock_status !== 'in_stock';
    return item.stock_status !== 'in_stock' || Number(item.stock_quantity) !== Number(item.quantity);
  }

  private mapItemsToLines(items: PurchaseItem[]): LineDraft[] {
    const lines: LineDraft[] = [];
    for (const item of items) {
      const isImei = !!item.imei1;
      const isSerial = !isImei && !!item.serial_no;
      const moved = this.itemHasMoved(item);
      const last = lines[lines.length - 1];
      if (last && last.productId === item.product_id && (isImei || isSerial) && last.existingIds) {
        if (isImei) {
          last.units = [...last.units, { imei1: item.imei1 ?? '', imei2: item.imei2 ?? '' }];
        } else {
          last.serials = [...last.serials, item.serial_no ?? ''];
        }
        last.existingIds = [...last.existingIds, item.id];
        last.locked = last.locked || moved;
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
        existingId: isImei || isSerial ? null : item.id,
        existingIds: isImei || isSerial ? [item.id] : null,
        locked: moved,
      });
    }
    return lines.length > 0 ? lines : [this.blankLine()];
  }

  /** True once any line on this purchase already has stock sold/adjusted -
   * the Supplier field is disabled in that case (see save()/validate()'s
   * reasoning: a locked line's tax split is recomputed from the ORIGINAL
   * supplier's state, so changing suppliers now would mix two tax splits
   * under one purchase). Always false outside edit mode. */
  anyLineLocked(): boolean {
    return this.editMode() && this.lines().some((l) => l.locked);
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
      existingId: null,
      existingIds: null,
      locked: false,
    };
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, this.blankLine()]);
  }

  removeLine(index: number): void {
    const line = this.lines()[index];
    if (line?.locked) {
      this.toast.error("This line already has stock sold or adjusted from this purchase, so it can't be removed - add a new line instead for the correction.");
      return;
    }
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  onProductChange(line: LineDraft): void {
    if (line.locked) return;
    const product = this.products().find((p) => p.id === line.productId) ?? null;
    line.product = product;
    if (!product) return;

    line.hsnCode = product.hsn_sac_code;
    line.unit = product.unit_name ?? product.unit ?? 'Nos';
    line.gstRate = Number(product.tax_rate);
    line.rate = Number(product.base_price) || null;

    // Purchases no longer collect per-unit IMEI/Serial - the client wants a
    // plain quantity here for every category, IMEI/Serial included; that is
    // now typed in manually at sale time instead. A freshly (re)selected
    // product on this line always gets the simple quantity path. (Historical
    // lines loaded via mapItemsToLines() for editing an old purchase already
    // have their units/serials populated and never pass back through here.)
    line.units = [];
    line.serials = [];
    line.quantity = 1;
  }

  addUnit(line: LineDraft): void {
    if (line.locked) return;
    line.units = [...line.units, { imei1: '', imei2: '' }];
  }

  removeUnit(line: LineDraft, index: number): void {
    if (line.locked) return;
    line.units = line.units.filter((_, i) => i !== index);
  }

  addSerial(line: LineDraft): void {
    if (line.locked) return;
    line.serials = [...line.serials, ''];
  }

  removeSerial(line: LineDraft, index: number): void {
    if (line.locked) return;
    line.serials = line.serials.filter((_, i) => i !== index);
  }

  /** Client-side estimate only - the server computes the authoritative,
   * tax-split totals once the purchase is saved. Data-driven, not category-
   * flag-driven: a line only carries units/serials when it was loaded from a
   * historical purchase recorded before this change - a freshly selected
   * product (any category) always goes through the plain quantity field. */
  lineQuantity(line: LineDraft): number {
    if (line.units.length > 0) return line.units.length;
    if (line.serials.length > 0) return line.serials.length;
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

      // Data-driven: only a line already carrying historical units/serials
      // (loaded from an old purchase for editing) is validated as such - a
      // fresh line, whatever the product's category, just needs a quantity.
      if (line.units.length > 0) {
        const imeis = new Set<string>();
        for (const u of line.units) {
          if (!u.imei1.trim()) return `Line ${n}: IMEI1 is required for every unit.`;
          if (imeis.has(u.imei1.trim())) return `Line ${n}: duplicate IMEI1 "${u.imei1.trim()}" in this purchase.`;
          imeis.add(u.imei1.trim());
        }
      } else if (line.serials.length > 0) {
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
      // Data-driven, same reasoning as validate() above.
      if (line.units.length > 0) {
        item.units = line.units.map((u) => ({
          imei1: u.imei1.trim(),
          imei2: u.imei2.trim() || undefined,
        }));
      } else if (line.serials.length > 0) {
        item.serials = line.serials.map((s) => s.trim());
      } else {
        item.quantity = line.quantity;
      }
      // Ties this line back to the purchase_item(s) it was loaded from, so
      // the server can tell "unchanged locked line" from "brand-new line"
      // from "edited unmoved line" - see PurchaseService::update(). A
      // brand-new line added during this edit has neither, and is always
      // insertable regardless of what else on this purchase has moved.
      if (this.editMode()) {
        if (line.existingId !== null) item.id = line.existingId;
        else if (line.existingIds !== null) item.ids = line.existingIds;
      }
      return item;
    });

    if (this.editMode() && this.editPurchaseId) {
      if (this.anyLineLocked() && this.form.supplier_id !== this.editOriginalPurchase()?.supplier_id) {
        this.toast.error("Some stock from this purchase has already moved, so the supplier can't be changed now.");
        return;
      }
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
