export type JsonRecord = Record<string, unknown>;

export type Landmark = {
  id: number;
  name: string;
  description: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  raw: JsonRecord;
};

export type Journey = {
  id: number;
  user_id?: number;
  title: string;
  started_at: string;
  ended_at: string | null;
};

export type JourneyPoint = {
  id: number;
  journey_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
  sequence_number: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("geotales_access_token");
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem("geotales_access_token", token);
  else window.sessionStorage.removeItem("geotales_access_token");
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof URLSearchParams) && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw new Error(`Cannot reach GeoTales API at ${API_BASE}. Start the backend and check CORS.`);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown; message?: unknown };
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((item) => (item as { msg?: string }).msg || "Validation error").join("; ");
      else if (typeof body.message === "string") message = body.message;
    } catch {
      // Keep the HTTP status message if the server did not return JSON.
    }
    if (response.status === 401) message = "Your session expired or the credentials are invalid. Please sign in again.";
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const result = await request<{ access_token: string }>("/auth/login", { method: "POST", body });
  if (!result.access_token) throw new Error("The API did not return an access token.");
  return result.access_token;
}

export async function register(name: string, email: string, password: string): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getCurrentUser(token: string): Promise<{ id: number; name: string; email: string }> {
  return request("/auth/me", {}, token);
}

export async function listLandmarks(token: string): Promise<Landmark[]> {
  const response = await request<unknown>("/landmarks", {}, token);
  const data = Array.isArray(response)
    ? response
    : (response && typeof response === "object" && Array.isArray((response as { items?: unknown[] }).items)
        ? (response as { items: unknown[] }).items
        : []);
  return data.map((item, index) => normalizeLandmark(item, index)).filter((item) => item.name.length > 0);
}

function normalizeLandmark(value: unknown, index: number): Landmark {
  const raw = (value && typeof value === "object" ? value : {}) as JsonRecord;
  const id = Number(raw.id ?? index + 1);
  const location = raw.location;
  let latitude = finiteNumber(raw.latitude ?? raw.lat);
  let longitude = finiteNumber(raw.longitude ?? raw.lon ?? raw.lng);

  if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && Array.isArray(location) && location.length >= 2) {
    // GeoJSON coordinate order is [longitude, latitude].
    longitude = finiteNumber(location[0]);
    latitude = finiteNumber(location[1]);
  }
  if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && location && typeof location === "object") {
    const loc = location as JsonRecord;
    const coords = Array.isArray(loc.coordinates) ? loc.coordinates : null;
    if (coords && coords.length >= 2) {
      longitude = finiteNumber(coords[0]);
      latitude = finiteNumber(coords[1]);
    } else {
      latitude = finiteNumber(loc.latitude ?? loc.lat ?? loc.y);
      longitude = finiteNumber(loc.longitude ?? loc.lon ?? loc.lng ?? loc.x);
    }
  }
  if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && typeof location === "string") {
    const match = location.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
    if (match) {
      longitude = Number(match[1]);
      latitude = Number(match[2]);
    }
  }

  return {
    id: Number.isFinite(id) ? id : index + 1,
    name: String(raw.name ?? raw.title ?? `Landmark ${index + 1}`),
    description: String(raw.description ?? "A place waiting to be explored."),
    category: String(raw.category ?? "Landmark"),
    latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? longitude : null,
    raw,
  };
}

function finiteNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

export async function listJourneys(token: string): Promise<Journey[]> {
  return request<Journey[]>("/journeys", {}, token);
}

export async function createJourney(token: string, title: string): Promise<Journey> {
  return request<Journey>("/journeys", { method: "POST", body: JSON.stringify({ title }) }, token);
}

export async function recordJourneyPoint(token: string, journeyId: number, latitude: number, longitude: number): Promise<JourneyPoint> {
  return request<JourneyPoint>(`/journeys/${journeyId}/points`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  }, token);
}

export async function listJourneyPoints(token: string, journeyId: number): Promise<JourneyPoint[]> {
  return request<JourneyPoint[]>(`/journeys/${journeyId}/points`, {}, token);
}

export async function finishJourney(token: string, journeyId: number): Promise<Journey> {
  return request<Journey>(`/journeys/${journeyId}/finish`, { method: "POST" }, token);
}

export async function narrateLandmark(token: string, landmark: Landmark): Promise<string> {
  const result = await request<JsonRecord>("/ai/narrate", {
    method: "POST",
    body: JSON.stringify({ landmark_id: landmark.id }),
  }, token);
  const text = result.narration ?? result.text ?? result.answer ?? result.content ?? result.message;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Narration returned an unexpected response. Check the /ai/narrate request schema in Swagger.");
  }
  return text;
}
