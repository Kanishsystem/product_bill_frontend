import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SalesService } from '../../../core/services/sales.service';
import { CompanyService } from '../../../core/services/company.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { PaymentHistoryEntry, PaymentMode, SalesInvoice } from '../../../core/models/sale.model';
import { CompanyProfile } from '../../../core/models/company.model';
import { environment } from '../../../../environments/environment';

/** One row of the GST-rate breakdown table on the printable tax invoice -
 * grouped from the invoice's line items by their gst_rate. Every line in one
 * invoice shares the same tax_type (CGST+SGST vs IGST), so a rate group's
 * total GST amount can be split into CGST/SGST halves (or shown whole as
 * IGST) without needing the backend to store a per-item CGST/SGST split. */
interface GstBreakdownRow {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './sale-detail.html',
  styleUrl: './sale-detail.scss',
})
export class SaleDetail implements OnInit {
  invoice = signal<SalesInvoice | null>(null);
  company = signal<CompanyProfile | null>(null);
  loading = signal(true);
  invoiceId!: number;
  selectedItemIds = new Set<number>();

  payments = signal<PaymentHistoryEntry[]>([]);
  recordingPayment = signal(false);
  // Bound to a plain number input via ngModel - Angular's NumberValueAccessor
  // writes back a real number (or null) the instant the user types, whatever
  // this was initialised as (see billing.ts's amountPaidText for the same
  // gotcha), so this is typed loosely and read through paymentAmountEntered().
  paymentAmount: string | number | null = '';
  paymentMode: PaymentMode = 'cash';
  paymentNote = '';

  constructor(
    private route: ActivatedRoute,
    private salesService: SalesService,
    private companyService: CompanyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.invoiceId = Number(this.route.snapshot.paramMap.get('id'));
    // "Checkout & Print Bill" on the Billing screen lands here with
    // ?print=1 straight after creating the invoice - trigger the same
    // browser-print flow as the manual Print button once the invoice has
    // actually rendered, instead of building a separate PDF pipeline.
    const autoPrint = this.route.snapshot.queryParamMap.get('print') === '1';
    this.load(autoPrint);
    // Shop name/address/GSTIN/mobile for the printed tax-invoice header and
    // footer - supplementary to the invoice itself, so a failure here just
    // means a blanker-looking header rather than blocking the page.
    this.companyService.get().subscribe({
      next: (res) => this.company.set(res.data ?? null),
      error: () => {},
    });
  }

