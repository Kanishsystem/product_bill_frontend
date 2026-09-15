import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Purchase, PurchaseItem, PurchasePaymentHistoryEntry, PurchasePaymentMode } from '../../../core/models/purchase.model';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [RouterLink, Icon, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './purchase-detail.html',
  styleUrl: './purchase-detail.scss',
})
export class PurchaseDetail implements OnInit {
  purchase = signal<Purchase | null>(null);
  loading = signal(true);
  purchaseId!: number;

  payments = signal<PurchasePaymentHistoryEntry[]>([]);
  recordingPayment = signal(false);
  // Bound to a plain number input via ngModel - Angular's NumberValueAccessor
  // writes back a real number (or null) the instant the user types (same
  // gotcha as sale-detail.ts's paymentAmount), so this is typed loosely and
  // read through paymentAmountEntered().
  paymentAmount: string | number | null = '';
  paymentMode: PurchasePaymentMode = 'cash';
  paymentNote = '';

  constructor(
    private route: ActivatedRoute,
    private purchaseService: PurchaseService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.purchaseId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService.get(this.purchaseId).subscribe({
      next: (res) => {
        this.purchase.set(res.data ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this purchase.'));
      },
    });
    this.loadPaymentHistory();
  }

  loadPaymentHistory(): void {
    this.purchaseService.paymentHistory(this.purchaseId).subscribe({
      next: (res) => this.payments.set(res.data ?? []),
      error: () => {}, // supplementary to the purchase itself
    });
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  hasBalanceDue(): boolean {
    return this.num(this.purchase()?.balance_due) > 0;
  }

  /** True once the user has actually typed something into the amount field
   * - mirrors sale-detail.ts's paymentAmountEntered(). */
  private paymentAmountEntered(): boolean {
    return this.paymentAmount !== '' && this.paymentAmount !== null;
  }

  async recordPayment(): Promise<void> {
    if (!this.paymentAmountEntered() || Number(this.paymentAmount) <= 0) {
      this.toast.error('Enter a payment amount greater than zero.');
      return;
    }
    const amount = Number(this.paymentAmount);
    const balanceDue = this.num(this.purchase()?.balance_due);
    if (amount > balanceDue + 0.01) {
      this.toast.error(`Payment cannot exceed the balance due (₹${balanceDue.toFixed(2)}).`);
      return;
    }

    this.recordingPayment.set(true);
    this.purchaseService
      .recordPayment({
        purchase_id: this.purchaseId,
        amount,
        payment_mode: this.paymentMode,
        note: this.paymentNote.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.recordingPayment.set(false);
          this.purchase.set(res.data ?? this.purchase());
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

  /** Serialized units (IMEI or Serial No.) can be individually returned/damaged; quantity-batch lines can't. */
  isUnitTracked(item: PurchaseItem): boolean {
    return !!item.stock_item_id && (!!item.imei1 || !!item.serial_no);
  }

  async markUnit(item: PurchaseItem, action: 'returned' | 'damaged'): Promise<void> {
    if (!item.stock_item_id) return;
    const confirmed = await this.toast.confirm({
      title: `Mark this unit as ${action}?`,
      text: item.imei1 ? `IMEI: ${item.imei1}` : item.serial_no ? `Serial: ${item.serial_no}` : undefined,
      danger: true,
      confirmText: action === 'damaged' ? 'Mark damaged' : 'Mark returned',
    });
    if (!confirmed) return;

    this.purchaseService.return_([item.stock_item_id], action).subscribe({
      next: () => {
        this.toast.success('Updated.');
        this.load();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not update this unit.')),
    });
  }
}
