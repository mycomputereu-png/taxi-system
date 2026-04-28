/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Standalone service; manually apply results to map.
 * const distance = google.maps.geometry.spherical.computeDistanceBetween(
 *   new google.maps.LatLng(40.7128, -74.0060),
 *   new google.maps.LatLng(34.0522, -118.2437)
 * );
 * console.log(distance); // Distance in meters
 */

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: any) => any;
        LatLng: new (lat: number, lng: number) => any;
        marker?: {
          AdvancedMarkerElement: new (options: any) => any;
        };
        places?: {
          Place: new (options: any) => any;
        };
        Geocoder: new () => any;
        geometry?: {
          spherical: {
            computeDistanceBetween: (a: any, b: any) => number;
          };
        };
      };
    };
  }
}

declare global {
  interface Window {
    __GOOGLE_MAPS_CONFIG__?: {
      apiKey: string;
      apiUrl: string;
    };
  }
}

let mapScriptPromise: Promise<void> | null = null;

async function loadMapScript(): Promise<void> {
  // Idempotent: if already loading or loaded, return existing promise
  if (mapScriptPromise) {
    return mapScriptPromise;
  }

  // If Google Maps already loaded, resolve immediately
  if (window.google?.maps) {
    return Promise.resolve();
  }

  mapScriptPromise = (async () => {
    try {
      console.log("[Map] Loading Google Maps from backend proxy...");

      // Load script from backend proxy (server-side fetch with server token)
      // This avoids CORS/auth issues that occur when client fetches from Forge directly
      const scriptUrl = `/api/maps-js`;
      
      const response = await fetch(scriptUrl);

      if (!response.ok) {
        throw new Error(`Failed to load Google Maps script: ${response.status}`);
      }

      const scriptContent = await response.text();

      // Create and execute script in page context
      const script = document.createElement("script");
      script.textContent = scriptContent;
      script.async = true;
      document.head.appendChild(script);

      // Wait for Google Maps to load
      await new Promise<void>((resolve, reject) => {
        const checkGoogleMaps = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkGoogleMaps);
            resolve();
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGoogleMaps);
          if (!window.google?.maps) {
            reject(new Error("Google Maps API loaded but window.google.maps not available"));
          }
        }, 10000);
      });
    } catch (error) {
      console.error("[Map] Failed to load Google Maps script", error);
      mapScriptPromise = null; // Reset so retries work
      throw error;
    }
  })();

  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 0, lng: 0 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = useRef<() => Promise<void>>(async () => {
    try {
      console.log("[Map] Initializing MapView...");
      await loadMapScript();
      console.log("[Map] Google Maps script loaded");

      if (!mapContainer.current) {
        throw new Error("Map container not found");
      }

      if (!window.google?.maps) {
        throw new Error("Google Maps not available");
      }

      map.current = new window.google.maps.Map(mapContainer.current, {
        center: initialCenter,
        zoom: initialZoom,
        mapId: "taxi-dispatcher-map",
      });

      console.log("[Map] Map initialized successfully");
      onMapReady?.(map.current);
    } catch (error) {
      console.error("[Map] Failed to initialize map:", error);
    }
  });

  useEffect(() => {
    init.current?.();
  }, []);

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full rounded-lg overflow-hidden ${className || ""}`}
      style={{ minHeight: "400px" }}
    />
  );
}
