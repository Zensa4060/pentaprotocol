import axios from "axios";

export function getApiBaseUrl(): string {
  const envUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  const hostname = typeof window !== "undefined" ? window.location?.hostname : undefined;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  // Local dev should default to local backend even when a stale remote env URL is present.
  if (isLocalhost) {
    if (envUrl && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) return envUrl;
    return "http://localhost:8000";
  }

  if (envUrl) return envUrl;
  if (typeof window !== "undefined")
    return ""; // production: same origin (use rewrites/proxy so /api goes to backend)
  return "http://localhost:8000";
}

/** Convert the API base URL into a WebSocket base URL (http:// → ws://, https:// → wss://). */
export function getWsBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith("https://")) return base.replace("https://", "wss://");
  if (base.startsWith("http://")) return base.replace("http://", "ws://");
  // Empty (same-origin) → derive from window.location
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:8000";
}

const API = axios.create({
  baseURL: getApiBaseUrl(),
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("pp_token");
      localStorage.removeItem("pp_user");
      localStorage.removeItem("pp_expiry");
      // Optional: force reload or trigger store if possible, 
      // but clearing localStorage is enough for the next mount/refresh
    }
    return Promise.reject(error);
  }
);

export default API;