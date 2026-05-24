/**
 * LEAFLET + OPENSTREETMAP MAP INTEGRATION (FREE, NO API KEY NEEDED)
 *
 * Replaces Google Maps with Leaflet + OpenStreetMap tiles.
 * Uses OSRM (Open Source Routing Machine) for directions/routing.
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 * const mapRef = useRef<L.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => { mapRef.current = map; }}
 * />
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

// Inject Leaflet CSS once
let leafletCssLoaded = false;
function ensureLeafletCss() {
  if (leafletCssLoaded) return;
  leafletCssLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

// Fix default marker icon paths (Leaflet bundler issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** Create an SVG DivIcon for markers */
export function createSvgIcon(color: string, shape: "arrow" | "circle", size: number = 24): L.DivIcon {
  let svg: string;
  if (shape === "arrow") {
    svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 22,22 12,17 2,22" fill="${color}" stroke="#fff" stroke-width="2"/>
    </svg>`;
  } else {
    svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="#fff" stroke-width="3"/>
    </svg>`;
  }
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Fetch a driving route from OSRM (free, no API key) */
export async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ coordinates: L.LatLngTuple[]; distance: number; duration: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]) {
      const route = data.routes[0];
      const coords: L.LatLngTuple[] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as L.LatLngTuple
      );
      return {
        coordinates: coords,
        distance: route.distance,
        duration: route.duration,
      };
    }
  } catch (e) {
    console.error("[OSRM] Route fetch error:", e);
  }
  return null;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 44.4268, lng: 26.1025 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const { theme } = useTheme();

  const init = usePersistFn(async () => {
    try {
      ensureLeafletCss();
      if (!mapContainer.current) return;

      // Wait for container to have dimensions
      let attempts = 0;
      while (mapContainer.current.offsetHeight === 0 && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (mapInstance.current) return;

      const map = L.map(mapContainer.current, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: initialZoom,
        zoomControl: true,
      });

      const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      mapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 100);

      if (onMapReady) {
        onMapReady(map);
      }
    } catch (error) {
      console.error("[Map] Failed to initialize map:", error);
    }
  });

  useEffect(() => {
    init();
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [init]);

  // Switch tile layer when theme changes
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current) return;
    const newUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
    tileLayerRef.current.setUrl(newUrl);
  }, [theme]);

  return (
    <div ref={mapContainer} className={cn("w-full h-full", className)} />
  );
}
