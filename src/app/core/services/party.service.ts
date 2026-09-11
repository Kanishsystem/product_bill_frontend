import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { Party, PartyType } from '../models/party.model';

@Injectable({ providedIn: 'root' })
export class PartyService {
  constructor(private api: ApiService) {}

  list(filters?: { party_type?: PartyType; search?: string }) {
    return this.api.get<ApiResponse<Party[]>>('parties/list', filters);
  }

  get(id: number) {
    return this.api.get<ApiResponse<Party>>('parties/get', { id });
  }

  create(payload: Partial<Party>) {
    return this.api.post<ApiResponse<Party>>('parties/create', payload);
  }

  quickCreate(payload: { name: string; phone?: string; email?: string; gstin?: string; address?: string }) {
    return this.api.post<ApiResponse<Party>>('parties/quick-create', payload);
  }

  update(id: number, payload: Partial<Party>) {
    return this.api.put<ApiResponse<Party>>('parties/update', { ...payload, id });
  }

  delete(id: number) {
    return this.api.delete<ApiResponse<null>>('parties/delete', { id });
  }
}
