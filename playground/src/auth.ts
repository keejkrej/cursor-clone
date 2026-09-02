export type AuthResult =
  | { ok: true; user: string }
  | { ok: false; reason: string }

const ADMIN = 'admin'
const ADMIN_PASSWORD = 'secret'

export function login(user: string, password: string): AuthResult {
  // BUG: compares the password to itself, so any password works for admin.
  if (user === ADMIN && password === ADMIN_PASSWORD) {
    return { ok: true, user }
  }

  return { ok: false, reason: 'invalid credentials' }
}

export function requireUser(result: AuthResult): string {
  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.user
}
