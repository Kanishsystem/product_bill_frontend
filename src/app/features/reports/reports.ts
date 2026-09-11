import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/http-error';
import {
  GstReport,
  ProfitReport,
  PurchaseReport,
  SalesReport,
  SalesReportGroupBy,
  StockValuationReport,
} from '../../core/models/report.model';

type ReportTab = 'sales' | 'purchases' | 'stock-valuation' | 'profit' | 'gst';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  activeTab: ReportTab = 'sales';
  loading = signal(false);

  fromDate = new Date().toISOString().slice(0, 8) + '01';
  toDate = new Date().toISOString().slice(0, 10);
  salesGroupBy: SalesReportGroupBy = 'day';

  salesReport = signal<SalesReport | null>(null);
  purchaseReport = signal<PurchaseReport | null>(null);
  stockValuation = signal<StockValuationReport | null>(null);
  profitReport = signal<ProfitReport | null>(null);
  gstReport = signal<GstReport | null>(null);

  constructor(
    private reportService: ReportService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const filters = { from_date: this.fromDate, to_date: this.toDate };

    switch (this.activeTab) {
      case 'sales':
        this.reportService.sales({ ...filters, group_by: this.salesGroupBy }).subscribe({
          next: (res) => {
            this.salesReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'purchases':
        this.reportService.purchases(filters).subscribe({
          next: (res) => {
            this.purchaseReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'stock-valuation':
        this.reportService.stockValuation().subscribe({
          next: (res) => {
            this.stockValuation.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'profit':
        this.reportService.profit(filters).subscribe({
          next: (res) => {
            this.profitReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'gst':
        this.reportService.gst(filters).subscribe({
          next: (res) => {
            this.gstReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
    }
  }

  private fail(err: unknown): void {
    this.loading.set(false);
    this.toast.error(extractErrorMessage(err, 'Could not load this report.'));
  }
}
