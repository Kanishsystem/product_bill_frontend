import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: object): Observable<T> {
    return this.http.get<T>(`${this.base}/${path}`, { params: this.cleanParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}`, body);
  }

  postForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, formData);
  }

  delete<T>(path: string, params?: object): Observable<T> {
    return this.http.delete<T>(`${this.base}/${path}`, { params: this.cleanParams(params) });
  }

  private cleanParams(params?: object): Record<string, string> {
    const result: Record<string, string> = {};
    if (!params) {
      return result;
    }
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value !== null && value !== undefined && value !== '') {
        result[key] = String(value);
      }
    }
    return result;
  }
}
