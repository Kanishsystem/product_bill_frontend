import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { User, UserRole } from '../models/user.model';

export interface UserCreateInput {
  name: string;
  email: string;
  username?: string;
  password: string;
  role: UserRole;
}

export interface UserUpdateInput {
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private api: ApiService) {}

  list(filters?: { role?: UserRole; status?: string; search?: string }) {
    return this.api.get<ApiResponse<User[]>>('users/list', filters);
  }

  get(id: number) {
    return this.api.get<ApiResponse<User>>('users/get', { id });
  }

  create(payload: UserCreateInput) {
    return this.api.post<ApiResponse<User>>('users/create', payload);
  }

  update(id: number, payload: UserUpdateInput) {
    return this.api.put<ApiResponse<User>>('users/update', { ...payload, id });
  }

  deactivate(id: number) {
    return this.api.post<ApiResponse<User>>('users/deactivate', { id });
  }

  activate(id: number) {
    return this.api.post<ApiResponse<User>>('users/activate', { id });
  }
}
