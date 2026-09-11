export type UserRole = 'admin' | 'cashier' | 'inventory_manager';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string | null;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LoginResponse {
  status: number;
  data: {
    token: string;
    user: User;
  };
}
