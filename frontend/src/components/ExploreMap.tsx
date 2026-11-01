"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { JourneyPoint, Landmark } from "../lib/goetales-api";
import type { PlaceSuggestion } from "../lib/navigation";

export type LatLng = [number, number];

type Props = {
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  currentPosition: LatLng | null;
  routePath: LatLng[];
  trailPoints: JourneyPoint[];
  routeOrigin?: PlaceSuggestion | null;
  routeDestination?: PlaceSuggestion | null;
  onSelectLandmark: (landmark: Landmark) => void;
};

const fallbackCenter: LatLng = [17.385, 78.4867]; // Demo fallback: Hyderabad; replace by user geolocation once available.

function createLandmarkIcon(selected: boolean) {
  return L.divIcon({
    className: "gt-marker-host",
    html: `<span class="gt-map-marker ${selected ? "is-selected" : ""}"><span></span></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 32],
  });
}

function createCurrentIcon() {
  return L.divIcon({
    className: "gt-marker-host",
    html: '<span class="gt-current-location"><span></span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapViewport({ center, routePath, trailPoints }: { center: LatLng; routePath: LatLng[]; trailPoints: JourneyPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (routePath.length > 1) {
      // fitBounds expects a bounds object (or two-corner literal), not a
      // list of LatLngExpression values. Convert the route points to bounds.
      map.fitBounds(L.latLngBounds(routePath), { padding: [45, 45], maxZoom: 15 });
    } else if (trailPoints.length > 1) {
      const savedTrail: LatLng[] = trailPoints.map((point) => [point.latitude, point.longitude]);
      map.fitBounds(L.latLngBounds(savedTrail), { padding: [45, 45], maxZoom: 15 });
    }
  }, [map, routePath, trailPoints]);

  useEffect(() => {
    if (routePath.length < 2 && trailPoints.length < 2) {
      map.setView(center, 13, { animate: true });
    }
  }, [map, center, routePath.length, trailPoints.length]);
  return null;
}

export default function ExplorerMap(props: Props) {
  const center = props.currentPosition || (props.selectedLandmark?.latitude != null && props.selectedLandmark.longitude != null
    ? [props.selectedLandmark.latitude, props.selectedLandmark.longitude] as LatLng
    : fallbackCenter);
  const mappableLandmarks = props.landmarks.filter((landmark) => landmark.latitude != null && landmark.longitude != null);
  const recordedPath = props.trailPoints.map((point) => [point.latitude, point.longitude] as LatLng);

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="gt-leaflet-map" zoomControl={false} preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ScaleControl position="bottomleft" imperial={false} />
      <MapViewport center={center} routePath={props.routePath} trailPoints={props.trailPoints} />

      {mappableLandmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          position={[landmark.latitude as number, landmark.longitude as number]}
          icon={createLandmarkIcon(props.selectedLandmark?.id === landmark.id)}
          eventHandlers={{ click: () => props.onSelectLandmark(landmark) }}
        >
          <Popup>
            <strong>{landmark.name}</strong>
            <br />
            <span>{landmark.category}</span>
          </Popup>
        </Marker>
      ))}

      {props.currentPosition && (
        <Marker position={props.currentPosition} icon={createCurrentIcon()}>
          <Popup>Your current location</Popup>
        </Marker>
      )}

      {props.routeOrigin && props.routeOrigin.source !== "gps" && (
        <Marker position={[props.routeOrigin.latitude, props.routeOrigin.longitude]} icon={createCurrentIcon()}>
          <Popup>Route starts: {props.routeOrigin.label}</Popup>
        </Marker>
      )}

      {props.routeDestination && (
        <Marker
          position={[props.routeDestination.latitude, props.routeDestination.longitude]}
          icon={createLandmarkIcon(true)}
        >
          <Popup>Destination: {props.routeDestination.label}</Popup>
        </Marker>
      )}

      {props.routePath.length > 1 && (
        <Polyline
          positions={props.routePath}
          pathOptions={{ color: "#fffdf6", weight: 12, opacity: 0.98, lineCap: "round", lineJoin: "round" }}
        />
      )}
      {props.routePath.length > 1 && (
        <Polyline
          positions={props.routePath}
          pathOptions={{ color: "#145d68", weight: 7, opacity: 1, lineCap: "round", lineJoin: "round" }}
        />
      )}
      {recordedPath.length > 1 && (
        <Polyline positions={recordedPath} pathOptions={{ color: "#237b59", weight: 5, opacity: 0.92 }} />
      )}
      {recordedPath.map((point, index) => (
        <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={index === recordedPath.length - 1 ? 6 : 3} pathOptions={{ color: "#fff7df", fillColor: "#237b59", fillOpacity: 1, weight: 2 }} />
      ))}
    </MapContainer>
  );
}
