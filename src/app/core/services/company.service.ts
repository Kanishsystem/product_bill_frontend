import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/pagination.model';
import { CompanyProfile } from '../models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  constructor(private api: ApiService) {}

  get() {
    return this.api.get<ApiResponse<CompanyProfile>>('company/get');
  }

  update(payload: Partial<CompanyProfile>) {
    return this.api.put<ApiResponse<CompanyProfile>>('company/update', payload);
  }

  /** Uploads a new invoice-heading image (replacing any previous one) and
   * returns the refreshed company profile, same shape as get()/update(). */
  uploadHeaderImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.api.postForm<ApiResponse<CompanyProfile>>('company/upload-header-image', formData);
  }

  /** Reverts the invoice heading back to plain shop name/address text. */
  removeHeaderImage() {
    return this.api.post<ApiResponse<CompanyProfile>>('company/remove-header-image', {});
  }
}
