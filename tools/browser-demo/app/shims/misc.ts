/* Small stand-ins for Node / Next server modules used by the app code. */

// ---- next/server
export class NextResponse extends Response {
  static json<T>(body: T, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }
  static redirect(url: string | URL, status = 307) {
    return new NextResponse(null, { status, headers: { location: String(url) } });
  }
  static next() {
    return new NextResponse(null);
  }
}
export const NextRequest = Request;
export function after(fn: () => unknown) {
  queueMicrotask(() => void fn());
}

// ---- next/headers (unused on the demo pages)
export async function headers() {
  return new Headers();
}
export async function cookies() {
  const store = new Map<string, string>();
  return {
    get: (k: string) => (store.has(k) ? { name: k, value: store.get(k)! } : undefined),
    set: (k: string, v: string) => void store.set(k, v),
    delete: (k: string) => void store.delete(k),
    getAll: () => [...store].map(([name, value]) => ({ name, value })),
  };
}

// ---- next/font/local
export default function localFont(options: { variable?: string }) {
  return { className: "", variable: "", style: { fontFamily: options.variable ?? "" } };
}

// ---- node:util
export function promisify<T extends (...args: never[]) => unknown>(fn: T) {
  return fn;
}
