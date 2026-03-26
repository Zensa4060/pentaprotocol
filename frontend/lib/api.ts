import axios from "axios";

function getApiBaseUrl(): string {
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

const API = axios.create({
  baseURL: getApiBaseUrl(),
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;