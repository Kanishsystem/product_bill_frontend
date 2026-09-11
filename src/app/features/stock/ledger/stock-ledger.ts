import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StockService } from '../../../core/services/stock.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { StockItem, StockSummaryRow, StockStatus } from '../../../core/models/stock-item.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

type Tab = 'summary' | 'ledger';

@Component({
  selector: 'app-stock-ledger',
  standalone: true,
  imports: [FormsModule, Icon, EmptyState],
  templateUrl: './stock-ledger.html',
  styleUrl: './stock-ledger.scss',
})
export class StockLedger implements OnInit {
  activeTab: Tab = 'summary';

  summary = signal<StockSummaryRow[]>([]);
  ledger = signal<StockItem[]>([]);
  loading = signal(true);

  summarySearch = '';
  ledgerSearch = '';
  ledgerStatus = '';

  /** "Compare low stock" mode: only products at/under their threshold, worst shortfall first, instead of every product A-Z. */
  lowStockOnly = false;
  /** How many units short of the threshold each row is (threshold - on_hand) - the bigger this is, the more urgent. Only meaningful/shown while lowStockOnly is on. */
  shortfallByProduct = new Map<number, number>();

  lookupCode = '';
  lookupResult = signal<StockItem | null>(null);
  lookupError = signal<string | null>(null);
  lookingUp = signal(false);

  constructor(
    private stockService: StockService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Supports the Dashboard's "Low Stock Alerts -> View" link jumping straight
    // into the filtered comparison view instead of landing on the full list.
    const params = this.route.snapshot.queryParamMap;
    if (params.get('tab') === 'ledger') {
      this.activeTab = 'ledger';
    }
    if (params.get('low') === '1') {
      this.lowStockOnly = true;
    }
    this.setTab(this.activeTab);
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab === 'summary') {
      this.loadSummary();
    } else {
      this.loadLedger();
    }
  }

  toggleLowStockOnly(value: boolean): void {
    this.lowStockOnly = value;
    this.loadSummary();
  }

  shortfall(row: StockSummaryRow): number {
    return this.shortfallByProduct.get(row.product_id) ?? Math.max(0, row.low_stock_threshold - row.on_hand);
  }

  loadSummary(): void {
    this.loading.set(true);

    if (this.lowStockOnly) {
      // Dedicated endpoint - only products at/under their threshold - rather
      // than fetching everything and filtering client-side.
      this.stockService.lowStock().subscribe({
        next: (res) => {
          const rows = res.data ?? [];
          // Worst shortfall first, so the products needing restock most urgently are easiest to compare at a glance.
          rows.sort((a, b) => b.low_stock_threshold - b.on_hand - (a.low_stock_threshold - a.on_hand));
          this.shortfallByProduct = new Map(rows.map((r) => [r.product_id, Math.max(0, r.low_stock_threshold - r.on_hand)]));
          this.summary.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load low-stock products.'));
        },
      });
      return;
    }

    this.stockService.summary({ search: this.summarySearch || undefined }).subscribe({
      next: (res) => {
        const rows = res.data ?? [];
        this.shortfallByProduct = new Map(rows.map((r) => [r.product_id, Math.max(0, r.low_stock_threshold - r.on_hand)]));
        this.summary.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load stock summary.'));
      },
    });
  }

  loadLedger(): void {
    this.loading.set(true);
    this.stockService
      .ledger({ search: this.ledgerSearch || undefined, status: this.ledgerStatus || undefined })
      .subscribe({
        next: (res) => {
          this.ledger.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load the stock ledger.'));
        },
      });
  }

  lookup(): void {
    if (!this.lookupCode.trim()) return;
    this.lookingUp.set(true);
    this.lookupResult.set(null);
    this.lookupError.set(null);

    this.stockService.lookup(this.lookupCode.trim()).subscribe({
      next: (res) => {
        this.lookingUp.set(false);
        this.lookupResult.set(res.data ?? null);
      },
      error: (err) => {
        this.lookingUp.set(false);
        this.lookupError.set(extractErrorMessage(err, 'No stock item found.'));
      },
    });
  }

  async adjust(item: StockItem, status: StockStatus): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Mark this unit as ${status}?`,
      text: item.imei1 || item.serial_no || item.product_name,
      danger: status !== 'in_stock',
      confirmText: 'Confirm',
    });
    if (!confirmed) return;

    this.stockService.adjust(item.id, status).subscribe({
      next: () => {
        this.toast.success('Updated.');
        this.loadLedger();
      },
      error: (err) => this.toast.error(extractErrorMessage(err, 'Could not update this stock item.')),
    });
  }
}
