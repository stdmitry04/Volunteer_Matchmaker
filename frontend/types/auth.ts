export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}
