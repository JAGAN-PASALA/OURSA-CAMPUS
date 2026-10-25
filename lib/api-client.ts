import { Capacitor } from "@capacitor/core";

declare const __MOBILE_API_ORIGIN__: string;
export const nativePlatform = () => Capacitor.isNativePlatform();
const tokenKey = "ours.access_token";

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (!nativePlatform()) return fetch(input, init);
  const origin = typeof __MOBILE_API_ORIGIN__ === "string" ? __MOBILE_API_ORIGIN__ : "";
  if (!origin.startsWith("https://")) throw new Error("This mobile build needs a configured HTTPS API address.");
  const url = new URL(input, origin);
  if (url.origin !== new URL(origin).origin) throw new Error("Requests must use the configured college portal.");
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  const headers = new Headers(init.headers);
  const token = await SecureStorage.get(tokenKey);
  if (typeof token === "string" && token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Client-Platform", Capacitor.getPlatform());
  const response = await fetch(url.href, { ...init, headers, credentials: "omit" });
  if (response.ok && ["/api/auth/login", "/api/auth/change-password"].includes(url.pathname)) {
    const data = await response.clone().json();
    if (data.access_token) await SecureStorage.set(tokenKey, data.access_token);
  }
  if ((response.ok && url.pathname === "/api/auth/logout") || response.status === 401) await SecureStorage.remove(tokenKey);
  return response;
}

export async function request<T>(path: string, method = "GET", body?: object): Promise<T> {
  const headers: Record<string, string> = {};
  const slug = typeof window === "undefined" ? "" : localStorage.getItem("ours_institution_slug");
  if (slug) headers["X-Institution-Slug"] = slug;
  if (body) headers["Content-Type"] = "application/json";
  const response = await apiFetch(path, { method, headers, credentials: "include", body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to complete the request");
  return data;
}
