import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { User, Lock, MapPin, Car, CheckCircle, XCircle, Navigation, Phone, Clock, Star } from "lucide-react";

type DriverSession = { token: string; driverId: number; name: string; username: string };

const SESSION_KEY = "taxi_driver_session";

function loadSession(): DriverSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(s: DriverSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

type AssignedRide = {
  rideId: number;
  clientId: number;
  clientPhone?: string;
  clientName?: string;
  lat: number;
  lng: number;
  address?: string;
};

type RideWithClient = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  clientId: number;
  driverId: number | null;
  clientLat: string | null;
  clientLng: string | null;
  clientAddress: string | null;
  destinationLat: string | null;
  destinationLng: string | null;
  destinationAddress: string | null;
  estimatedArrival: number | null;
  notes: string | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  assignedAt: Date | null;
  acceptanceTimeoutAt: Date | null;
  distanceKm: string | null;
  revenue: string | null;
  client?: {
    id: number;
    phone: string;
    name: string | null;
    currentLat: string | null;
    currentLng: string | null;
  } | null;
};

export default function DriverApp() {
  // Auth
  const [session, setSession] = useState<DriverSession | null>(() => loadSession());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Ride state
  const [pendingRide, setPendingRide] = useState<AssignedRide | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [rideAccepted, setRideAccepted] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [acceptanceCountdown, setAcceptanceCountdown] = useState<number | null>(null); // 30, 29, ..., 0
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicAlertId, setPanicAlertId] = useState<number | null>(null);
  const [driverAvailable, setDriverAvailable] = useState(true); // true = Disponibil, false = Indisponibil

  // Map
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const clientMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const socketRef = useRef<any>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<number | null>(null);
  const [rideStartLocation, setRideStartLocation] = useState<{ lat: number; lng: number } | null>(null);

  // tRPC
  const loginMut = trpc.driver.login.useMutation({
    onSuccess: (data) => {
      const s: DriverSession = {
        token: data.token,
        driverId: data.driver.id,
        name: data.driver.name,
        username: data.driver.username,
      };
      saveSession(s);
      setSession(s);
      toast.success(`Bun venit, ${data.driver.name}!`);
    },
    onError: (e) => toast.error(e.message),
  });

  const acceptRideMut = trpc.driver.acceptRide.useMutation({
    onSuccess: () => {
      toast.success("Cursă acceptată! Navigați la client.");
      setRideAccepted(true);
      // Store driver's starting location for distance calculation
      if (driverPos) {
        setRideStartLocation(driverPos);
      }
      if (pendingRide) {
        setActiveRide(pendingRide);
        setPendingRide(null);
        // Subscribe to client location updates
        if (socketRef.current) {
          socketRef.current.emit("track:client", { clientId: pendingRide.clientId });
        }
        // Draw route to client
        if (driverPos) {
          drawRouteToClient(driverPos, { lat: pendingRide.lat, lng: pendingRide.lng });
        }
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectRideMut = trpc.driver.rejectRide.useMutation({
    onSuccess: () => {
      toast.info("Cursă refuzată.");
      // Unsubscribe from client location if was tracking
      if (pendingRide && socketRef.current) {
        socketRef.current.emit("untrack:client", { clientId: pendingRide.clientId });
      }
      setPendingRide(null);
      setRideAccepted(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Calculate distance and update ride with distance_km
  const updateRideDistanceMut = trpc.driver.updateRideDistance.useMutation({
    onError: (e) => console.error("Failed to update ride distance:", e),
  });

  const completeRideMut = trpc.driver.completeRide.useMutation({
    onSuccess: () => {
      toast.success("Cursă finalizată!");
      // Show rating modal BEFORE clearing activeRide
      setShowRatingModal(true);
      // Unsubscribe from client location updates
      if (activeRide && socketRef.current) {
        socketRef.current.emit("untrack:client", { clientId: activeRide.clientId });
      }
      // Calculate distance if we have start and end locations
      if (rideStartLocation && driverPos && activeRide) {
        // Import Haversine function
        import("../../../shared/distance").then(({ calculateHaversineDistance }) => {
          const distance = calculateHaversineDistance(
            rideStartLocation.lat,
            rideStartLocation.lng,
            driverPos.lat,
            driverPos.lng
          );
          // Update ride with calculated distance
          updateRideDistanceMut.mutate({
            rideId: activeRide.id || activeRide.rideId,
            distance_km: Math.round(distance * 100) / 100, // Round to 2 decimals
          });
        });
      }
      setRideAccepted(false);
      setEstimatedArrival(null);
      clearDirections();
      // Reset driver position for next ride
      setDriverPos(null);
      setRideStartLocation(null);
      if (session) {
        updateStatusMut.mutate({ token: session.token, status: "available" });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMut = trpc.driver.updateStatus.useMutation();

  const triggerPanicMut = trpc.panic.triggerAlert.useMutation({
    onSuccess: (alert) => {
      setPanicAlertId(alert.id);
      setShowPanicConfirm(false);
      toast.success("Alertă de urgență trimisă dispatcherului!", {
        description: "Dispatcherul a fost notificat cu locația ta.",
      });
    },
    onError: (e) => toast.error("Eroare la trimiterea alertei: " + e.message),
  });

  const cancelPanicMut = trpc.panic.cancelPanicAlert.useMutation({
    onSuccess: () => {
      setPanicAlertId(null);
      toast.info("Alertă de urgență anulată.");
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const submitRatingMut = trpc.driver.submitRating.useMutation({
    onSuccess: () => {
      toast.success("Rating trimis! Clientul va vedea evaluarea.");
      setShowRatingModal(false);
      setRatingValue(5);
      setRatingComment("");
      setActiveRide(null);
      setRideAccepted(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const activeRideQuery = trpc.driver.getActiveRide.useQuery(
    { token: session?.token ?? "" },
    { enabled: !!session, refetchInterval: 15000 }
  );

  // Sync active ride from server
  useEffect(() => {
    if (!activeRideQuery.data) return;
    const ride = activeRideQuery.data;
    if (ride.status === "assigned" && !rideAccepted) {
      const rideData = ride as RideWithClient;
      setPendingRide({
        rideId: ride.id,
        clientId: ride.clientId,
        clientPhone: rideData.client?.phone,
        clientName: rideData.client?.name ?? undefined,
        lat: parseFloat(String(ride.clientLat)),
        lng: parseFloat(String(ride.clientLng)),
        address: ride.clientAddress ?? undefined,
      });
    } else if (ride.status === "accepted" || ride.status === "in_progress") {
      setActiveRide(ride);
      setRideAccepted(true);
    }
  }, [activeRideQuery.data]);

  // Socket.IO
  useEffect(() => {
    if (!session) return;

    const s = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("auth:driver", { token: session.token });
    });

    s.on("ride:assigned", (data: AssignedRide) => {
      setPendingRide(data);
      setRideAccepted(false);
      setAcceptanceCountdown(30); // Start 30-second countdown
      toast.info(`🚖 Cursă nouă asignată de la ${data.clientPhone || "client"}!`, { duration: 10000 });
    });

    s.on("ride:timeout", (data: { rideId: number }) => {
      if (pendingRide?.rideId === data.rideId) {
        setPendingRide(null);
        setAcceptanceCountdown(null);
        toast.error("⏱️ Timp expirat! Cursa a fost reasignată altui șofer.");
      }
    });

    s.on("ride:cancelled", () => {
      setPendingRide(null);
      setActiveRide(null);
      setRideAccepted(false);
      clearDirections();
      toast.info("Cursa a fost anulată de client/dispatcher");
    });

    s.on("client:location:update", (data: { clientId: number; lat: number; lng: number }) => {
      // Update client location on map when tracking
      if (rideAccepted && activeRide && activeRide.clientId === data.clientId) {
        if (mapRef.current && clientMarkerRef.current) {
          clientMarkerRef.current.setPosition({ lat: data.lat, lng: data.lng });
          // Update route
          if (driverPos) {
            drawRouteToClient(driverPos, { lat: data.lat, lng: data.lng });
            calculateETA(driverPos, { lat: data.lat, lng: data.lng });
          }
        }
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [session, rideAccepted, activeRide, driverPos]);

  // GPS tracking
  useEffect(() => {
    if (!session) return;
    if (!navigator.geolocation) return;

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setDriverPos({ lat, lng });
        socketRef.current?.emit("location:driver", { lat, lng, token: session.token });
        updateDriverMarker(lat, lng);
        // Update route if navigating to client
        if (rideAccepted && activeRide) {
          const clientLat = parseFloat(String(activeRide.clientLat || activeRide.lat));
          const clientLng = parseFloat(String(activeRide.clientLng || activeRide.lng));
          drawRouteToClient({ lat, lng }, { lat: clientLat, lng: clientLng });
          calculateETA({ lat, lng }, { lat: clientLat, lng: clientLng });
        }
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [session, rideAccepted, activeRide]);

  // Countdown timer for ride acceptance
  useEffect(() => {
    if (acceptanceCountdown === null || acceptanceCountdown <= 0) return;
    
    const interval = setInterval(() => {
      setAcceptanceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [acceptanceCountdown]);

  const updateDriverMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: "Locația mea",
        zIndex: 200,
      });
    }
    driverMarkerRef.current.setPosition({ lat, lng });
    mapRef.current.panTo({ lat, lng });
  }, []);

  const drawRouteToClient = useCallback((from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    if (!mapRef.current) return;
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeWeight: 6,
          strokeOpacity: 0.9,
        },
      });
    }
    // Client marker
    if (!clientMarkerRef.current) {
      clientMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
        title: "Locația clientului",
        zIndex: 100,
      });
    }
    clientMarkerRef.current.setPosition(to);

    const service = new google.maps.DirectionsService();
    service.route(
      { origin: from, destination: to, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRendererRef.current!.setDirections(result);
          // Fit bounds
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(from);
          bounds.extend(to);
          mapRef.current?.fitBounds(bounds, 80);
        }
      }
    );
  }, []);

  const calculateETA = useCallback((from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      { origins: [from], destinations: [to], travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result?.rows[0]?.elements[0]?.duration) {
          const minutes = Math.ceil(result.rows[0].elements[0].duration.value / 60);
          setEstimatedArrival(minutes);
        }
      }
    );
  }, []);

  const clearDirections = useCallback(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (clientMarkerRef.current) {
      clientMarkerRef.current.setMap(null);
      clientMarkerRef.current = null;
    }
    setEstimatedArrival(null);
  }, []);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setCenter({ lat, lng });
        map.setZoom(15);
        setDriverPos({ lat, lng });
      },
      (error) => {
        console.warn("Geolocation error:", error);
        // Only set fallback after GPS fails
        map.setCenter({ lat: 44.4268, lng: 26.1025 });
        map.setZoom(13);
      }
    );
  }, []);

  const handleLogout = () => {
    if (session) {
      trpc.driver.logout.useMutation;
      updateStatusMut.mutate({ token: session.token, status: "offline" });
    }
    clearSession();
    setSession(null);
    setPendingRide(null);
    setActiveRide(null);
    setRideAccepted(false);
    clearDirections();
  };

  // ─── Login Screen ─────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-yellow-950 to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-gray-900 border-gray-700 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="text-5xl mb-2">🚗</div>
            <CardTitle className="text-white text-2xl font-bold">Portal Șofer</CardTitle>
            <p className="text-gray-400 text-sm">Autentificare cu datele create de dispatcher</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white pl-10"
                autoComplete="username"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Parolă"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white pl-10"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && loginMut.mutate({ username, password })}
              />
            </div>
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg py-6"
              onClick={() => loginMut.mutate({ username, password })}
              disabled={loginMut.isPending || !username || !password}
            >
              {loginMut.isPending ? "Se autentifică..." : "Intră în Aplicație"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main Driver App ──────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚗</span>
          <span className="text-yellow-400 font-bold">{session.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Availability Toggle Button */}
          <Button
            onClick={() => {
              const newStatus = !driverAvailable ? "available" : "offline";
              updateStatusMut.mutate({ token: session.token, status: newStatus });
              setDriverAvailable(!driverAvailable);
              toast.success(`Status: ${!driverAvailable ? "Disponibil" : "Indisponibil"}`);
            }}
            className={`text-xs font-semibold px-4 py-2 ${
              rideAccepted || activeRide ? "bg-orange-700 hover:bg-orange-800" :
              pendingRide ? "bg-blue-700 hover:bg-blue-800" :
              driverAvailable ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"
            }`}
            disabled={rideAccepted || activeRide || pendingRide}
          >
            {rideAccepted || activeRide ? "Ocupat" : pendingRide ? "Cursă nouă!" : driverAvailable ? "Disponibil" : "Indisponibil"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white text-xs">
            Ieșire
          </Button>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative bg-gray-800 overflow-hidden">
        <MapView onMapReady={handleMapReady} className="w-full h-full" />

        {/* Map Legend */}
        <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 rounded-lg p-3 text-xs text-white border border-gray-700">
          <div className="font-semibold mb-2 text-yellow-400">Legendă</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <span>Locația mea</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Client</span>
          </div>
        </div>

        {rideAccepted && estimatedArrival && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-900 bg-opacity-95 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
            <Clock className="w-4 h-4 text-blue-300" />
            <span className="text-white text-sm font-medium">~{estimatedArrival} min până la client</span>
          </div>
        )}

        {!rideAccepted && !pendingRide && driverAvailable && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-900 bg-opacity-90 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Disponibil - așteptați curse</span>
          </div>
        )}
        {!rideAccepted && !pendingRide && !driverAvailable && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900 bg-opacity-90 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Indisponibil - nu primesc curse</span>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-gray-900 border-t border-gray-800 p-4">
        {/* Pending ride notification */}
        {pendingRide && !rideAccepted && (
          <div className="flex flex-col gap-3">
            <div className="bg-blue-900 border border-blue-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <p className="text-blue-300 font-semibold text-sm">Cursă nouă asignată!</p>
                </div>
                {acceptanceCountdown !== null && (
                  <div className="flex items-center gap-1 bg-red-900 px-3 py-1 rounded-full">
                    <Clock className="w-4 h-4 text-red-300" />
                    <span className="text-red-300 font-bold text-sm">{acceptanceCountdown}s</span>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-700 rounded-full flex items-center justify-center text-white font-bold">
                  {(pendingRide.clientName || pendingRide.clientPhone || "C")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{pendingRide.clientName || "Client"}</p>
                  {pendingRide.clientPhone && (
                    <div className="flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400 text-sm">{pendingRide.clientPhone}</span>
                    </div>
                  )}
                  {pendingRide.address && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400 text-xs">{pendingRide.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg"
                onClick={() => acceptRideMut.mutate({ token: session.token, rideId: pendingRide.rideId })}
                disabled={acceptRideMut.isPending}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {acceptRideMut.isPending ? "..." : "Acceptă"}
              </Button>
              <Button
                variant="outline"
                className="border-red-700 text-red-400 hover:bg-red-900 font-bold py-6 text-lg"
                onClick={() => rejectRideMut.mutate({ token: session.token, rideId: pendingRide.rideId })}
                disabled={rejectRideMut.isPending}
              >
                <XCircle className="w-5 h-5 mr-2" />
                {rejectRideMut.isPending ? "..." : "Refuză"}
              </Button>
            </div>
          </div>
        )}

        {/* Active ride - navigating to client */}
        {rideAccepted && activeRide && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {(activeRide.clientName || activeRide.client?.name || activeRide.clientPhone || activeRide.client?.phone || "C")[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">
                  {activeRide.clientName || activeRide.client?.name || "Client"}
                </p>
                <p className="text-gray-400 text-sm">
                  {activeRide.clientPhone || activeRide.client?.phone}
                </p>
                {estimatedArrival && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400 text-sm">~{estimatedArrival} min</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <Navigation className="w-6 h-6 text-blue-400 animate-pulse" />
                <span className="text-blue-400 text-xs">Navigare</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-5"
                onClick={() => {
                  completeRideMut.mutate({ token: session.token, rideId: activeRide.id || activeRide.rideId });
                }}
                disabled={completeRideMut.isPending}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Finalizată
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-5"
                onClick={() => setShowPanicConfirm(true)}
                disabled={!!panicAlertId}
              >
                <span className="text-lg mr-1">🚨</span>
                {panicAlertId ? "Alertat" : "Urgență"}
              </Button>
            </div>
          </div>
        )}

        {/* Idle state */}
        {!pendingRide && !rideAccepted && !activeRide && (
          <div className="text-center py-4">
            <Car className="w-12 h-12 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400">{driverAvailable ? "Disponibil - așteptați curse noi" : "Indisponibil - nu primesc curse"}</p>
            <p className="text-gray-600 text-xs mt-1">GPS activ, locația se transmite în timp real</p>
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && activeRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Evaluează clientul</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm">Rating (1-5 stele)</label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingValue(star)}
                      className={`text-2xl ${
                        star <= ratingValue ? "text-yellow-400" : "text-gray-600"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-300 text-sm">Comentariu (opțional)</label>
                <Input
                  placeholder="Scrie un comentariu..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white mt-2"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    if (session && activeRide) {
                      submitRatingMut.mutate({
                        token: session.token,
                        clientId: activeRide.clientId,
                        rideId: activeRide.id || activeRide.rideId,
                        rating: ratingValue,
                        comment: ratingComment || undefined,
                      });
                    }
                  }}
                  disabled={submitRatingMut.isPending}
                >
                  {submitRatingMut.isPending ? "Se trimite..." : "Trimite"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300"
                  onClick={() => setShowRatingModal(false)}
                >
                  Sari
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panic Confirmation Modal */}
      {showPanicConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 bg-gray-900 border-red-700">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                Alertă de Urgență
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300">
                Ești sigur că vrei să trimiți o alertă de urgență dispatcherului? Locația ta va fi trimisă imediat.
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (session && driverPos) {
                      triggerPanicMut.mutate({
                        driverId: session.driverId,
                        lat: driverPos.lat,
                        lng: driverPos.lng,
                        address: "Locație curentă",
                        rideId: activeRide?.id || activeRide?.rideId,
                      });
                    }
                  }}
                  disabled={triggerPanicMut.isPending}
                >
                  {triggerPanicMut.isPending ? "Se trimite..." : "Trimite Alertă"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300"
                  onClick={() => setShowPanicConfirm(false)}
                >
                  Anulează
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panic Alert Status */}
      {panicAlertId && (
        <div className="fixed bottom-4 left-4 bg-red-900 border border-red-700 rounded-lg p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl animate-pulse">🚨</span>
            <div className="flex-1">
              <p className="text-red-200 font-bold">Alertă Activă</p>
              <p className="text-red-300 text-sm">Dispatcherul a fost notificat. Așteptă instrucțiuni.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-red-700 text-red-300 hover:bg-red-800"
                onClick={() => cancelPanicMut.mutate({ alertId: panicAlertId })}
                disabled={cancelPanicMut.isPending}
              >
                {cancelPanicMut.isPending ? "Se anulează..." : "Anulează Alertă"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
