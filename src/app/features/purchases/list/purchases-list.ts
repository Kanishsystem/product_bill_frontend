import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error';
import { Purchase } from '../../../core/models/purchase.model';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-purchases-list',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, EmptyState, DatePipe],
  templateUrl: './purchases-list.html',
  styleUrl: './purchases-list.scss',
})
export class PurchasesList implements OnInit {
  purchases = signal<Purchase[]>([]);
  loading = signal(true);
  fromDate = '';
  toDate = '';

  constructor(
    private purchaseService: PurchaseService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService
      .list({ from_date: this.fromDate || undefined, to_date: this.toDate || undefined })
      .subscribe({
        next: (res) => {
          this.purchases.set(res.data ?? []);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(extractErrorMessage(err, 'Could not load purchases.'));
        },
      });
  }

  clearFilters(): void {
    this.fromDate = '';
    this.toDate = '';
    this.load();
  }
}
