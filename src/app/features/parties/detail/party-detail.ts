import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PartyService } from '../../../core/services/party.service';
import { SalesService } from '../../../core/services/sales.service';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Party } from '../../../core/models/party.model';
import { PaymentHistoryEntry, SalesInvoice } from '../../../core/models/sale.model';
import { Purchase, PurchasePaymentHistoryEntry } from '../../../core/models/purchase.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

/**
 * Read-only history view for one party, reached from the "View history"
 * link on Suppliers & Customers - a customer sees their sales + payments,
 * a supplier sees their purchases + payments made to them. Which pair of
 * lists to load is decided purely by party_type once the party itself has
 * loaded (fetchHistory()) - mirrors how PurchaseService/SalesService
 * already branch their own logic on category flags elsewhere in this app.
 */
@Component({
  selector: 'app-party-detail',
  standalone: true,
  imports: [RouterLink, Icon, DecimalPipe, DatePipe, EmptyState],
  templateUrl: './party-detail.html',
  styleUrl: './party-detail.scss',
})
export class PartyDetail implements OnInit {
  party = signal<Party | null>(null);
  loading = signal(true);

  sales = signal<SalesInvoice[]>([]);
  purchases = signal<Purchase[]>([]);
  salesPayments = signal<PaymentHistoryEntry[]>([]);
  purchasePayments = signal<PurchasePaymentHistoryEntry[]>([]);
  historyLoading = signal(true);

  partyId!: number;

  constructor(
    private route: ActivatedRoute,
    private partyService: PartyService,
    private salesService: SalesService,
    private purchaseService: PurchaseService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.partyId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.partyService.get(this.partyId).subscribe({
      next: (res) => {
        this.party.set(res.data ?? null);
        this.loading.set(false);
        this.fetchHistory();
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load this party.'));
      },
    });
  }

  private fetchHistory(): void {
    const p = this.party();
    if (!p) return;
    this.historyLoading.set(true);

    if (p.party_type === 'customer') {
      this.salesService.list({ customer_id: p.id }).subscribe({
        next: (res) => {
          this.sales.set(res.data ?? []);
          this.historyLoading.set(false);
        },
        error: (err) => {
          this.historyLoading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load sales history.'));
        },
      });
      this.salesService.paymentHistoryByCustomer(p.id).subscribe({
        next: (res) => this.salesPayments.set(res.data ?? []),
        error: () => {}, // supplementary to the invoice list itself
      });
    } else {
      this.purchaseService.list({ supplier_id: p.id }).subscribe({
        next: (res) => {
          this.purchases.set(res.data ?? []);
          this.historyLoading.set(false);
        },
        error: (err) => {
          this.historyLoading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load purchase history.'));
        },
      });
      this.purchaseService.paymentHistoryBySupplier(p.id).subscribe({
        next: (res) => this.purchasePayments.set(res.data ?? []),
        error: () => {}, // supplementary to the purchase list itself
      });
    }
  }

  num(value: number | string | null | undefined): number {
    return Number(value) || 0;
  }

  /** Sum of every invoice/purchase's balance_due still outstanding - the
   * headline figure at the top of the history section. */
  totalOutstanding(): number {
    const p = this.party();
    if (!p) return 0;
    const rows: { balance_due: number | string }[] = p.party_type === 'customer' ? this.sales() : this.purchases();
    return rows.reduce((sum, row) => sum + this.num(row.balance_due), 0);
  }
}
