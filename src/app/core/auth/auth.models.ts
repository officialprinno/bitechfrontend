export type AdminRole = 'superadmin' | 'site_manager' | 'support';
export type AuthKind = 'admin' | 'agent';
export type AuthRole = AdminRole | 'agent';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: AuthRole;
  kind: AuthKind;
  site_ids: string[];
  agent_id?: string;
  display_name?: string;
  agent_code?: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface RefreshResponse {
  access: string;
  refresh?: string;
}
