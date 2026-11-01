"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import "./route-planner.css";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { LatLng } from "../components/ExploreMap";
import LocationAutocomplete from "../components/LocationAutocomplete";
import { calculateDrivingRoute, type PlaceSuggestion, type RouteResult } from "../lib/navigation";
import {
  createJourney,
  finishJourney,
  getCurrentUser,
  getStoredToken,
  listJourneyPoints,
  listJourneys,
  listLandmarks,
  login,
  narrateLandmark,
  recordJourneyPoint,
  register,
  setStoredToken,
  type Journey,
  type JourneyPoint,
  type Landmark,
} from "../lib/goetales-api";

const ExplorerMap = dynamic(() => import("../components/ExploreMap"), {
  ssr: false,
  loading: () => <div className="gt-map-loading"><span className="gt-loader" /> Preparing your map…</div>,
});

type User = { id: number; name: string; email: string };
type ViewName = "explorer" | "journeys" | "achievements";
const DEFAULT_SEARCH_BIAS: LatLng = [17.385, 78.4867];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function formatDate(value?: string | null): string {
  if (!value) return "In progress";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function categoryLabel(category: string): string {
  return category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const radians = (n: number) => (n * Math.PI) / 180;
  const dLat = radians(b[0] - a[0]);
  const dLon = radians(b[1] - a[1]);
  const lat1 = radians(a[0]);
  const lat2 = radians(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [routeOrigin, setRouteOrigin] = useState<PlaceSuggestion | null>(null);
  const [routeDestination, setRouteDestination] = useState<PlaceSuggestion | null>(null);
  const [view, setView] = useState<ViewName>("explorer");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [trailPoints, setTrailPoints] = useState<JourneyPoint[]>([]);
  const [historySelection, setHistorySelection] = useState<number | null>(null);
  const [narration, setNarration] = useState("");
  const [narrating, setNarrating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingLandmarks, setLoadingLandmarks] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [filter, setFilter] = useState("All");

  const watchIdRef = useRef<number | null>(null);
  const activeJourneyRef = useRef<Journey | null>(null);
  const lastRecordedRef = useRef<{ point: LatLng; at: number } | null>(null);
  const locationWatchBusyRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (!existingToken) return;

    let cancelled = false;
    getCurrentUser(existingToken)
      .then((profile) => {
        if (cancelled) return;
        // Restore the session only after the backend validates the saved token.
        // These updates happen in the asynchronous response, not synchronously
        // inside the effect body.
        setLoadingLandmarks(true);
        setLoadingHistory(true);
        setToken(existingToken);
        setUser(profile);
      })
      .catch(() => {
        if (cancelled) return;
        setStoredToken(null);
        // token and user already start as null; no reset is necessary here.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refreshLandmarks = useCallback(async (accessToken: string) => {
    setLoadingLandmarks(true);
    try {
      const items = await listLandmarks(accessToken);
      setLandmarks(items);
      setSelectedLandmark((current) => current ? items.find((item) => item.id === current.id) || current : items[0] || null);
      if (!items.length) setNotice({ type: "info", text: "No landmarks yet. Add landmark records to the backend database to populate the map." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setLoadingLandmarks(false);
    }
  }, []);

  const refreshJourneys = useCallback(async (accessToken: string) => {
    setLoadingHistory(true);
    try {
      setJourneys(await listJourneys(accessToken));
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    // Initial data loading updates React state after the API promises settle.
    // Keep the event-driven refresh callbacks below for manual refresh actions.
    const loadLandmarks = async () => {
      try {
        const items = await listLandmarks(token);
        if (cancelled) return;
        setLandmarks(items);
        setSelectedLandmark((current) =>
          current
            ? items.find((item) => item.id === current.id) || current
            : items[0] || null,
        );
        if (!items.length) {
          setNotice({
            type: "info",
            text: "No landmarks yet. Add landmark records to the backend database to populate the map.",
          });
        }
      } catch (error) {
        if (!cancelled) setNotice({ type: "error", text: errorMessage(error) });
      } finally {
        if (!cancelled) setLoadingLandmarks(false);
      }
    };

    const loadJourneys = async () => {
      try {
        const items = await listJourneys(token);
        if (!cancelled) setJourneys(items);
      } catch (error) {
        if (!cancelled) setNotice({ type: "error", text: errorMessage(error) });
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    void loadLandmarks();
    void loadJourneys();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleLandmarks = useMemo(() => {
    return landmarks.filter((landmark) =>
      filter === "All" || landmark.category.toLowerCase().includes(filter.toLowerCase()),
    );
  }, [landmarks, filter]);

  const localPlaceSuggestions = useMemo<PlaceSuggestion[]>(() =>
    landmarks.flatMap((landmark) =>
      landmark.latitude == null || landmark.longitude == null
        ? []
        : [{
            label: landmark.name,
            latitude: landmark.latitude,
            longitude: landmark.longitude,
            source: "search" as const,
          }],
    ),
  [landmarks]);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    locationWatchBusyRef.current = false;
  }, []);

  useEffect(() => () => stopLocationWatch(), [stopLocationWatch]);

  const locateUser = useCallback((): Promise<LatLng> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("This browser does not provide geolocation. Try the app in Chrome or Edge."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point: LatLng = [position.coords.latitude, position.coords.longitude];
          setCurrentPosition(point);
          resolve(point);
        },
        (error) => {
          const messages: Record<number, string> = {
            1: "Location permission was denied. Allow location access in your browser and try again.",
            2: "Your current location is unavailable. Check the device location settings.",
            3: "Location lookup timed out. Please retry.",
          };
          reject(new Error(messages[error.code] || "Unable to read your current location."));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    });
  }, []);

  const calculateRoute = useCallback(
    (from: LatLng, to: LatLng): Promise<RouteResult> => calculateDrivingRoute(from, to),
    [],
  );

  const handleQuickPlaceSelect = useCallback((place: PlaceSuggestion) => {
    setView("explorer");
    setDestinationText(place.label);
    setRouteDestination(place);
    setSelectedLandmark(
      landmarks.find((landmark) =>
        landmark.name.toLocaleLowerCase() === place.label.toLocaleLowerCase() ||
        (landmark.latitude != null && landmark.longitude != null &&
          Math.abs(landmark.latitude - place.latitude) < 0.00001 &&
          Math.abs(landmark.longitude - place.longitude) < 0.00001),
      ) || null,
    );
    setRoutePath([]);
    setRouteResult(null);
    window.setTimeout(() => {
      document.getElementById("gt-route-planner")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [landmarks]);

  const handleUseCurrentLocation = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const point = await locateUser();
      const place: PlaceSuggestion = {
        label: "Current location",
        latitude: point[0],
        longitude: point[1],
        source: "gps",
      };
      setOriginText(place.label);
      setRouteOrigin(place);
      setRoutePath([]);
      setRouteResult(null);
      setNotice({ type: "success", text: "Starting point set to your current location." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [locateUser]);

  const handleShowRoute = useCallback(async () => {
    if (!routeDestination) {
      setNotice({ type: "info", text: "Search for a destination and select one of the suggestions first." });
      return;
    }
    if (originText.trim() && !routeOrigin) {
      setNotice({ type: "info", text: "Choose a starting location from the suggestions, or use your current location." });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      let start = routeOrigin;
      if (!start) {
        const point = await locateUser();
        start = {
          label: "Current location",
          latitude: point[0],
          longitude: point[1],
          source: "gps",
        };
        setOriginText(start.label);
        setRouteOrigin(start);
      }

      const route = await calculateRoute(
        [start.latitude, start.longitude],
        [routeDestination.latitude, routeDestination.longitude],
      );
      setRoutePath(route.path);
      setRouteResult(route);
      setTrailPoints([]);
      setNotice({
        type: "success",
        text: `Route ready · ${route.distanceKm.toFixed(1)} km · about ${Math.max(1, Math.round(route.durationMinutes))} min by road.`,
      });
    } catch (error) {
      setRoutePath([]);
      setRouteResult(null);
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [routeOrigin, routeDestination, originText, locateUser, calculateRoute]);

  const handleDirections = useCallback(async () => {
    if (!selectedLandmark) {
      setNotice({ type: "info", text: "Choose a landmark first to plan a route." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const location = currentPosition || await locateUser();
      if (selectedLandmark.latitude == null || selectedLandmark.longitude == null) {
        throw new Error("This landmark does not have usable coordinates.");
      }
      const destination: LatLng = [selectedLandmark.latitude, selectedLandmark.longitude];
      const route = await calculateRoute(location, destination);
      const startPlace: PlaceSuggestion = { label: "Current location", latitude: location[0], longitude: location[1], source: "gps" };
      const endPlace: PlaceSuggestion = { label: selectedLandmark.name, latitude: destination[0], longitude: destination[1], source: "search" };
      setRouteOrigin(startPlace);
      setOriginText(startPlace.label);
      setRouteDestination(endPlace);
      setDestinationText(endPlace.label);
      setRoutePath(route.path);
      setRouteResult(route);
      setTrailPoints([]);
      setNotice({ type: "success", text: `Route ready · ${route.distanceKm.toFixed(1)} km · about ${Math.max(1, Math.round(route.durationMinutes))} min by road.` });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [selectedLandmark, currentPosition, locateUser, calculateRoute]);

  const handleStartJourney = useCallback(async () => {
    if (!token) {
      setAuthOpen(true);
      setNotice({ type: "info", text: "Sign in to record a journey to your GeoTales history." });
      return;
    }
    if (activeJourneyRef.current) {
      setNotice({ type: "info", text: "A journey is already recording. Finish it before starting another." });
      return;
    }
    const journeyDestination = routeDestination ?? (selectedLandmark?.latitude != null && selectedLandmark.longitude != null
      ? { label: selectedLandmark.name, latitude: selectedLandmark.latitude, longitude: selectedLandmark.longitude, source: "search" as const }
      : null);
    if (!journeyDestination) {
      setNotice({ type: "info", text: "Choose a destination and calculate a route before starting a journey." });
      return;
    }
    if (routeOrigin && routeOrigin.source !== "gps") {
      setNotice({ type: "info", text: "For live GPS tracking, set the starting point to your current location. Manual starting points are available for route preview." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const location = await locateUser();
      const destination: LatLng = [journeyDestination.latitude, journeyDestination.longitude];
      // Recalculate from the fresh GPS position so the displayed route starts where tracking begins.
      const calculated = await calculateRoute(location, destination);
      const liveOrigin: PlaceSuggestion = {
        label: "Current location",
        latitude: location[0],
        longitude: location[1],
        source: "gps",
      };
      setRouteOrigin(liveOrigin);
      setOriginText(liveOrigin.label);
      const accessToken = tokenRef.current;
      if (!accessToken) throw new Error("Please sign in again before starting a journey.");
      const journey = await createJourney(accessToken, `To ${journeyDestination.label}`);
      activeJourneyRef.current = journey;
      setActiveJourney(journey);
      setHistorySelection(null);
      setRoutePath(calculated?.path || []);
      setRouteResult(calculated);
      setTrailPoints([]);
      lastRecordedRef.current = { point: location, at: Date.now() };
      const firstPoint = await recordJourneyPoint(accessToken, journey.id, location[0], location[1]);
      setTrailPoints([firstPoint]);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const point: LatLng = [position.coords.latitude, position.coords.longitude];
          setCurrentPosition(point);
          setTrailPoints((current) => {
            const previous = current[current.length - 1];
            if (!previous || haversineMeters([previous.latitude, previous.longitude], point) >= 4) {
              // Local trail is responsive; API recording is throttled below.
              return [...current, {
                id: -Date.now(),
                journey_id: journey.id,
                latitude: point[0],
                longitude: point[1],
                recorded_at: new Date().toISOString(),
                sequence_number: current.length + 1,
              }];
            }
            return current;
          });

          const last = lastRecordedRef.current;
          const now = Date.now();
          const shouldPersist = !last || now - last.at >= 10000 || haversineMeters(last.point, point) >= 20;
          if (!shouldPersist || locationWatchBusyRef.current) return;
          const currentToken = tokenRef.current;
          if (!currentToken) return;
          locationWatchBusyRef.current = true;
          try {
            const saved = await recordJourneyPoint(currentToken, journey.id, point[0], point[1]);
            lastRecordedRef.current = { point, at: now };
            setTrailPoints((current) => {
              const withoutPending = current.filter((p) => p.id >= 0);
              return [...withoutPending, saved];
            });
          } catch (error) {
            setNotice({ type: "error", text: `Location is updating locally, but saving a GPS point failed: ${errorMessage(error)}` });
          } finally {
            locationWatchBusyRef.current = false;
          }
        },
        (error) => {
          const text = error.code === 1
            ? "Location permission was revoked. The journey remains open, but the live trail is paused."
            : "Live location updates were interrupted. Check device location and GPS permissions.";
          setNotice({ type: "error", text });
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
      setNotice({ type: "success", text: "Journey started. GeoTales is recording your location trail while this page is open." });
      setView("explorer");
      await refreshJourneys(accessToken);
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [token, routeDestination, routeOrigin, selectedLandmark, routeResult, locateUser, calculateRoute, refreshJourneys]);

  const handleFinishJourney = useCallback(async () => {
    const journey = activeJourneyRef.current;
    const accessToken = tokenRef.current;
    if (!journey || !accessToken) return;
    setBusy(true);
    try {
      const finished = await finishJourney(accessToken, journey.id);
      stopLocationWatch();
      activeJourneyRef.current = null;
      setActiveJourney(null);
      setNotice({ type: "success", text: `Journey saved: ${finished.title}` });
      await refreshJourneys(accessToken);
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [stopLocationWatch, refreshJourneys]);

  const handleViewJourney = useCallback(async (journey: Journey) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    setHistorySelection(journey.id);
    setSelectedLandmark(null);
    setRoutePath([]);
    setRouteResult(null);
    setLoadingHistory(true);
    try {
      const points = await listJourneyPoints(accessToken, journey.id);
      setTrailPoints(points);
      if (points.length) setCurrentPosition([points[points.length - 1].latitude, points[points.length - 1].longitude]);
      setView("journeys");
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleNarrate = useCallback(async () => {
    const accessToken = tokenRef.current;
    if (!accessToken) {
      setAuthOpen(true);
      return;
    }
    if (!selectedLandmark) return;
    setNarrating(true);
    setNarration("");
    try {
      setNarration(await narrateLandmark(accessToken, selectedLandmark));
    } catch (error) {
      setNotice({ type: "error", text: `Narration did not connect: ${errorMessage(error)}` });
    } finally {
      setNarrating(false);
    }
  }, [selectedLandmark]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setNotice(null);
    try {
      if (authMode === "register") await register(authName.trim(), authEmail.trim(), authPassword);
      const nextToken = await login(authEmail.trim(), authPassword);
      setStoredToken(nextToken);
      setLoadingLandmarks(true);
      setLoadingHistory(true);
      setToken(nextToken);
      tokenRef.current = nextToken;
      const profile = await getCurrentUser(nextToken);
      setUser(profile);
      setAuthOpen(false);
      setAuthPassword("");
      setNotice({ type: "success", text: `Welcome to GeoTales, ${profile.name}.` });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    if (activeJourneyRef.current) {
      setNotice({ type: "info", text: "Finish and save your active journey before signing out so the live trail is not interrupted." });
      return;
    }
    stopLocationWatch();
    setStoredToken(null);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setLoadingLandmarks(false);
    setLoadingHistory(false);
    setLandmarks([]);
    setJourneys([]);
    setActiveJourney(null);
    activeJourneyRef.current = null;
    setTrailPoints([]);
    setRoutePath([]);
    setRouteResult(null);
    setRouteOrigin(null);
    setRouteDestination(null);
    setOriginText("");
    setDestinationText("");
    setNotice({ type: "info", text: "You have signed out." });
  };

  const categories = useMemo(() => {
    const all = Array.from(new Set(landmarks.map((item) => categoryLabel(item.category))));
    return ["All", ...all.slice(0, 4)];
  }, [landmarks]);

  return (
    <main className="gt-app">
      <aside className="gt-sidebar">
        <a href="#explorer" className="gt-brand">
  <Image
    src="/geotales_logo_typewrite.png"
    alt="GeoTales"
    width={1400}
    height={405}
    priority
    style={{
      width: "185px",
      height: "auto",
    }}
  />
</a>
        <div className="gt-nav-label">YOUR JOURNEY</div>
        <nav className="gt-navigation" aria-label="Main navigation">
          <button type="button" className={`gt-nav-item ${view === "explorer" ? "is-active" : ""}`} onClick={() => setView("explorer")}><span>⌖</span> Explore <i /></button>
          <button type="button" className={`gt-nav-item ${view === "journeys" ? "is-active" : ""}`} onClick={() => { setView("journeys"); if (token) void refreshJourneys(token); }}><span>↗</span> My journeys <i /></button>
          <button type="button" className={`gt-nav-item ${view === "achievements" ? "is-active" : ""}`} onClick={() => { setView("achievements"); setNotice({ type: "info", text: "Achievement UI is queued after the core journey MVP. Journey history and GPS recording are connected first." }); }}><span>✧</span> Achievements <i /></button>
        </nav>
        <div className="gt-sidebar-bottom">
          <div className="gt-avatar">{user?.name?.slice(0, 1).toUpperCase() || "G"}</div>
          <div className="gt-user-copy"><strong>{user?.name || "Guest explorer"}</strong><span>{user?.email || "Sign in to record journeys"}</span></div>
          <span className={`gt-online-dot ${token ? "" : "is-muted"}`} />
        </div>
      </aside>

      <section className="gt-workspace">
        <header className="gt-topbar">
          <div className="gt-breadcrumb"><span>GeoTales</span><span>›</span><strong>{view === "journeys" ? "My journeys" : view === "achievements" ? "Achievements" : "Explorer"}</strong></div>
          <div className="gt-global-search" role="search" aria-label="Search all places">
            <span aria-hidden="true">⌕</span>
            <LocationAutocomplete
              label="Search places"
              compact
              value={destinationText}
              placeholder="Search any place, address or landmark…"
              onValueChange={(value) => {
                setDestinationText(value);
                setRouteDestination(null);
                setSelectedLandmark(null);
                setRoutePath([]);
                setRouteResult(null);
              }}
              onSelect={handleQuickPlaceSelect}
              bias={currentPosition || DEFAULT_SEARCH_BIAS}
              localPlaces={localPlaceSuggestions}
            />
            <kbd>PLACES</kbd>
          </div>
          <span className="gt-preview-status"><i /> {token ? "API CONNECTED" : "PREVIEW MODE"}</span>
          <button type="button" className="gt-user-button" onClick={() => token ? handleLogout() : setAuthOpen(true)} title={token ? "Sign out" : "Sign in"}>{token ? user?.name?.slice(0, 1).toUpperCase() || "G" : "↗"}</button>
        </header>

        <div className="gt-content">
          {view === "explorer" && (
            <>
              <section className="gt-hero-row">
                <div><span className="gt-eyebrow"><i /> FIND YOUR WAY TO WONDER</span><h1>Every street holds <em>a story.</em></h1><p>Find the places, people, and little detours that make a journey unforgettable.</p></div>
                <div className="gt-golden-note"><span>☼</span><div><strong>Golden hour, anywhere</strong><small>Curated for curious souls</small></div></div>
              </section>

              <section className="gt-map-section" aria-label="Interactive landmark map">
                <div className="gt-map-topline"><div><span className="gt-section-overline">THE WORLD, A LITTLE CLOSER</span><h2>Explore around you</h2></div><div className="gt-map-meta"><span className="gt-live-badge"><i /> LIVE MAP</span><span>{loadingLandmarks ? "Finding places…" : `${visibleLandmarks.length} places`}</span></div></div>
                <section className="gt-route-planner" id="gt-route-planner" aria-label="Plan a route">
                  <div className="gt-route-planner-heading">
                    <div>
                      <span className="gt-route-kicker">PLAN YOUR JOURNEY</span>
                      <h3>Where to next?</h3>
                      <p>Choose a starting point and destination to see your route.</p>
                    </div>
                    <span className="gt-route-step">01 <i>—</i> 02</span>
                  </div>
                  <div className="gt-route-fields">
                    <div className="gt-route-inputs">
                      <LocationAutocomplete
                        label="FROM"
                        value={originText}
                        placeholder="Current location or enter a place"
                        onValueChange={(value) => { setOriginText(value); setRouteOrigin(null); setRoutePath([]); setRouteResult(null); }}
                        onSelect={(place) => { setRouteOrigin(place); setOriginText(place.label); setRoutePath([]); setRouteResult(null); }}
                        bias={currentPosition || DEFAULT_SEARCH_BIAS}
                        localPlaces={localPlaceSuggestions}
                        disabled={Boolean(activeJourney)}
                      />
                      <LocationAutocomplete
                        label="TO"
                        value={destinationText}
                        placeholder="Search destination or landmark"
                        onValueChange={(value) => { setDestinationText(value); setRouteDestination(null); setSelectedLandmark(null); setRoutePath([]); setRouteResult(null); }}
                        onSelect={(place) => { setRouteDestination(place); setDestinationText(place.label); setSelectedLandmark(null); setRoutePath([]); setRouteResult(null); }}
                        bias={currentPosition || DEFAULT_SEARCH_BIAS}
                        localPlaces={localPlaceSuggestions}
                        disabled={Boolean(activeJourney)}
                      />
                    </div>
                    <div className="gt-route-actions">
                      <button type="button" className="gt-use-location" onClick={() => void handleUseCurrentLocation()} disabled={busy || Boolean(activeJourney)}>
                        <span aria-hidden="true">⌖</span> Use my location
                      </button>
                      <button type="button" className="gt-button gt-button-dark gt-route-submit" onClick={() => void handleShowRoute()} disabled={busy || Boolean(activeJourney)}>
                        {busy ? "Finding route…" : "Show route ↗"}
                      </button>
                    </div>
                  </div>
                  <p className="gt-place-attribution">Place search data © OpenStreetMap contributors · Powered by Photon</p>
                  {routeResult && routeDestination && (
                    <div className="gt-route-planner-summary">
                      <span><strong>{routeResult.distanceKm.toFixed(1)} km</strong><small>Distance</small></span>
                      <span><strong>{Math.max(1, Math.round(routeResult.durationMinutes))} min</strong><small>Estimated drive</small></span>
                      <span className="gt-route-planner-destination">To {routeDestination.label}</span>
                      {!activeJourney && routeOrigin?.source === "gps" && <button type="button" className="gt-button gt-button-light" onClick={() => void handleStartJourney()} disabled={busy}>{busy ? "Starting…" : "Start journey"}</button>}
                      {!activeJourney && routeOrigin?.source !== "gps" && <small className="gt-route-tracking-note">Set your origin to Current location to record a live GPS journey.</small>}
                    </div>
                  )}
                </section>

                <div className="gt-map-frame">
                  <ExplorerMap
                    landmarks={visibleLandmarks}
                    selectedLandmark={selectedLandmark}
                    currentPosition={currentPosition}
                    routePath={routePath}
                    trailPoints={trailPoints}
                    routeOrigin={routeOrigin}
                    routeDestination={routeDestination}
                    onSelectLandmark={(landmark) => {
                      setSelectedLandmark(landmark);
                      setNarration("");
                      if (landmark.latitude != null && landmark.longitude != null) {
                        const place: PlaceSuggestion = { label: landmark.name, latitude: landmark.latitude, longitude: landmark.longitude, source: "search" };
                        setRouteDestination(place);
                        setDestinationText(place.label);
                        setRoutePath([]);
                        setRouteResult(null);
                      }
                    }}
                  />
                  <div className="gt-map-intro"><span className="gt-eyebrow">GEO TALES / FIELD NOTES</span><h2>Let curiosity<br /><em>lead the way.</em></h2><p>Pick a pin. Find a story. Start wandering.</p></div>
                  <div className="gt-map-bottom-left"><span className="gt-map-legend-dot" /> {activeJourney ? "JOURNEY RECORDING" : routeResult ? "ROUTE PLANNED" : "LANDMARK EXPLORATION"}</div>
                  {selectedLandmark && (
                    <aside className="gt-place-card">
                      <div className="gt-place-card-top"><span className="gt-place-category">{categoryLabel(selectedLandmark.category)}</span><span className="gt-place-number">GT / {String(selectedLandmark.id).padStart(2, "0")}</span></div>
                      <h3>{selectedLandmark.name}</h3>
                      <p>{selectedLandmark.description || "A place waiting to reveal its story."}</p>
                      <div className="gt-place-coordinates">{selectedLandmark.latitude != null && selectedLandmark.longitude != null ? `${selectedLandmark.latitude.toFixed(4)}°, ${selectedLandmark.longitude.toFixed(4)}°` : "Coordinates unavailable"}</div>
                      {routeResult && <div className="gt-route-summary"><strong>{routeResult.distanceKm.toFixed(1)} km</strong><span>≈ {Math.max(1, Math.round(routeResult.durationMinutes))} min by road</span></div>}
                      <div className="gt-place-actions"><button type="button" className="gt-button gt-button-light" onClick={() => void handleDirections()} disabled={busy || selectedLandmark.latitude == null || selectedLandmark.longitude == null}>{busy ? "Working…" : "Get directions ↗"}</button>
                      {!activeJourney ? <button type="button" className="gt-button gt-button-dark" onClick={() => void handleStartJourney()} disabled={busy}>{busy ? "Starting…" : "Start journey"}</button> : <button type="button" className="gt-button gt-button-stop" onClick={() => void handleFinishJourney()} disabled={busy}>{busy ? "Saving…" : "Finish journey"}</button>}</div>
                      <button type="button" className="gt-narrate-link" onClick={() => void handleNarrate()} disabled={narrating}>{narrating ? "Listening to the past…" : "Hear the story of this place ↗"}</button>
                      {narration && <div className="gt-narration">{narration}</div>}
                    </aside>
                  )}
                  {!token && <div className="gt-map-signin"><strong>Your next story awaits.</strong><span>Sign in to load saved landmarks and record your journey.</span><button type="button" className="gt-button gt-button-light" onClick={() => setAuthOpen(true)}>Sign in / create account ↗</button></div>}
                </div>
                <div className="gt-map-caption"><span>OpenStreetMap · Map data © OpenStreetMap contributors</span><span>{currentPosition ? `Your location ${currentPosition[0].toFixed(4)}, ${currentPosition[1].toFixed(4)}` : "Allow location access when planning a route"}</span></div>
              </section>

              <section className="gt-discovery-section">
                <div className="gt-discovery-heading"><div><span className="gt-section-overline">SMALL DETOURS, BIG STORIES</span><h2>Places worth the pause</h2></div><div className="gt-filter-row">{categories.map((category) => <button key={category} type="button" className={filter === (category === "All" ? "All" : category) ? "is-active" : ""} onClick={() => setFilter(category === "All" ? "All" : category)}>{category}</button>)}</div></div>
                {loadingLandmarks ? <div className="gt-state-card"><span className="gt-loader" /> Finding places to explore…</div> : visibleLandmarks.length ? <div className="gt-landmark-grid">{visibleLandmarks.slice(0, 8).map((landmark, index) => <article className={`gt-landmark-card gt-card-tone-${index % 4}`} key={landmark.id}><button type="button" className="gt-landmark-card-select" onClick={() => { setSelectedLandmark(landmark); if (landmark.latitude != null && landmark.longitude != null) { const place: PlaceSuggestion = { label: landmark.name, latitude: landmark.latitude, longitude: landmark.longitude, source: "search" }; setRouteDestination(place); setDestinationText(place.label); } setRoutePath([]); setRouteResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="gt-card-number">FIELD NOTE {String(index + 1).padStart(2, "0")}</span><span className="gt-card-symbol">{index % 4 === 0 ? "✺" : index % 4 === 1 ? "⌖" : index % 4 === 2 ? "❋" : "↗"}</span><span className="gt-card-category">{categoryLabel(landmark.category)}</span><strong>{landmark.name}</strong><p>{landmark.description || "A place waiting to reveal its story."}</p><span className="gt-card-cta">Explore this place <span>↗</span></span></button></article>)}</div> : <div className="gt-state-card"><strong>{token ? "No landmarks to show yet" : "Your map is ready when you are"}</strong><p>{token ? "The backend returned no landmarks matching this search. Add seeded landmarks or adjust the search." : "Sign in to load real landmark records from the GeoTales API."}</p></div>}
              </section>
            </>
          )}

          {view === "journeys" && (
            <section className="gt-history-view">
              <div className="gt-history-heading"><span className="gt-eyebrow"><i /> YOUR TRAVEL NOTES</span><h1>Every journey leaves <em>a trail.</em></h1><p>Your finished explorations and the paths you recorded.</p></div>
              <div className="gt-history-layout"><div className="gt-history-list"><div className="gt-history-list-head"><h2>Journey history</h2><button type="button" onClick={() => token && void refreshJourneys(token)}>Refresh ↻</button></div>
                {loadingHistory ? <div className="gt-state-card">Loading history…</div> : journeys.length ? journeys.map((journey) => <button type="button" key={journey.id} className={`gt-history-item ${historySelection === journey.id ? "is-selected" : ""}`} onClick={() => void handleViewJourney(journey)}><span className="gt-history-icon">↗</span><span><strong>{journey.title}</strong><small>Started {formatDate(journey.started_at)}</small><small>{journey.ended_at ? `Finished ${formatDate(journey.ended_at)}` : "In progress on server"}</small></span><span className="gt-history-arrow">→</span></button>) : <div className="gt-state-card"><strong>No journeys saved yet.</strong><p>Return to Explore, choose a landmark, and start your first journey.</p><button type="button" className="gt-button gt-button-dark" onClick={() => setView("explorer")}>Find a place ↗</button></div>}
              </div><div className="gt-history-map"><div className="gt-history-map-head"><span className="gt-section-overline">RECORDED TRAIL</span><span>{trailPoints.length} GPS points</span></div><ExplorerMap landmarks={[]} selectedLandmark={null} currentPosition={currentPosition} routePath={[]} trailPoints={trailPoints} onSelectLandmark={setSelectedLandmark} />{historySelection && <div className="gt-history-trail-note">Selected journey #{historySelection} · {trailPoints.length} recorded points</div>}</div></div>
            </section>
          )}

          {view === "achievements" && <section className="gt-history-view"><div className="gt-history-heading"><span className="gt-eyebrow"><i /> YOUR TRAVEL MILESTONES</span><h1>Collect stories, <em>not just stamps.</em></h1><p>Achievement endpoints are the next integration after the core journey flow. Your journeys and GPS trail are already the foundation for milestone tracking.</p><button type="button" className="gt-button gt-button-dark" onClick={() => setView("journeys")}>View journey history ↗</button></div></section>}

          <footer className="gt-footer"><span>GEOTALES <i>·</i> FIND YOUR WAY TO WONDER</span><span>Wander thoughtfully. Leave a lighter footprint.</span></footer>
        </div>
      </section>

      {activeJourney && <div className="gt-recording-ribbon"><span className="gt-recording-pulse" /><div><strong>Journey in progress</strong><small>{activeJourney.title} · {trailPoints.length} trail points</small></div><button type="button" onClick={() => void handleFinishJourney()} disabled={busy}>{busy ? "Saving…" : "Finish & save"}</button></div>}

      {authOpen && <div className="gt-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className="gt-auth-modal" role="dialog" aria-modal="true" aria-labelledby="gt-auth-title"><button className="gt-modal-close" type="button" onClick={() => setAuthOpen(false)} aria-label="Close sign in">×</button><span className="gt-eyebrow"><i /> YOUR NEXT CHAPTER</span><h2 id="gt-auth-title">{authMode === "login" ? "Welcome back, wanderer." : "Make room for wonder."}</h2><p>Sign in to search landmarks, plan a route, and save your journey history.</p><div className="gt-auth-tabs"><button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => setAuthMode("login")}>Sign in</button><button type="button" className={authMode === "register" ? "is-active" : ""} onClick={() => setAuthMode("register")}>Create account</button></div><form onSubmit={handleAuthSubmit} className="gt-auth-form">{authMode === "register" && <label>Your name<input autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} required /></label>}<label>Email address<input type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} required /></label><button type="submit" className="gt-button gt-button-dark gt-auth-submit" disabled={authBusy}>{authBusy ? "Connecting…" : authMode === "login" ? "Sign in to GeoTales ↗" : "Create account ↗"}</button></form><small className="gt-auth-footnote">Your account is managed by the GeoTales backend API. No provider keys are stored in the browser.</small></section></div>}

      {notice && <div className={`gt-toast is-${notice.type}`} role="status"><span>{notice.type === "success" ? "✓" : notice.type === "error" ? "!" : "✦"}</span><p>{notice.text}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}
    </main>
  );
}
