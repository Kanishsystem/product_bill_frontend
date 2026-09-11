import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { AuthService } from '../../core/services/auth.service';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/http-error';
import { DashboardData } from '../../core/models/report.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, Icon, DecimalPipe, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  loading = signal(true);
  data = signal<DashboardData | null>(null);
  /** Set once at load, purely for the "today" line in the header - not reactive on purpose. */
  today = new Date();

  constructor(
    public auth: AuthService,
    private reportService: ReportService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.reportService.dashboard().subscribe({
      next: (res) => {
        this.data.set(res.data ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not load dashboard data.'));
      },
    });
  }

  /** Bar height as a % of the tallest value in the series - a dependency-free chart. */
  barHeight(value: number | string, series: { value: number | string }[]): number {
    const max = Math.max(1, ...series.map((s) => Number(s.value) || 0));
    return Math.max(4, (Number(value) / max) * 100);
  }

  trendSeries(): { label: string; value: number }[] {
    return (this.data()?.sales_trend ?? []).map((p) => ({
      label: p.invoice_date.slice(5),
      value: Number(p.total),
    }));
  }

  categorySeries(): { label: string; value: number }[] {
    return (this.data()?.category_revenue ?? []).map((c) => ({
      label: c.category_name,
      value: Number(c.revenue),
    }));
  }

  /** Sum of a series' values - used for the small total chip in each chart panel's header. */
  seriesTotal(series: { value: number }[]): number {
    return series.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  }
}
