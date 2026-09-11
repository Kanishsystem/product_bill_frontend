import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { PaymentHistoryEntry, RecordPaymentInput, SalesCreateInput, SalesInvoice, SalesUpdateInput } from '../models/sale.model';

@Injectable({ providedIn: 'root' })
export class SalesService {
  constructor(private api: ApiService) {}

  list(filters?: { customer_id?: number; status?: string; from_date?: string; to_date?: string; search?: string }) {
    return this.api.get<ApiResponse<SalesInvoice[]>>('sales/list', filters);
  }

  get(id: number) {
    return this.api.get<ApiResponse<SalesInvoice>>('sales/get', { id });
  }

  create(payload: SalesCreateInput) {
    return this.api.post<ApiResponse<SalesInvoice>>('sales/create', payload);
  }

  /** Edits an already-saved invoice in place (same id/invoice_no) - blocked
   * server-side if the invoice already has a returned item on it. */
  update(payload: SalesUpdateInput) {
    return this.api.post<ApiResponse<SalesInvoice>>('sales/update', payload);
  }

  return_(invoiceId: number, itemIds: number[]) {
    return this.api.post<ApiResponse<SalesInvoice>>('sales/return', { invoice_id: invoiceId, item_ids: itemIds });
  }

  /** Invoices with money still owed, worst-outstanding-first - powers the
   * Sales list's "Pending payments only" comparison view. */
  pending(filters?: { search?: string }) {
    return this.api.get<ApiResponse<SalesInvoice[]>>('sales/pending', filters);
  }

  paymentHistory(invoiceId: number) {
    return this.api.get<ApiResponse<PaymentHistoryEntry[]>>('sales/payment-history', { id: invoiceId });
  }

  recordPayment(payload: RecordPaymentInput) {
    return this.api.post<ApiResponse<SalesInvoice>>('sales/record-payment', payload);
  }

  /** Every payment received from one customer, across all their invoices -
   * feeds the customer's party-detail page. */
  paymentHistoryByCustomer(customerId: number) {
    return this.api.get<ApiResponse<PaymentHistoryEntry[]>>('sales/payment-history-by-customer', {
      customer_id: customerId,
    });
  }
}
