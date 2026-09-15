import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SalesService } from '../../../core/services/sales.service';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { SalesInvoice } from '../../../core/models/sale.model';
import { Purchase } from '../../../core/models/purchase.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

/**
 * A single "Payments" dashboard combining both directions of money still
 * owed: customers who still owe the shop (Sales' balance_due, via
 * SalesService.pending() - same endpoint the Sales list's "pending only"
 * toggle already uses) and suppliers the shop still owes (Purchases'
 * balance_due, via PurchaseService.pending() - the mirror added alongside
 * supplier payment tracking). No new backend endpoints needed - this page
 * is purely a combined view over what already exists, so a payment is
 * still actually recorded on the invoice/purchase's own detail page (this
 * page just gets the user there faster than digging through the full
 * Sales/Purchase lists).
 */
@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState, DecimalPipe, DatePipe],
  templateUrl: './payments-list.html',
  styleUrl: './payments-list.scss',
})
export class PaymentsList implements OnInit {
  receivables = signal<SalesInvoice[]>([]);
  payables = signal<Purchase[]>([]);
  loadingReceivables = signal(true);
  loadingPayables = signal(true);
  search = '';

  constructor(
    private salesService: SalesService,
    private purchaseService: PurchaseService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadingReceivables.set(true);
    this.salesService.pending({ search: this.search || undefined }).subscribe({
      next: (res) => {
        this.receivables.set(res.data ?? []);
        this.loadingReceivables.set(false);
      },
      error: (err) => {
        this.loadingReceivables.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load customer dues.'));
      },
    });

    this.loadingPayables.set(true);
    this.purchaseService.pending({ search: this.search || undefined }).subscribe({
      next: (res) => {
        this.payables.set(res.data ?? []);
        this.loadingPayables.set(false);
      },
      error: (err) => {
        this.loadingPayables.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load supplier dues.'));
      },
    });
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  totalReceivable(): number {
    return this.receivables().reduce((sum, inv) => sum + this.num(inv.balance_due), 0);
  }

  totalPayable(): number {
    return this.payables().reduce((sum, pur) => sum + this.num(pur.balance_due), 0);
  }

  /** Positive = customers owe the shop more than the shop owes suppliers;
   * negative = the other way around. */
  netPosition(): number {
    return this.totalReceivable() - this.totalPayable();
  }
}
