import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { StockItem, StockSummaryRow, StockStatus } from '../models/stock-item.model';

@Injectable({ providedIn: 'root' })
export class StockService {
  constructor(private api: ApiService) {}

  ledger(filters?: { product_id?: number; category_id?: number; status?: string; search?: string }) {
    return this.api.get<ApiResponse<StockItem[]>>('stock/list', filters);
  }

  summary(filters?: { category_id?: number; search?: string }) {
    return this.api.get<ApiResponse<StockSummaryRow[]>>('stock/summary', filters);
  }

  lowStock() {
    return this.api.get<ApiResponse<StockSummaryRow[]>>('stock/low-stock');
  }

  lookup(code: string) {
    return this.api.get<ApiResponse<StockItem>>('stock/lookup', { code });
  }

  adjust(stockItemId: number, status: StockStatus) {
    return this.api.post<ApiResponse<StockItem>>('stock/adjust', { stock_item_id: stockItemId, status });
  }
}
