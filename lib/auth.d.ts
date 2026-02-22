export interface Session {
  userId: string;
  role: string;
  email: string;
  isVerified: boolean;
}

export function createSession(user: { id: string; role: string; email: string; is_verified?: boolean }): Promise<string>;
export function setSessionCookie(response: any, token: string): any;
export function clearSessionCookie(response: any): any;
export function verifySession(token: string): Promise<Session | null>;
export function getSession(request: Request): Session | null;
export function requireAuth(request: Request): { session: Session } | { error: string; status: number };
export function requireAdmin(request: Request): { session: Session } | { error: string; status: number };
