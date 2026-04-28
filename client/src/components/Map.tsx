/*
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
      console.log("[Map] Loading Google Maps from Forge...");

      // Get config from window (injected at build time)
      const config = window.__GOOGLE_MAPS_CONFIG__;
      if (!config?.apiKey || !config?.apiUrl) {
        throw new Error("Google Maps config not found in window");
      }

      // Build Forge proxy URL
      const scriptUrl = `${config.apiUrl}/v1/maps/proxy/maps/api/js?key=${config.apiKey}&v=weekly&libraries=marker,places,geocoding,geometry`;
      
      // Wait for Google Maps to load using polling
      await new Promise<void>((resolve, reject) => {
        // Load script directly from Forge (CORS-enabled)
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        document.head.appendChild(script);

        // Poll for Google Maps availability
        let attempts = 0;
        const maxAttempts = 300; // 30 seconds at 100ms intervals
        const checkGoogleMaps = setInterval(() => {
          attempts++;
          
          if (window.google?.maps) {
            clearInterval(checkGoogleMaps);
            console.log("[Map] Google Maps API loaded successfully");
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkGoogleMaps);
            console.error("[Map] Google Maps API failed to load after 30 seconds");
            reject(new Error("Google Maps API failed to load after 30 seconds"));
          }
        }, 100);
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
  className = "",
  initialCenter = { lat: 47.1667, lng: 25.6333 }, // Bucovina default
  initialZoom = 13,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // Load Google Maps script
        await loadMapScript();

        if (!isMounted || !containerRef.current) return;

        // Initialize map
        const map = new window.google!.maps.Map(containerRef.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
          zoomControl: true,
          mapTypeId: "roadmap",
        });

        mapRef.current = map;
        onMapReady?.(map);
        console.log("[Map] Map initialized successfully");
      } catch (error) {
        console.error("[Map] Failed to initialize map:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialCenter, initialZoom, onMapReady]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full bg-gray-900 ${className}`}
      style={{ minHeight: "400px" }}
    />
  );
}
