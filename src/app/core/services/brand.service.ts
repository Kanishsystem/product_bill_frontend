import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { Brand } from '../models/brand.model';

@Injectable({ providedIn: 'root' })
export class BrandService {
  constructor(private api: ApiService) {}

  list() {
    return this.api.get<ApiResponse<Brand[]>>('brands/list');
  }

  get(id: number) {
    return this.api.get<ApiResponse<Brand>>('brands/get', { id });
  }

  create(payload: Partial<Brand>) {
    return this.api.post<ApiResponse<Brand>>('brands/create', payload);
  }

  update(id: number, payload: Partial<Brand>) {
    return this.api.put<ApiResponse<Brand>>('brands/update', { ...payload, id });
  }

  delete(id: number) {
    return this.api.delete<ApiResponse<null>>('brands/delete', { id });
  }
}
