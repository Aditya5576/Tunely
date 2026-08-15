export interface User {
  id?: string;
  name: string;
  email: string;
  isGuest?: boolean;
  role?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface AuthSession {
  token: string | null;
  user: User | null;
  expiresAt?: number;
}
