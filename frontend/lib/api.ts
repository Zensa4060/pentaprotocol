import axios from "axios";

function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location?.hostname !== "localhost" && window.location?.hostname !== "127.0.0.1")
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