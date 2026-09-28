/* The browser demo has no admin login – password hashing is never needed. */
export async function hashPassword(password: string): Promise<string> {
  return `demo$${password.length}`;
}
export async function verifyPassword(): Promise<boolean> {
  return false;
}
