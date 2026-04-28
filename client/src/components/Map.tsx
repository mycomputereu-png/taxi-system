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
    console.log("[Map] Script already loading or loaded, returning existing promise");
    return mapScriptPromise;
  }

  // If Google Maps already loaded, resolve immediately
  if (window.google?.maps) {
    console.log("[Map] Google Maps already loaded in window");
    return Promise.resolve();
  }

  mapScriptPromise = (async () => {
    try {
      console.log("[Map] Loading Google Maps from Forge...");
      console.log("[Map] window.__GOOGLE_MAPS_CONFIG__:", window.__GOOGLE_MAPS_CONFIG__);

      // Get config from window (injected at build time)
      const config = window.__GOOGLE_MAPS_CONFIG__;
      if (!config?.apiKey || !config?.apiUrl) {
        console.error("[Map] Config missing:", { apiKey: config?.apiKey, apiUrl: config?.apiUrl });
        throw new Error("Google Maps config not found in window");
      }

      // Build Forge proxy URL
      const origin = window.location.origin;
      const scriptUrl = `${config.apiUrl}/v1/maps/proxy/maps/api/js?key=${config.apiKey}&v=weekly&libraries=marker,places,geocoding,geometry`;
      console.log("[Map] Script URL:", scriptUrl);
      console.log("[Map] Origin:", origin);
      
      // Wait for Google Maps to load using polling
      await new Promise<void>((resolve, reject) => {
        // Fetch script with Origin header
        fetch(scriptUrl, {
          headers: {
            'Origin': origin
          }
        })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })
          .then(scriptText => {
            console.log("[Map] Script fetched successfully, length:", scriptText.length);
            // Execute the script in global context
            const script = document.createElement('script');
            script.textContent = scriptText;
            document.head.appendChild(script);
            console.log("[Map] Script injected into DOM");
          })
          .catch(error => {
            console.error("[Map] Fetch error:", error);
            // Fallback: try loading as regular script tag
            const script = document.createElement("script");
            script.src = scriptUrl;
            script.async = true;
            script.onerror = () => {
              console.error("[Map] Script load error");
              reject(new Error("Failed to load Google Maps script"));
            };
            script.onload = () => {
              console.log("[Map] Script loaded successfully (fallback)");
            };
            document.head.appendChild(script);
            console.log("[Map] Script element appended to head (fallback)");
          });

        // Poll for Google Maps availability
        let attempts = 0;
        const maxAttempts = 300; // 30 seconds at 100ms intervals
        const checkGoogleMaps = setInterval(() => {
          attempts++;
          
          if (window.google?.maps) {
            clearInterval(checkGoogleMaps);
            console.log("[Map] Google Maps API loaded successfully after", attempts * 100, "ms");
            resolve();
          } else if (attempts % 10 === 0) {
            console.log("[Map] Still waiting for Google Maps... attempt", attempts);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkGoogleMaps);
            console.error("[Map] Google Maps API failed to load after 30 seconds");
            console.error("[Map] window.google:", window.google);
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
      className={`w-full h-screen bg-gray-900 ${className}`}
      style={{ height: "100vh", minHeight: "100%" }}
    />
  );
}
