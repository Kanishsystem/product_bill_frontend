import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SalesService } from '../../../core/services/sales.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { SalesInvoice } from '../../../core/models/sale.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState, DecimalPipe, DatePipe],
  templateUrl: './sales-list.html',
  styleUrl: './sales-list.scss',
})
export class SalesList implements OnInit {
  invoices = signal<SalesInvoice[]>([]);
  loading = signal(true);
  search = '';
  fromDate = '';
  toDate = '';

  /** "Compare pending payments" mode: only invoices with balance_due > 0,
   * worst-outstanding first, instead of every invoice by date - same idea
   * as Stock's "Compare low stock only" toggle. */
  pendingOnly = false;

  constructor(
    private salesService: SalesService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Supports the Dashboard's "Pending Payments" card linking straight into
    // the filtered comparison view instead of landing on the full list.
    if (this.route.snapshot.queryParamMap.get('pending') === '1') {
      this.pendingOnly = true;
    }
    this.load();
  }

  togglePendingOnly(value: boolean): void {
    this.pendingOnly = value;
    this.load();
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  /** Nothing at all has been paid yet - the most urgent kind of pending
   * payment, so it gets the same "critical" red row Stock uses for a
   * completely out-of-stock product. */
  isFullyUnpaid(inv: SalesInvoice): boolean {
    return this.num(inv.amount_paid) <= 0;
  }

  load(): void {
    this.loading.set(true);

    if (this.pendingOnly) {
      // Dedicated endpoint - only invoices with money still owed - rather
      // than fetching everything and filtering client-side.
      this.salesService.pending({ search: this.search || undefined }).subscribe({
        next: (res) => {
          this.invoices.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load pending payments.'));
        },
      });
      return;
    }

    this.salesService
      .list({
        search: this.search || undefined,
        from_date: this.fromDate || undefined,
        to_date: this.toDate || undefined,
      })
      .subscribe({
        next: (res) => {
          this.invoices.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load invoices.'));
        },
      });
  }

  clearFilters(): void {
    this.search = '';
    this.fromDate = '';
    this.toDate = '';
    this.load();
  }
}
