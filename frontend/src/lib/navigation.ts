export type LatLng = [number, number];

export type PlaceSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  source: "search" | "gps";
};

export type RouteResult = {
  path: LatLng[];
  distanceKm: number;
  durationMinutes: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type PhotonResponse = { features?: PhotonFeature[] };

/** Search places as the user types. Photon is an OpenStreetMap-based geocoder. */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  bias?: LatLng | null,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");

  if (bias) {
    url.searchParams.set("lat", String(bias[0]));
    url.searchParams.set("lon", String(bias[1]));
    url.searchParams.set("zoom", "12");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/geo+json, application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error("Place search is temporarily unavailable. Please try again.");
  }

  const data = (await response.json()) as PhotonResponse;
  return (data.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties;
    if (!coordinates || coordinates.length < 2 || !properties) return [];

    // GeoJSON coordinates are [longitude, latitude].
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const primary = properties.name || [properties.housenumber, properties.street].filter(Boolean).join(" ") || properties.street || properties.city;
    const area = [properties.district, properties.city, properties.state, properties.country]
      .filter((part): part is string => Boolean(part));
    const uniqueArea = [...new Set(area.filter((part) => part !== primary))];
    const label = [primary, uniqueArea.join(", ")].filter(Boolean).join(", ") || trimmed;

    return [{ label, latitude, longitude, source: "search" as const }];
  });
}

/** Calculate a road route between [latitude, longitude] points with OSRM. */
export async function calculateDrivingRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const [fromLat, fromLon] = from;
  const [toLat, toLon] = to;
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;

  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("The routing service did not respond. Please try again.");
  }

  const data = (await response.json()) as {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  };
  const route = data.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (data.code !== "Ok" || !route || !coordinates?.length) {
    throw new Error("No drivable route was found between these locations.");
  }

  return {
    // OSRM GeoJSON coordinates are [longitude, latitude]; Leaflet expects [latitude, longitude].
    path: coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
  };
}
