import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private api: ApiService) {}

  list(filters?: { category_id?: number; status?: string; search?: string }) {
    return this.api.get<ApiResponse<Product[]>>('products/list', filters);
  }

  get(id: number) {
    return this.api.get<ApiResponse<Product>>('products/get', { id });
  }

  /** Fallback for the billing scan box once stock/lookup (IMEI/Serial) comes
   * up empty - matches a product's own barcode instead of a specific unit. */
  lookupByBarcode(code: string) {
    return this.api.get<ApiResponse<Product>>('products/lookup-by-barcode', { code });
  }

  create(payload: Partial<Product>) {
    return this.api.post<ApiResponse<Product>>('products/create', payload);
  }

  update(id: number, payload: Partial<Product>) {
    return this.api.put<ApiResponse<Product>>('products/update', { ...payload, id });
  }

  delete(id: number) {
    return this.api.delete<ApiResponse<null>>('products/delete', { id });
  }
}
