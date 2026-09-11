import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { Category, CategoryAttribute } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  constructor(private api: ApiService) {}

  list() {
    return this.api.get<ApiResponse<Category[]>>('categories/list');
  }

  get(id: number) {
    return this.api.get<ApiResponse<Category>>('categories/get', { id });
  }

  create(payload: Partial<Category>) {
    return this.api.post<ApiResponse<Category>>('categories/create', payload);
  }

  update(id: number, payload: Partial<Category>) {
    return this.api.put<ApiResponse<Category>>('categories/update', { ...payload, id });
  }

  delete(id: number) {
    return this.api.delete<ApiResponse<null>>('categories/delete', { id });
  }

  addAttribute(payload: Partial<CategoryAttribute>) {
    return this.api.post<ApiResponse<{ id: number }>>('categories/add-attribute', payload);
  }

  updateAttribute(id: number, payload: Partial<CategoryAttribute>) {
    return this.api.put<ApiResponse<null>>('categories/update-attribute', { ...payload, id });
  }

  deleteAttribute(id: number) {
    return this.api.delete<ApiResponse<null>>('categories/delete-attribute', { id });
  }
}
