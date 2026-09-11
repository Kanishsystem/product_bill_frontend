import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SalesService } from '../../../core/services/sales.service';
import { StockService } from '../../../core/services/stock.service';
import { ProductService } from '../../../core/services/product.service';
import { PartyService } from '../../../core/services/party.service';
import { CompanyService } from '../../../core/services/company.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { exGstFromInclusiveExact, inclusiveFromExGst } from '../../../core/utils/money';
import { Product } from '../../../core/models/product.model';
import { Party } from '../../../core/models/party.model';
import { StockItem } from '../../../core/models/stock-item.model';
import { PaymentMode, SalesCreateInput, SalesInvoice, SalesItemInput, SalesUpdateInput } from '../../../core/models/sale.model';
import { Icon } from '../../../shared/components/icon/icon';

/** One row in the billing cart. Serialized items (isSerialized) carry the
 * exact stock_item_id picked via scan or manual pick - quantity is always 1
 * and can't be edited. Batch items carry an editable quantity; the server
 * is the final authority on whether that much is actually on hand.
 * discountPercent/warranty stay real fields (still sent to the server) but
 * are tucked behind a per-row "details" expander rather than shown inline,
 * to keep the main table as clean as the counter-friendly POS layout. */
interface CartLine {
  key: string;
  productId: number;
  productName: string;
  categoryName: string;
  brand: string | null;
  isSerialized: boolean;
  stockItemId: number | null;
  imei1: string | null;
  imei2: string | null;
  serialNo: string | null;
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  warrantyYears: number;
  warrantyMonths: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, DecimalPipe],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  saving = signal(false);

  /** Hard cap on distinct cart lines per invoice - matches the printed tax
   * invoice's own row budget (sale-detail.ts's MIN_PRINTED_ITEM_ROWS is the
   * same 5), so a bill built here is guaranteed to fit on one A5 page
   * instead of risking a 2nd-page spillover. A sale needing more than 5
   * products is meant to be split into a second invoice rather than
   * stretching one bill past what the paper size can hold. */
  private static readonly MAX_CART_LINES = 5;

  /** Set when this screen is reached via /sales/:id/edit instead of
   * /sales/new - swaps the checkout flow for an in-place update() call and
   * hides the payment-collection UI (amount_paid is never touched by an
   * edit, only by the invoice detail page's own Record Payment card). */
  editMode = signal(false);
  editInvoiceId: number | null = null;
  editInvoiceNo = signal<string | null>(null);
  /** The invoice as it was loaded, kept only to show the existing Amount
   * Paid/Balance Due as read-only context while editing - never written to. */
  editOriginalInvoice = signal<SalesInvoice | null>(null);
  loadingForEdit = signal(false);

  customers = signal<Party[]>([]);
  customerId: number | null = null;
  customerSearch = '';
  customerDropdownOpen = signal(false);
  /** What the dropdown actually filters by - separate from `customerSearch`
   * (the text shown in the input) so that opening the field via focus can
   * show the FULL customer list even though the box already displays
   * "Walk-in Customer" from the auto-selected default. Only typing updates
   * this - see onCustomerSearchChange()/openCustomerDropdown(). */
  private customerFilterQuery = '';
  invoiceDate = new Date().toISOString().slice(0, 10);
  paymentMode: PaymentMode = 'cash';
  showMorePaymentModes = signal(false);
  /** Bound to the Cash Received `<input type="number">`. Despite the name/
   * declared type, Angular's NumberValueAccessor writes back an actual JS
   * number (or null) here the moment the user TYPES into the field - it
   * only ever holds a string when we set it ourselves (`''` initially, or
   * `.toFixed(2)` from useFullAmount()). Never call `.trim()`/string methods
   * on this directly - use `amountPaidEntered()`/`amountPaidValue()` below,
   * which handle both shapes. (This mismatch used to throw
   * "amountPaidText.trim is not a function" the instant a real amount was
   * typed, silently breaking Checkout with no visible error to the user.) */
  amountPaidText: string | number | null = '';

  showQuickCustomer = signal(false);
  quickCustomerName = '';
  quickCustomerPhone = '';
  quickCustomerEmail = '';
  quickCustomerGstin = '';
  quickCustomerAddress = '';

  scanCode = '';
  scanning = signal(false);

  /** Whole product catalog, loaded once - the per-row combobox below filters
   * this client-side, mirroring the Purchase form's product row combobox. */
  products = signal<Product[]>([]);
  productSearch = '';
  productDropdownOpen = signal(false);

  pickerProduct = signal<Product | null>(null);
  pickerUnits = signal<StockItem[]>([]);
  pickerLoading = signal(false);

  cart = signal<CartLine[]>([]);

  /** Which cart line's Discount/Warranty details row is expanded, if any. */
  openDetailsKey = signal<string | null>(null);

  billDiscountPercent = 0;

  /** Shop's home state (Company Profile), loaded once here purely to preview
   * whether this bill will save as CGST+SGST or IGST - see taxType() below.
   * A signal (not a plain property) so its arrival repaints the Bill Summary
   * without needing a manual markForCheck() call, same as every other
   * HTTP-driven update on this zone.js-less page. Null until loaded, in
   * which case taxType() assumes the common CGST+SGST case rather than
   * guessing IGST. */
  homeStateCode = signal<string | null>(null);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private salesService: SalesService,
    private stockService: StockService,
    private productService: ProductService,
    private partyService: PartyService,
    private companyService: CompanyService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.companyService.get().subscribe({
      next: (res) => this.homeStateCode.set(res.data?.home_state_code ?? null),
      // Non-fatal: the Bill Summary just falls back to previewing CGST+SGST
      // (the common case for this shop) until the profile loads/retries.
      error: () => {},
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editMode.set(true);
      this.editInvoiceId = Number(idParam);
    }

    // Products need to be loaded before mapping an existing invoice's items
    // into cart lines (category/brand aren't returned by sales/get's item
    // join, so they're looked up from this already-loaded catalog instead) -
    // load the invoice only once this list is in.
    this.productService.list({ status: 'active' }).subscribe({
      next: (res) => {
        this.products.set(res.data ?? []);
        if (this.editMode() && this.editInvoiceId) {
          this.loadForEdit(this.editInvoiceId);
        }
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load products.')),
    });
  }

  /** Loads an already-saved invoice and rebuilds the on-screen cart from its
   * items, so the same POS-style table can be used to fix a mistake instead
   * of only ever creating a fresh bill. Called once products() is loaded -
   * see ngOnInit. */
  private loadForEdit(id: number): void {
    this.loadingForEdit.set(true);
    this.salesService.get(id).subscribe({
      next: (res) => {
        this.loadingForEdit.set(false);
        const inv = res.data;
        if (!inv) {
          this.toast.error('This invoice could not be found.');
          return;
        }
        if (inv.status !== 'completed') {
          this.toast.error('This invoice already has a returned item on it and can\'t be edited - record a fresh sale for any further correction instead.');
          this.router.navigate(['/sales', id]);
          return;
        }
        this.editOriginalInvoice.set(inv);
        this.editInvoiceNo.set(inv.invoice_no);
        this.customerId = inv.customer_id;
        this.customerSearch = inv.customer_name + (inv.customer_phone ? ' — ' + inv.customer_phone : '');
        this.invoiceDate = inv.invoice_date;
        this.paymentMode = inv.payment_mode;
        this.billDiscountPercent = Number(inv.bill_discount_percent) || 0;

        this.cart.set(
          (inv.items ?? []).map((item) => {
            const product = this.products().find((p) => p.id === item.product_id) ?? null;
            const isSerialized = !!(item.imei1 || item.serial_no);
            return {
              key: crypto.randomUUID(),
              productId: item.product_id,
              productName: item.product_name,
              categoryName: product?.category_name ?? '',
              brand: product?.brand_name ?? null,
              isSerialized,
              stockItemId: isSerialized ? item.stock_item_id : null,
              imei1: item.imei1,
              imei2: item.imei2,
              serialNo: item.serial_no,
              quantity: Number(item.quantity),
              // sales_invoice_items.rate is stored ex-GST, same basis
              // CartLine.rate always uses - no conversion needed here (only
              // the *display* getter/setter pair converts, same as any
              // other cart line).
              rate: Number(item.rate),
              discountPercent: Number(item.discount_percent) || 0,
              gstRate: Number(item.gst_rate),
              warrantyYears: Number(item.warranty_years) || 0,
              warrantyMonths: Number(item.warranty_months) || 0,
            };
          }),
        );
        // This runs off an HTTP response with no signal write of its own to
        // piggyback a repaint on for the plain (non-signal) customerSearch/
        // invoiceDate/paymentMode/billDiscountPercent properties just set
        // above - same zone.js-less gap as loadCustomers()' walk-in
        // auto-select (billing.ts item 15 in the project log).
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingForEdit.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this invoice.'));
        this.router.navigate(['/sales']);
      },
    });
  }

  loadCustomers(): void {
    this.partyService.list({ party_type: 'customer' }).subscribe({
      next: (res) => {
        this.customers.set(res.data ?? []);
        const walkIn = (res.data ?? []).find((c) => c.name.toLowerCase() === 'walk-in customer');
        // Never override a customer already loaded for edit - only a brand
        // new bill gets the walk-in default.
        if (!this.editMode() && !this.customerId && walkIn) {
          this.selectCustomer(walkIn);
        }
        // This runs off an HTTP response, not a template event, and this app
        // has no zone.js - so a plain-property write here (customerSearch,
        // set inside selectCustomer()) doesn't repaint on its own the way a
        // signal write or a (click)/(blur) handler would. Without this, the
        // Customer box silently stays blank until the very next click
        // anywhere on the page, even though customerId is already correct -
        // exactly the kind of stale-looking field this screen keeps getting
        // reported for.
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not load customers.')),
    });
  }

  customerDisplay(c: Party): string {
    return c.name + (c.phone ? ' — ' + c.phone : '');
  }

  /** Client-side filter over the already-loaded customer list - by name or
   * phone, case-insensitive. The full list is small enough for a retail
   * shop that a round trip to the server isn't worth it here. "Walk-in
   * Customer" is always pinned first when it's part of the result, so it's
   * the fastest thing to click back to regardless of where it sits in the
   * list the server returned. */
  filteredCustomers(): Party[] {
    const q = this.customerFilterQuery.trim().toLowerCase();
    const list = !q
      ? this.customers()
      : this.customers().filter(
          (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
        );
    const walkInIndex = list.findIndex((c) => c.name.toLowerCase() === 'walk-in customer');
    if (walkInIndex <= 0) return list;
    const walkIn = list[walkInIndex];
    return [walkIn, ...list.slice(0, walkInIndex), ...list.slice(walkInIndex + 1)];
  }

  onCustomerSearchChange(): void {
    this.customerFilterQuery = this.customerSearch;
    this.customerDropdownOpen.set(true);
    // Typing over a previously-selected customer clears the selection until
    // they pick a row again, so a stale customerId can't sneak into save().
    if (this.customerId !== null) {
      const current = this.customers().find((c) => c.id === this.customerId);
      if (!current || this.customerDisplay(current) !== this.customerSearch) {
        this.customerId = null;
      }
    }
  }

  /** Opening the field (a plain focus, not a keystroke) always browses the
   * FULL customer list - even though the box already shows "Walk-in
   * Customer" from the auto-selected default, that text shouldn't also
   * filter the dropdown down to just itself and force a redundant re-click
   * to keep the customer that's already selected. */
  openCustomerDropdown(): void {
    this.customerFilterQuery = '';
    this.customerDropdownOpen.set(true);
  }

  /** Slight delay so a click on a dropdown row registers before blur closes it. */
  onCustomerBlur(): void {
    setTimeout(() => this.customerDropdownOpen.set(false), 150);
  }

  selectCustomer(c: Party): void {
    this.customerId = c.id;
    this.customerSearch = this.customerDisplay(c);
    this.customerDropdownOpen.set(false);
  }

  /** The "×" button next to the Customer field - clears whatever's typed or
   * selected back to an empty box in one click, instead of backspacing a
   * name/phone out a character at a time (or being stuck looking at a
   * "No customers match" dropdown with no quick way out of it). Leaves the
   * field ready for a fresh focus, which reopens the full customer list per
   * openCustomerDropdown() above. */
  clearCustomerSelection(): void {
    this.customerId = null;
    this.customerSearch = '';
    this.customerFilterQuery = '';
  }

  addQuickCustomer(): void {
    if (!this.quickCustomerName.trim()) {
      this.toast.error('Name is required.');
      return;
    }
    this.partyService
      .quickCreate({
        name: this.quickCustomerName.trim(),
        phone: this.quickCustomerPhone.trim() || undefined,
        email: this.quickCustomerEmail.trim() || undefined,
        gstin: this.quickCustomerGstin.trim() || undefined,
        address: this.quickCustomerAddress.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.toast.success('Customer added.');
          this.quickCustomerName = '';
          this.quickCustomerPhone = '';
          this.quickCustomerEmail = '';
          this.quickCustomerGstin = '';
          this.quickCustomerAddress = '';
          this.showQuickCustomer.set(false);
          this.loadCustomers();
          if (res.data?.id) {
            this.customerId = res.data.id;
            this.customerSearch = this.customerDisplay(res.data);
          }
        },
        error: (err) => this.toast.error(extractErrorMessage(err, 'Could not add this customer.')),
      });
  }

  /** Barcode/keyboard-wedge scan or manual IMEI/Serial entry - the fast path
   * for serialized items at the billing counter. Tries stock (IMEI/Serial)
   * first, since that's the common case and identifies one exact physical
   * unit; only on a clean 404 there does it fall back to a product barcode
   * lookup, which identifies the *product* rather than a specific unit. */
  lookupScan(): void {
    const code = this.scanCode.trim();
    if (!code) return;
    if (this.cart().some((l) => l.imei1 === code || l.serialNo === code)) {
      this.toast.error('That unit is already in the cart.');
      return;
    }
    this.scanning.set(true);
    this.stockService.lookup(code).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.scanCode = '';
        const unit = res.data;
        if (!unit) return;
        this.addSerializedUnit(unit);
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.lookupScanByBarcode(code);
          return;
        }
        this.scanning.set(false);
        this.toast.error(extractErrorMessage(err, 'No in-stock unit found for that code.'));
      },
    });
  }

  private lookupScanByBarcode(code: string): void {
    this.productService.lookupByBarcode(code).subscribe({
      next: (res) => {
        this.scanning.set(false);
        const product = res.data;
        if (!product) return;
        this.scanCode = '';
        this.selectProduct(product);
      },
      error: (err) => {
        this.scanning.set(false);
        this.toast.error(extractErrorMessage(err, 'No in-stock unit or product found for that code.'));
      },
    });
  }

  /** Cosmetic only - camera-based live barcode scanning isn't built yet,
   * this just tells the counter operator to keep using the scanner gun or
   * type the code instead of leaving the button looking broken. */
  onCameraScanClick(): void {
    this.toast.error('Camera scanning is coming soon — use a scanner or type the code.');
  }

  // ---- Product row combobox (bottom "add item" row of the items table) ----

  productDisplay(p: Product): string {
    return p.name + (p.category_name ? ' (' + p.category_name + ')' : '');
  }

  filteredProducts(): Product[] {
    const q = this.productSearch.trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand_name ?? '').toLowerCase().includes(q) ||
        (p.hsn_sac_code ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }

  onProductSearchChange(): void {
    this.productDropdownOpen.set(true);
  }

  openProductDropdown(): void {
    this.productDropdownOpen.set(true);
    this.refreshProductStock();
  }

  /** Re-fetches the product catalog - including each product's on_hand
   * figure - every time the product-search box is opened. `products()` is
   * otherwise only loaded once, in ngOnInit (see the comment there): fine
   * for a single quick bill, but the Billing screen is the one a shop
   * clerk realistically leaves open across many customers all day, and
   * stock can change in the meantime from a Purchase entry or another
   * sale. Without this, the search dropdown's "N in stock"/"Out of stock"
   * badges (see follow-up #18) could go stale while the unit-picker's own
   * stock/ledger lookup (openPicker() -> stockService.ledger()) always
   * queries live - exactly the mismatch a user reported (dropdown said
   * "Out of stock" for a product that "Pick unit" then correctly listed 2
   * available units for). Deliberately a silent background refresh (no
   * loading spinner, errors swallowed) so opening the dropdown still feels
   * instant off the previous list and then quietly updates once the fresh
   * one lands, rather than blocking the search box on a network round
   * trip. Already-added cart lines are unaffected - they hold their own
   * copied fields, not a live reference into products(). */
  private refreshProductStock(): void {
    this.productService.list({ status: 'active' }).subscribe({
      next: (res) => this.products.set(res.data ?? this.products()),
      error: () => {},
    });
  }

  onProductBlur(): void {
    setTimeout(() => this.productDropdownOpen.set(false), 150);
  }

  /** For a batch (non-serialized) product, add straight to cart. For a
   * serialized one, open the unit picker instead of guessing which unit. */
  selectProduct(product: Product): void {
    this.productDropdownOpen.set(false);
    if (this.cartFull()) {
      this.toast.error(
        `This bill already has ${Billing.MAX_CART_LINES} items — the max for one invoice. Start a new bill for anything more.`,
      );
      return;
    }
    if (product.is_imei_required || product.is_serial_required) {
      this.openPicker(product);
      return;
    }
    this.cart.update((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        categoryName: product.category_name ?? '',
        brand: product.brand_name ?? null,
        isSerialized: false,
        stockItemId: null,
        imei1: null,
        imei2: null,
        serialNo: null,
        quantity: 1,
        // product.selling_price is GST-inclusive (the customer-facing price);
        // line.rate must stay ex-GST underneath (see lineRateInclusive() below
        // and lineTaxableAmount()/lineGstAmount()), so convert down once here.
        // Uses the *unrounded* conversion (exGstFromInclusiveExact) so the
        // round-trip back up for display lands exactly on the original
        // selling price instead of one paisa short - see money.ts.
        rate: exGstFromInclusiveExact(Number(product.selling_price), Number(product.tax_rate)),
        discountPercent: 0,
        gstRate: Number(product.tax_rate),
        warrantyYears: 0,
        warrantyMonths: 0,
      },
    ]);
    this.productSearch = '';
  }

  openPicker(product: Product): void {
    this.pickerProduct.set(product);
    this.pickerLoading.set(true);
    this.stockService.ledger({ product_id: product.id, status: 'in_stock' }).subscribe({
      next: (res) => {
        this.pickerLoading.set(false);
        this.pickerUnits.set(res.data ?? []);
      },
      error: (err) => {
        this.pickerLoading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load available units.'));
      },
    });
  }

  closePicker(): void {
    this.pickerProduct.set(null);
    this.pickerUnits.set([]);
  }

  pickUnit(unit: StockItem): void {
    this.addSerializedUnit(unit);
    this.closePicker();
    this.productSearch = '';
  }

  private addSerializedUnit(unit: StockItem): void {
    if (this.cart().some((l) => l.stockItemId === unit.id)) {
      this.toast.error('That unit is already in the cart.');
      return;
    }
    if (this.cartFull()) {
      this.toast.error(
        `This bill already has ${Billing.MAX_CART_LINES} items — the max for one invoice. Start a new bill for anything more.`,
      );
      return;
    }
    const product = this.products().find((p) => p.id === unit.product_id) ?? null;
    this.cart.update((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        productId: unit.product_id,
        productName: unit.product_name,
        categoryName: unit.category_name,
        brand: product?.brand_name ?? null,
        isSerialized: true,
        stockItemId: unit.id,
        imei1: unit.imei1,
        imei2: unit.imei2,
        serialNo: unit.serial_no,
        quantity: 1,
        // unit.selling_price (the stock snapshot) is GST-inclusive, same as
        // product.selling_price above - convert down to ex-GST for line.rate,
        // unrounded (see exGstFromInclusiveExact's doc comment in money.ts).
        rate: exGstFromInclusiveExact(Number(unit.selling_price), Number(product?.tax_rate) || 18),
        discountPercent: 0,
        gstRate: Number(product?.tax_rate) || 18,
        warrantyYears: 0,
        warrantyMonths: 0,
      },
    ]);
  }

  /** True once the cart already holds the max line count (see
   * MAX_CART_LINES) - both the product-search "add" path and the
   * scan/IMEI-picker path check this before adding a new line, and the
   * template uses it to grey out/hide the add-item controls with an
   * explanatory note rather than letting the cashier hit a surprise toast
   * on every further attempt. */
  cartFull(): boolean {
    return this.cart().length >= Billing.MAX_CART_LINES;
  }

  removeLine(key: string): void {
    this.cart.update((rows) => rows.filter((r) => r.key !== key));
    if (this.openDetailsKey() === key) {
      this.openDetailsKey.set(null);
    }
  }

  toggleLineDetails(key: string): void {
    this.openDetailsKey.set(this.openDetailsKey() === key ? null : key);
  }

  isLineDetailsOpen(key: string): boolean {
    return this.openDetailsKey() === key;
  }

  /** The Rate column is entered/shown GST-inclusive (matching the Purchase
   * form's Purchase Price field - see core/utils/money.ts), but `line.rate`
   * itself always stays ex-GST/pre-tax underneath: it drives
   * lineTaxableAmount()/lineGstAmount() below and is sent to the server as-
   * is, and SalesService's own tax math (TaxHelper::computeSplit against
   * sale_price*quantity) expects a pre-tax rate, same convention as
   * products.base_price/selling_price and purchase_items.rate. So this pair
   * only converts for display - the underlying value never changes basis. */
  lineRateInclusive(line: CartLine): number {
    return inclusiveFromExGst(line.rate, line.gstRate);
  }

  onLineRateInclusiveChange(line: CartLine, value: number): void {
    // Unrounded conversion (exGstFromInclusiveExact) - otherwise typing a
    // clean number like 27500 would redisplay as 27499.99 on the next
    // render, since lineRateInclusive() converts back up from whatever's
    // stored here (see money.ts's doc comment on exGstFromInclusiveExact).
    line.rate = exGstFromInclusiveExact(Number(value) || 0, line.gstRate);
  }

  /** Pre-tax, pre-line-discount-adjusted amount for one line (rate net of
   * its own line discount, times quantity) - the GST amount is layered on
   * top of this, the bill-level discount is layered on top of the sum of
   * these across the whole cart. */
  lineTaxableAmount(line: CartLine): number {
    const salePrice = line.rate * (1 - line.discountPercent / 100);
    return salePrice * line.quantity;
  }

  lineGstAmount(line: CartLine): number {
    return this.lineTaxableAmount(line) * (line.gstRate / 100);
  }

  lineTotal(line: CartLine): number {
    return this.lineTaxableAmount(line) + this.lineGstAmount(line);
  }

  /** Sum of every line's taxable amount, before the bill-level discount and
   * before GST - this is what the "Discount %" box in the Bill Summary applies to. */
  subtotal(): number {
    return this.cart().reduce((sum, l) => sum + this.lineTaxableAmount(l), 0);
  }

  /** Non-null when the user's last edit was to the Discount Amount (₹) box
   * directly (e.g. typing "750") rather than the Discount % box - in that
   * case this exact rupee figure is what's applied and echoed straight
   * back into that box. `billDiscountPercent` is still kept in sync
   * alongside it (SalesService.php's `sales/create` only accepts a percent,
   * not a rupee amount - see save()'s payload below - so a direct rupee
   * discount is still sent as its equivalent percent), but at FULL decimal
   * precision rather than rounded to 2 decimals - see onBillDiscountAmountChange(). */
  private billDiscountAmountOverride: number | null = null;

  billDiscountAmount(): number {
    if (this.billDiscountAmountOverride !== null) {
      return round2(this.billDiscountAmountOverride);
    }
    return round2((this.subtotal() * (this.billDiscountPercent || 0)) / 100);
  }

  /** Rounded-for-display version of billDiscountPercent, bound to the
   * Discount % box - kept separate from the raw stored value so that a
   * high-precision percent derived from a directly-typed rupee amount (see
   * onBillDiscountAmountChange()) still shows a clean 2-decimal number in
   * this box instead of a long decimal tail. */
  billDiscountPercentDisplay(): number {
    return round2(this.billDiscountPercent);
  }

  /** Typing directly into the % box makes % authoritative again - clears
   * any rupee-amount override so the Discount Amount box goes back to
   * following the percentage. */
  onBillDiscountPercentChange(value: number): void {
    this.billDiscountPercent = Math.min(100, Math.max(0, Number(value) || 0));
    this.billDiscountAmountOverride = null;
  }

  /** Typing a rupee amount directly into the Discount Amount box stores it
   * as-is (`billDiscountAmountOverride`) so the box always echoes back
   * exactly what was typed - no matter how many digits in, never a
   * recomputed/rounded value that would fight the user mid-keystroke (this
   * is the same class of round-trip precision bug fixed for Billing's Rate
   * column: converting a typed figure through a coarsely-rounded
   * intermediate value and back rarely reconstructs the original number,
   * e.g. typing "750" against a ~₹23,305 subtotal used to collapse to
   * "6.995" after the very first keystroke, because the equivalent percent
   * was rounded to 2 decimals - nowhere near enough resolution for a
   * 5-figure subtotal - before being converted back for display). The
   * equivalent percent IS still computed here (for the % box's display and
   * for what `save()` sends to the server), but kept at full precision -
   * not rounded to 2 decimals - specifically so that converting it back
   * into a rupee amount elsewhere reconstructs the typed figure to the
   * paisa. */
  onBillDiscountAmountChange(value: number): void {
    const sub = this.subtotal();
    const amount = Math.max(0, Number(value) || 0);
    this.billDiscountAmountOverride = sub > 0 ? Math.min(sub, amount) : amount;
    this.billDiscountPercent = sub > 0 ? Math.min(100, (this.billDiscountAmountOverride / sub) * 100) : 0;
  }

  gstTotal(): number {
    return this.cart().reduce((sum, l) => sum + this.lineGstAmount(l), 0);
  }

  /** 'CGST_SGST' when the selected customer's state matches the shop's home
   * state - or the customer has no GSTIN/state_code at all, which
   * TaxHelper::determineTaxType() on the server also defaults to the shop's
   * own state - 'IGST' otherwise. Mirrors that server logic exactly so this
   * screen's preview never disagrees with what SalesService.php actually
   * computes and stores once the bill is saved (see sale-detail.ts's
   * identical tax_type check for the saved invoice). */
  taxType(): 'CGST_SGST' | 'IGST' {
    const home = this.homeStateCode();
    if (!home) {
      return 'CGST_SGST';
    }
    const customer = this.customers().find((c) => c.id === this.customerId);
    const effective = customer?.state_code || home;
    return effective === home ? 'CGST_SGST' : 'IGST';
  }

  /** Half of gstTotal() when this bill will save as CGST+SGST, 0 when it
   * will save as IGST instead (see taxType()) - same even-split convention
   * already used for a saved invoice's per-rate-group CGST/SGST columns in
   * sale-detail.ts, just applied to the bill-level total shown here. */
  cgstAmount(): number {
    return this.taxType() === 'IGST' ? 0 : round2(this.gstTotal() / 2);
  }

  sgstAmount(): number {
    return this.cgstAmount();
  }

  /** Whole of gstTotal() when this bill will save as IGST, 0 otherwise. */
  igstAmount(): number {
    return this.taxType() === 'IGST' ? this.gstTotal() : 0;
  }

  /** Subtotal − discount + GST, before rounding to a whole rupee - mirrors
   * SalesService.php's `$totalBeforeRound` exactly, so the Bill Summary's
   * Round Off/Grand Total match what the saved invoice will actually show. */
  totalBeforeRound(): number {
    return this.subtotal() - this.billDiscountAmount() + this.gstTotal();
  }

  /** Grand Total is rounded to the nearest whole rupee - same as the
   * server's `total_amount` (SalesService.php: `round($totalBeforeRound)`,
   * no decimals) - so what's shown here during billing matches the actual
   * amount charged/printed after checkout, not a few paise off from it. */
  grandTotal(): number {
    return Math.round(this.totalBeforeRound());
  }

  /** Difference between the rounded Grand Total and the exact pre-round
   * total - shown as its own "Round Off" line, same convention as the
   * printed invoice (sale-detail.html's Round Off row, from the server's
   * stored `round_off` column). */
  roundOff(): number {
    return round2(this.grandTotal() - this.totalBeforeRound());
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  setPaymentMode(mode: PaymentMode): void {
    this.paymentMode = mode;
  }

  useFullAmount(): void {
    this.amountPaidText = this.grandTotal().toFixed(2);
  }

  /** True once the user has typed/set SOME value into Cash Received - works
   * whether it's currently a string ('' initially, or a `.toFixed(2)` string
   * from useFullAmount()) or a real number (what typing into the
   * type="number" box actually produces). Never call `.trim()` on
   * `amountPaidText` directly - it is not reliably a string. */
  private amountPaidEntered(): boolean {
    return this.amountPaidText !== '' && this.amountPaidText !== null && this.amountPaidText !== undefined;
  }

  changeDue(): number {
    const paid = Number(this.amountPaidText) || 0;
    const due = paid - this.grandTotal();
    return due > 0 ? due : 0;
  }

  /** Whatever's left owing when Cash Received is less than the Grand Total -
   * this is what silently became a credit/partial-payment sale with no
   * on-screen feedback until now. Applies regardless of payment mode: a
   * partial UPI/Card/Credit amount owes a balance the same way partial cash
   * does. */
  balanceDue(): number {
    if (!this.amountPaidEntered()) return 0;
    const paid = Number(this.amountPaidText) || 0;
    const due = this.grandTotal() - paid;
    return due > 0 ? round2(due) : 0;
  }

  async clearBill(): Promise<void> {
    if (this.cart().length === 0 && !this.customerId) return;
    const confirmed = await this.toast.confirm({
      title: 'Clear this bill?',
      text: 'Every item in the cart will be removed. This cannot be undone.',
      danger: true,
      confirmText: 'Clear',
    });
    if (!confirmed) return;

    this.cart.set([]);
    this.openDetailsKey.set(null);
    this.scanCode = '';
    this.productSearch = '';
    this.billDiscountPercent = 0;
    this.billDiscountAmountOverride = null;
    this.amountPaidText = '';
    this.paymentMode = 'cash';
    this.customerId = null;
    this.customerSearch = '';
    const walkIn = this.customers().find((c) => c.name.toLowerCase() === 'walk-in customer');
    if (walkIn) {
      this.selectCustomer(walkIn);
    }
  }

  save(): void {
    if (!this.customerId) {
      this.toast.error('Select a customer.');
      return;
    }
    if (this.cart().length === 0) {
      this.toast.error('Add at least one item to the cart.');
      return;
    }

    const items: SalesItemInput[] = this.cart().map((line) => {
      const item: SalesItemInput = {
        product_id: line.productId,
        rate: line.rate,
        discount_percent: line.discountPercent,
        gst_rate: line.gstRate,
        warranty_years: line.warrantyYears,
        warranty_months: line.warrantyMonths,
      };
      if (line.isSerialized) {
        item.stock_item_id = line.stockItemId as number;
      } else {
        item.quantity = line.quantity;
      }
      return item;
    });

    if (this.editMode() && this.editInvoiceId) {
      const updatePayload: SalesUpdateInput = {
        id: this.editInvoiceId,
        customer_id: this.customerId,
        invoice_date: this.invoiceDate,
        payment_mode: this.paymentMode,
        bill_discount_percent: this.billDiscountPercent || 0,
        items,
      };
      this.saving.set(true);
      this.salesService.update(updatePayload).subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(`Invoice ${res.data?.invoice_no} updated.`);
          this.router.navigate(['/sales', res.data?.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not save these changes.'));
        },
      });
      return;
    }

    const payload: SalesCreateInput = {
      customer_id: this.customerId,
      invoice_date: this.invoiceDate,
      payment_mode: this.paymentMode,
      bill_discount_percent: this.billDiscountPercent || 0,
      items,
    };
    if (this.amountPaidEntered()) {
      payload.amount_paid = Number(this.amountPaidText);
    }

    this.saving.set(true);
    this.salesService.create(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(`Invoice ${res.data?.invoice_no} generated.`);
        this.router.navigate(['/sales', res.data?.id], { queryParams: { print: '1' } });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not generate this invoice.'));
      },
    });
  }
}