  load(autoPrint = false): void {
    this.loading.set(true);
    this.salesService.get(this.invoiceId).subscribe({
      next: (res) => {
        this.invoice.set(res.data ?? null);
        this.loading.set(false);
        this.selectedItemIds.clear();
        if (autoPrint) {
          setTimeout(() => this.print(), 300);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this invoice.'));
      },
    });
    this.loadPaymentHistory();
  }

  loadPaymentHistory(): void {
    this.salesService.paymentHistory(this.invoiceId).subscribe({
      next: (res) => this.payments.set(res.data ?? []),
      error: () => {}, // supplementary to the invoice itself, same as company profile above
    });
  }

  toggleSelect(itemId: number): void {
    if (this.selectedItemIds.has(itemId)) {
      this.selectedItemIds.delete(itemId);
    } else {
      this.selectedItemIds.add(itemId);
    }
  }

  print(): void {
    window.print();
  }

  /** Full, directly-loadable URL for the shop's uploaded invoice-heading
   * image (Settings > Invoice heading), or null when none has been
   * uploaded - in which case the template falls back to the plain
   * shop_name/address text heading it always showed before. company()'s
   * header_image_path is only a path relative to the backend, same
   * convention every API call already uses, so it's prefixed with
   * apiBaseUrl exactly like ApiService does. */
  headerImageUrl(): string | null {
    const path = this.company()?.header_image_path;
    return path ? `${environment.apiBaseUrl}/${path}` : null;
  }

  hasBalanceDue(): boolean {
    return Number(this.invoice()?.balance_due ?? 0) > 0;
  }

  /** Only true once a return has dropped the recalculated total below what
   * was already paid - mutually exclusive with hasBalanceDue(). */
  hasRefundDue(): boolean {
    return Number(this.invoice()?.refund_due ?? 0) > 0;
  }

  hasBillDiscount(): boolean {
    return Number(this.invoice()?.bill_discount_amount ?? 0) > 0;
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  /** How many blank "lines" of empty space to pad the printed items table
   * with, matching the shop's old pre-printed bill book - a fixed amount of
   * blank space below the items regardless of how many are actually on the
   * bill (a 1-2 item invoice would otherwise leave the item table tiny and
   * the whole printed page looking mostly empty below it), rendered as ONE
   * plain empty area (no row/column grid lines through it, just the table's
   * own outer border) rather than a separate ruled row per blank line - the
   * shop's own old bill shows a blank rectangle, not an empty grid. Only
   * rendered on paper (see .blank-item-row's print-only display in
   * sale-detail.scss) - the on-screen view stays exactly as many rows as
   * there are real items. Never adds anything once an invoice already has
   * the max 5 items (see Billing.MAX_CART_LINES), so this can't undo the
   * one-page print guarantee that cap exists for. MIN_PRINTED_ITEM_ROWS is a
   * fixed constant rather than a Settings field for now - ask if the shop
   * wants more/fewer blank lines than this. */
  private static readonly MIN_PRINTED_ITEM_ROWS = 5;

  blankRowCount(): number {
    const count = (this.invoice()?.items ?? []).length;
    return Math.max(0, SaleDetail.MIN_PRINTED_ITEM_ROWS - count);
  }

  /** Active items only - a returned line no longer counts toward what's
   * actually on this invoice. */
  totalQuantity(): number {
    return (this.invoice()?.items ?? [])
      .filter((item) => item.status === 'active')
      .reduce((sum, item) => sum + this.num(item.quantity), 0);
  }

  /** taxable_amount + cgst + sgst + igst - bill discount, before rounding -
   * the "Total" line above Round Off / Grand Total on the printed invoice.
   * Derived from the two figures the backend already stores (total_amount,
   * round_off) so it stays correct whether or not a bill discount applied. */
  billBeforeRound(): number {
    const inv = this.invoice();
    if (!inv) return 0;
    return this.num(inv.total_amount) - this.num(inv.round_off);
  }

  /** Shop name for the printed invoice's signature line ("For <shop name>,"),
   * split back across its own lines to match the shop's old pre-printed bill
   * book - which prints "For RASI TIME CENTER /" on one line and "MOBILES &
   * HOME APPLIANCES," on the next, rather than squeezing both onto a single
   * line. The Settings > Shop Identity field already lets the owner enter
   * the name across two lines (e.g. "RASI TIME CENTER" / "MOBILES & HOME
   * APPLIANCES") for the big centered heading at the top of the invoice -
   * this reuses that same line break instead of re-joining it into one
   * line. Each line but the last gets a trailing " /" (the old bill's own
   * line-break marker); the last line gets the trailing comma that used to
   * sit after the whole joined string. A single-line shop name (no '\n' in
   * Settings) just renders as one line, "For <name>,", same as before. */
  shopSignatureLines(): string[] {
    const lines = (this.company()?.shop_name ?? 'Your Shop')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      lines.push('Your Shop');
    }
    return lines.map((line, i) => {
      const prefixed = i === 0 ? `For ${line}` : line;
      return i === lines.length - 1 ? `${prefixed},` : `${prefixed} /`;
    });
  }

  /** True when at least one line item on this invoice carries a nonzero
   * warranty period - the printed invoice's Warranty line (years/months,
   * matching the shop's old pre-printed bill format) is only worth showing
   * when there's something to show; an all-zero invoice just skips it
   * rather than printing an empty line. */
  hasAnyWarranty(): boolean {
    return (this.invoice()?.items ?? []).some(
      (item) => this.num(item.warranty_years) > 0 || this.num(item.warranty_months) > 0,
    );
  }

  /** The shop's own old bill book gives warranty a single line (Years /
   * Months), not a per-item breakdown - every item on one invoice always
   * carries the same warranty period in their process, so there's only ever
   * one real value to show. This surfaces the first active item that
   * carries a nonzero warranty (matching hasAnyWarranty()'s own definition
   * of "carries a warranty"); warrantyYears()/warrantyMonths() read its
   * years/months for the printed line. */
  private firstWarrantyItem() {
    return (this.invoice()?.items ?? []).find(
      (item) =>
        item.status === 'active' && (this.num(item.warranty_years) > 0 || this.num(item.warranty_months) > 0),
    );
  }

  warrantyYears(): number {
    return this.num(this.firstWarrantyItem()?.warranty_years);
  }

  warrantyMonths(): number {
    return this.num(this.firstWarrantyItem()?.warranty_months);
  }

  /** Settings > Company Profile's free-text terms field, split into lines
   * for an auto-numbered list on the printed invoice - works whatever
   * language/wording the shop enters there, no hardcoded terms text. */
  termsLines(): string[] {
    const raw = this.company()?.terms_and_conditions ?? '';
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /** Active items only - the backend's own taxable_amount/cgst_amount/etc.
   * (the "Total" row below this breakdown) are recalculated from active
   * lines alone after a return, so the per-rate rows above it need to match
   * or the two would visibly disagree. */
  gstBreakdown(): GstBreakdownRow[] {
    const inv = this.invoice();
    if (!inv) return [];
    const groups = new Map<number, { taxable: number; gst: number }>();
    for (const item of inv.items ?? []) {
      if (item.status !== 'active') continue;
      const rate = this.num(item.gst_rate);
      const taxable = this.num(item.sale_price) * this.num(item.quantity);
      const gst = this.num(item.gst_amount);
      const existing = groups.get(rate) ?? { taxable: 0, gst: 0 };
      existing.taxable += taxable;
      existing.gst += gst;
      groups.set(rate, existing);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, g]) => ({
        rate,
        taxable: g.taxable,
        cgst: inv.tax_type === 'IGST' ? 0 : g.gst / 2,
        sgst: inv.tax_type === 'IGST' ? 0 : g.gst / 2,
        igst: inv.tax_type === 'IGST' ? g.gst : 0,
      }));
  }

