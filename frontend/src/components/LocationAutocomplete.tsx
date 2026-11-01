"use client";

import { useEffect, useMemo, useState } from "react";
import { searchPlaces, type LatLng, type PlaceSuggestion } from "../lib/navigation";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  bias?: LatLng | null;
  disabled?: boolean;
  compact?: boolean;
  localPlaces?: PlaceSuggestion[];
};

export default function LocationAutocomplete({
  label,
  value,
  placeholder,
  onValueChange,
  onSelect,
  bias = null,
  disabled = false,
  compact = false,
  localPlaces = [],
}: Props) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!focused || value.trim().length < 3) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setSearchError(null);
      setSuggestions([]);
      void searchPlaces(value, controller.signal, bias)
        .then(setSuggestions)
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setSearchError(error instanceof Error ? error.message : "Unable to search places.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [focused, value, bias]);

  const query = value.trim().toLocaleLowerCase();
  const localSuggestions = useMemo(
    () => query.length >= 2
      ? localPlaces.filter((place) => place.label.toLocaleLowerCase().includes(query)).slice(0, 3)
      : [],
    [localPlaces, query],
  );
  const mergedSuggestions = useMemo(() => {
    const combined = [...localSuggestions, ...suggestions];
    const seen = new Set<string>();
    return combined.filter((place) => {
      const key = `${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 7);
  }, [localSuggestions, suggestions]);
  const showResults = focused && value.trim().length >= 2;

  const choosePlace = (place: PlaceSuggestion) => {
    onSelect(place);
    setSuggestions([]);
    setFocused(false);
  };

  return (
    <div className={`gt-location-field${compact ? " gt-location-field--compact" : ""}`}>
      <label className="gt-location-label">{label}</label>
      <div className="gt-location-input-wrap">
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={label}
          aria-expanded={showResults}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => {
            setFocused(false);
            setLoading(false);
          }, 140)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && mergedSuggestions[0]) {
              event.preventDefault();
              choosePlace(mergedSuggestions[0]);
            } else if (event.key === "Escape") {
              setFocused(false);
            }
          }}
          onChange={(event) => {
            setSuggestions([]);
            setSearchError(null);
            setLoading(false);
            onValueChange(event.target.value);
          }}
        />
        {loading && <span className="gt-location-loading" aria-label="Searching" />}
      </div>

      {showResults && (
        <div className="gt-location-suggestions" role="listbox" aria-label={`${label} suggestions`}>
          {loading && <p className="gt-location-empty">Searching places…</p>}
          {!loading && searchError && mergedSuggestions.length === 0 && <p className="gt-location-empty">{searchError}</p>}
          {mergedSuggestions.map((place, index) => {
            const [title, ...detail] = place.label.split(",");
            return (
            <button
              key={`${place.latitude}:${place.longitude}:${index}`}
              type="button"
              className="gt-location-suggestion"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choosePlace(place)}
            >
              <span className="gt-location-suggestion-pin">⌖</span>
              <span className="gt-location-suggestion-copy">
                <strong>{title.trim()}</strong>
                {detail.length > 0 && <small>{detail.join(",").trim()}</small>}
              </span>
            </button>
            );
          })}
          {!loading && mergedSuggestions.length === 0 && !searchError && (
            <p className="gt-location-empty">No places found. Try a more specific name or nearby area.</p>
          )}
          {!loading && searchError && mergedSuggestions.length > 0 && (
            <p className="gt-location-provider-note">Some search results may be unavailable right now.</p>
          )}
        </div>
      )}
    </div>
  );
}
