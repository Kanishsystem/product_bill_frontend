import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import {
  CollectionReport,
  DashboardData,
  GstReport,
  ProfitReport,
  PurchaseReport,
  SalesReport,
  SalesReportGroupBy,
  StockValuationReport,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(private api: ApiService) {}

  dashboard() {
    return this.api.get<ApiResponse<DashboardData>>('reports/dashboard');
  }

  sales(filters?: { from_date?: string; to_date?: string; group_by?: SalesReportGroupBy }) {
    return this.api.get<ApiResponse<SalesReport>>('reports/sales', filters);
  }

  purchases(filters?: { from_date?: string; to_date?: string }) {
    return this.api.get<ApiResponse<PurchaseReport>>('reports/purchases', filters);
  }

  stockValuation() {
    return this.api.get<ApiResponse<StockValuationReport>>('reports/stock-valuation');
  }

  profit(filters?: { from_date?: string; to_date?: string }) {
    return this.api.get<ApiResponse<ProfitReport>>('reports/profit', filters);
  }

  gst(filters?: { from_date?: string; to_date?: string }) {
    return this.api.get<ApiResponse<GstReport>>('reports/gst', filters);
  }

  collection(filters?: { from_date?: string; to_date?: string }) {
    return this.api.get<ApiResponse<CollectionReport>>('reports/collection', filters);
  }
}
