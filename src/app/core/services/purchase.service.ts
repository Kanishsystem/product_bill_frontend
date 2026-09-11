import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import {
  Purchase,
  PurchaseCreateInput,
  PurchasePaymentHistoryEntry,
  PurchaseUpdateInput,
  RecordPurchasePaymentInput,
} from '../models/purchase.model';

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  constructor(private api: ApiService) {}

  list(filters?: { supplier_id?: number; from_date?: string; to_date?: string }) {
    return this.api.get<ApiResponse<Purchase[]>>('purchases/list', filters);
  }

  get(id: number) {
    return this.api.get<ApiResponse<Purchase>>('purchases/get', { id });
  }

  create(payload: PurchaseCreateInput) {
    return this.api.post<ApiResponse<Purchase>>('purchases/create', payload);
  }

  /** Edits an already-saved purchase in place (same id) - blocked server-side
   * if any unit it brought into stock has already been sold/returned/damaged. */
  update(payload: PurchaseUpdateInput) {
    return this.api.post<ApiResponse<Purchase>>('purchases/update', payload);
  }

  /** Marks previously purchased stock units as returned-to-supplier / damaged. */
  return_(stockItemIds: number[], action: 'returned' | 'damaged') {
    return this.api.post<ApiResponse<null>>('purchases/return', { stock_item_ids: stockItemIds, action });
  }

  /** Purchases with money still owed to the supplier, worst-outstanding-first -
   * powers the Purchases list's "Pending payments only" comparison view. */
  pending(filters?: { supplier_id?: number; search?: string }) {
    return this.api.get<ApiResponse<Purchase[]>>('purchases/pending', filters);
  }

  paymentHistory(purchaseId: number) {
    return this.api.get<ApiResponse<PurchasePaymentHistoryEntry[]>>('purchases/payment-history', { id: purchaseId });
  }

  /** Every payment made to one supplier, across all their purchases -
   * feeds the supplier's party-detail page. */
  paymentHistoryBySupplier(supplierId: number) {
    return this.api.get<ApiResponse<PurchasePaymentHistoryEntry[]>>('purchases/payment-history-by-supplier', {
      supplier_id: supplierId,
    });
  }

  recordPayment(payload: RecordPurchasePaymentInput) {
    return this.api.post<ApiResponse<Purchase>>('purchases/record-payment', payload);
  }
}
