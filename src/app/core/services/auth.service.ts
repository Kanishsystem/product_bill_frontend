import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, User } from '../models/user.model';

const TOKEN_KEY = 'product_bill_token';
const USER_KEY = 'product_bill_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenSignal = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));
  private userSignal = signal<User | null>(this.readStoredUser());

  readonly token = computed(() => this.tokenSignal());
  readonly currentUser = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly role = computed(() => this.userSignal()?.role ?? null);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  /** `login` accepts either the account's email or its username. */
  async login(login: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { login, password }),
    );
    const { token, user } = res.data;

    this.tokenSignal.set(token);
    this.userSignal.set(user);
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));

    return user;
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.router.navigate(['/login']);
  }

  private readStoredUser(): User | null {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }
}
