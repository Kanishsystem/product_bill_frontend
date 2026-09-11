import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { Unit } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class UnitService {
  constructor(private api: ApiService) {}

  list() {
    return this.api.get<ApiResponse<Unit[]>>('units/list');
  }

  get(id: number) {
    return this.api.get<ApiResponse<Unit>>('units/get', { id });
  }

  create(payload: Partial<Unit>) {
    return this.api.post<ApiResponse<Unit>>('units/create', payload);
  }

  update(id: number, payload: Partial<Unit>) {
    return this.api.put<ApiResponse<Unit>>('units/update', { ...payload, id });
  }

  delete(id: number) {
    return this.api.delete<ApiResponse<null>>('units/delete', { id });
  }
}