  async returnSelected(): Promise<void> {
    if (this.selectedItemIds.size === 0) {
      this.toast.error('Select at least one item to return.');
      return;
    }
    const confirmed = await this.toast.confirm({
      title: `Return ${this.selectedItemIds.size} item(s)?`,
      text: 'The corresponding stock will be put back automatically, and the invoice total will be recalculated to reflect only the remaining items.',
      danger: true,
      confirmText: 'Return',
    });
    if (!confirmed) return;

    this.salesService.return_(this.invoiceId, Array.from(this.selectedItemIds)).subscribe({
      next: (res) => {
        const updated = res.data ?? null;
        this.invoice.set(updated);
        this.selectedItemIds.clear();
        const refund = this.num(updated?.refund_due);
        if (refund > 0) {
          this.toast.success(`Returned. Refund ₹${refund.toFixed(2)} to the customer.`);
        } else {
          this.toast.success('Returned.');
        }
        this.loadPaymentHistory();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not process this return.')),
    });
  }

  /** True once the user has actually typed something into the amount field
   * - mirrors billing.ts's amountPaidEntered(), needed because ngModel on a
   * number input can hand this back as a real 0/number, not the '' it was
   * initialised as. */
  private paymentAmountEntered(): boolean {
    return this.paymentAmount !== '' && this.paymentAmount !== null;
  }

  async recordPayment(): Promise<void> {
    if (!this.paymentAmountEntered() || Number(this.paymentAmount) <= 0) {
      this.toast.error('Enter a payment amount greater than zero.');
      return;
    }
    const amount = Number(this.paymentAmount);
    const balanceDue = this.num(this.invoice()?.balance_due);
    if (amount > balanceDue + 0.01) {
      this.toast.error(`Payment cannot exceed the balance due (₹${balanceDue.toFixed(2)}).`);
      return;
    }

    this.recordingPayment.set(true);
    this.salesService
      .recordPayment({
        invoice_id: this.invoiceId,
        amount,
        payment_mode: this.paymentMode,
        note: this.paymentNote.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.recordingPayment.set(false);
          this.invoice.set(res.data ?? this.invoice());
          this.paymentAmount = '';
          this.paymentNote = '';
          this.loadPaymentHistory();
          this.toast.success('Payment recorded.');
        },
        error: (err) => {
          this.recordingPayment.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not record this payment.'));
        },
      });
  }
}
