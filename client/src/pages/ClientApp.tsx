import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { trpc } from "@/lib/trpc";
import { MapView, createSvgIcon, fetchOSRMRoute, reverseGeocode } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import { Phone, MapPin, Car, Clock, CheckCircle, XCircle, Navigation, User, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWakeLock } from "@/hooks/useWakeLock";
import ClientProfile from "./ClientProfile";

type ClientSession = { token: string; clientId: number; phone: string };

const SESSION_KEY = "taxi_client_session";

function loadSession(): ClientSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(s: ClientSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

type RideStatus = "idle" | "requesting" | "pending" | "assigned" | "accepted" | "in_progress" | "completed" | "rejected" | "cancelled";

// GPS gating: don't allow an order until we have a precise, fresh fix.
const GPS_ACCURACY_THRESHOLD_M = 30; // meters; reject fixes coarser than this for ordering
const MAX_LOCATION_AGE_MS = 90_000; // 1.5 min; reject stale last-known-location fixes

type RideWithDriver = {
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
  driver?: {
    id: number;
    name: string;
    phone: string | null;
    username: string;
    carPlate: string | null;
    carBrand: string | null;
  } | null;
};

export default function ClientApp() {
  const { emit, on } = useSocket();

  // Auth state
  const [session, setSession] = useState<ClientSession | null>(() => {
    const s = loadSession();
    console.log("[ClientApp] Loaded session:", s);
    return s;
  });

  // Emit auth:client when session is available
  useEffect(() => {
    if (session) {
      console.log("[ClientApp] Session changed, emitting auth:client");
      emit("auth:client", { token: session.token });
    }
  }, [session, emit]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState(""); // Nume
  const [lastName, setLastName] = useState(""); // Prenume

  // Ride state
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  // Keep the screen awake only while a ride is active (saves battery otherwise).
  useWakeLock(["pending", "assigned", "accepted", "in_progress"].includes(rideStatus));
  const [rideId, setRideId] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<number | null>(null);
  const [countdownETA, setCountdownETA] = useState<number | null>(null);

  // Profile state
  const [showProfile, setShowProfile] = useState(false);

  // Driver arrival notification state
  const [showArrivalAlert, setShowArrivalAlert] = useState(false);
  const [driverArrived, setDriverArrived] = useState(false);
  const arrivalNotificationRef = useRef<boolean>(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);

  // Map state
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const clientMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const [clientPos, setClientPos] = useState<{ lat: number; lng: number } | null>(null);
  // GPS accuracy/freshness state used to gate the order button.
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [clientAddress, setClientAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);

  // A precise, usable fix: we have coords and accuracy is within threshold.
  const gpsReady =
    clientPos !== null && gpsAccuracy !== null && gpsAccuracy <= GPS_ACCURACY_THRESHOLD_M;

  // tRPC
  const handleAuthSuccess = (data: { token: string; client: { id: number; phone: string } }) => {
    const s: ClientSession = {
      token: data.token,
      clientId: data.client?.id ?? 0,
      phone: data.client?.phone ?? phone,
    };
    saveSession(s);
    setSession(s);
  };

  const registerMut = trpc.clientApp.register.useMutation({
    onSuccess: (data) => {
      handleAuthSuccess(data);
      toast.success("Cont creat cu succes!");
    },
    onError: (e) => toast.error(e.message),
  });

  const loginMut = trpc.clientApp.login.useMutation({
    onSuccess: (data) => {
      handleAuthSuccess(data);
      toast.success("Autentificat cu succes!");
    },
    onError: (e) => toast.error(e.message),
  });

  const requestRideMut = trpc.clientApp.requestRide.useMutation({
    onSuccess: (data: any) => {
      if (data?.id) {
        setRideId(data.id);
        setRideStatus("pending");
        toast.success("Cerere trimisă la dispatcher!");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Callback functions (must be declared before useEffect)
  const updateClientMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (!clientMarkerRef.current) {
      clientMarkerRef.current = L.marker([lat, lng], {
        icon: createSvgIcon("#3b82f6", "circle"),
        title: "Locația mea",
        zIndexOffset: 100,
      }).addTo(mapRef.current);
    }
    clientMarkerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }, []);

  // Calculate distance between two coordinates (in meters)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.error('Error playing notification sound:', e);
    }
  };

  const updateDriverMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([lat, lng], {
        icon: createSvgIcon("#f59e0b", "arrow"),
        title: "Șoferul tău",
        zIndexOffset: 200,
      }).addTo(mapRef.current);
    }
    driverMarkerRef.current.setLatLng([lat, lng]);
  }, []);

  // Reset arrival notification when ride ends
  useEffect(() => {
    if (rideStatus === "completed" || rideStatus === "cancelled" || rideStatus === "rejected") {
      arrivalNotificationRef.current = false;
      setShowArrivalAlert(false);
      setDriverArrived(false);
    }
  }, [rideStatus]);

  // Calculate distance between two coordinates (in meters)

  const clearDirections = useCallback(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
    setEstimatedArrival(null);
  }, []);

  const cancelRideMut = trpc.clientApp.cancelRide.useMutation({
    onSuccess: () => {
      setRideStatus("idle");
      setRideId(null);
      setDriverInfo(null);
      clearDirections();
      toast.info("Cursă anulată");
    },
  });

  const activeRideQuery = trpc.clientApp.getActiveRide.useQuery(
    { token: session?.token ?? "" },
    { enabled: !!session, refetchInterval: 10000 }
  );

  // Sync active ride from server
  useEffect(() => {
    if (!activeRideQuery.data) return;
    const ride = activeRideQuery.data as RideWithDriver | undefined;
    if (ride?.id) {
      setRideId(ride.id);
      setRideStatus(ride.status as RideStatus);
      if (ride.driver) setDriverInfo(ride.driver);
      if (ride.estimatedArrival) setEstimatedArrival(ride.estimatedArrival);
    }
  }, [activeRideQuery.data]);

  // Socket.IO auth is emitted by the session effect after login/register

  // Countdown timer for ETA
  useEffect(() => {
    if (rideStatus !== "accepted" && rideStatus !== "in_progress") return;
    if (countdownETA === null || countdownETA <= 0) return;

    const timer = setInterval(() => {
      setCountdownETA((prev) => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rideStatus, countdownETA]);

  // Socket.IO event listeners
  useEffect(() => {
    on("ride:assigned", (data: any) => {
      setRideStatus("assigned");
      setDriverInfo(data.driver);
      toast.success(`Sofer asignat: ${data.driver?.name || "Sofer"}!`);
      // Start tracking driver location immediately when assigned
      if (data.driver?.id) {
        emit("track:driver", { driverId: data.driver.id });
      }
    });
  }, [on, emit]);

  useEffect(() => {
    on("ride:accepted", (data: any) => {
      console.log("[ClientApp] ride:accepted received:", data);
      setRideStatus("accepted");
      setDriverInfo(data.driver);
      toast.success(`Șoferul ${data.driver?.name} a acceptat cursa!`);
      if (data.driver?.id) {
        console.log("[ClientApp] Emitting track:driver for driverId:", data.driver.id);
        emit("track:driver", { driverId: data.driver.id });
      } else {
        console.log("[ClientApp] No driver.id in ride:accepted data");
      }
    });
  }, [on, emit]);

  useEffect(() => {
    on("ride:rejected", () => {
      setRideStatus("rejected");
      toast.error("Șoferul a refuzat cursa. Așteptați reasignare...");
    });
  }, [on]);

  useEffect(() => {
    on("ride:completed", () => {
      setRideStatus("completed");
      setDriverInfo(null);
      clearDirections();
      toast.success("Cursă finalizată! Mulțumim!");
      setTimeout(() => setRideStatus("idle"), 5000);
    });
  }, [on]);

  useEffect(() => {
    on("ride:cancelled", () => {
      setRideStatus("cancelled");
      setDriverInfo(null);
      clearDirections();
      toast.info("Cursa a fost anulată");
      setTimeout(() => setRideStatus("idle"), 3000);
    });
  }, [on]);

  useEffect(() => {
    on("driver:location:update", (data: { driverId: number; lat: number; lng: number }) => {
      console.log("[ClientApp] Driver location update:", data, "clientPos:", clientPos, "rideStatus:", rideStatus);
      setDriverPos({ lat: data.lat, lng: data.lng });
      updateDriverMarker(data.lat, data.lng);
      if (clientPos) {
        // Draw route using OSRM
        if (mapRef.current) {
          fetchOSRMRoute({ lat: data.lat, lng: data.lng }, clientPos).then((route) => {
            if (route && mapRef.current) {
              if (routePolylineRef.current) {
                routePolylineRef.current.remove();
              }
              routePolylineRef.current = L.polyline(route.coordinates, {
                color: "#3b82f6",
                weight: 5,
                opacity: 0.8,
              }).addTo(mapRef.current!);
              const minutes = Math.ceil(route.duration / 60);
              setEstimatedArrival(minutes);
              setCountdownETA(minutes);
            }
          });
        }
        
        // Check if driver is within 50 meters of client
        const distance = calculateDistance(data.lat, data.lng, clientPos.lat, clientPos.lng);
        if (distance <= 50 && !arrivalNotificationRef.current && rideStatus === "accepted") {
          arrivalNotificationRef.current = true;
          setDriverArrived(true);
          setShowArrivalAlert(true);
          playNotificationSound();
          toast.success("Șoferul a sosit! Ieșiți din casă.");
        }
      }
    });
  }, [on, clientPos, updateDriverMarker, rideStatus]);

  // GPS tracking
  useEffect(() => {
    if (!session) return;

    if (navigator.geolocation) {
      // Ask for a high-accuracy fix immediately; maximumAge: 0 so we never
      // reuse a stale last-known-location. Each new fix refines accuracy.
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const ageMs = Date.now() - pos.timestamp;
          // Ignore stale last-known-location fixes (older than ~1.5 min).
          if (ageMs > MAX_LOCATION_AGE_MS) {
            console.warn("[GPS] Ignoring stale fix, age(ms):", ageMs);
            return;
          }
          setGpsError(null);
          setGpsAccuracy(accuracy);
          // Move the map/marker so the user sees progress, even on a coarse fix.
          setClientPos({ lat, lng });
          updateClientMarker(lat, lng);
          // Only share precise fixes with the dispatcher (never a default pin).
          if (accuracy <= GPS_ACCURACY_THRESHOLD_M) {
            emit("location:client", { lat, lng });
          }
          console.log("[GPS] fix lat:", lat, "lng:", lng, "accuracy(m):", Math.round(accuracy));
        },
        (err) => {
          console.warn("GPS error:", err);
          // No silent Bucharest fallback: keep the order button blocked and tell the user.
          setGpsError(
            err.code === err.PERMISSION_DENIED
              ? "Permite accesul la locație pentru a comanda."
              : "Nu s-a putut determina locația. Verifică GPS-ul."
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    } else {
      setGpsError("Dispozitivul nu suportă geolocația.");
    }

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(locationWatchRef.current);
      }
    };
  }, [session, emit]);

  // Reverse geocode the precise fix into a real address (instead of a fake one).
  useEffect(() => {
    if (!gpsReady || !clientPos) return;
    const prev = lastGeocodedRef.current;
    // Only re-geocode when the position moved meaningfully (~25m).
    if (
      prev &&
      Math.abs(prev.lat - clientPos.lat) < 0.0002 &&
      Math.abs(prev.lng - clientPos.lng) < 0.0002
    ) {
      return;
    }
    lastGeocodedRef.current = { lat: clientPos.lat, lng: clientPos.lng };
    let cancelled = false;
    setAddressLoading(true);
    reverseGeocode(clientPos.lat, clientPos.lng)
      .then((addr) => {
        if (!cancelled) setClientAddress(addr);
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gpsReady, clientPos]);

  const handleMapReady = useCallback((map: L.Map) => {
    if (!map) {
      console.error("Map not initialized");
      return;
    }
    mapRef.current = map;
    setMapReady(true);

    if (clientPos) {
      map.setView([clientPos.lat, clientPos.lng], 15);
      updateClientMarker(clientPos.lat, clientPos.lng);
    } else {
      // Center the map on a best-effort fix purely for display; ordering still
      // requires an accurate fix from the high-accuracy watch above.
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.setView([lat, lng], 15);
        },
        (error) => {
          console.warn("Geolocation error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    }
  }, [clientPos, updateClientMarker]);

  const handleCallTaxi = () => {
    if (!session || !clientPos) {
      toast.error("Activați GPS-ul pentru a chema taxi");
      return;
    }
    // Block ordering until we have a precise, fresh fix to avoid sending a
    // default/stale location (e.g. Bucharest) to the dispatcher.
    if (!gpsReady) {
      toast.error("Se determină locația exactă... așteaptă câteva secunde.");
      return;
    }
    setRideStatus("requesting");
    
    // Auto-dial dispatcher
    const dispatcherPhone = "0040758900900";
    window.location.href = `tel:${dispatcherPhone}`;
    
    // Send ride request
    requestRideMut.mutate({
      token: session.token,
      clientLat: clientPos.lat,
      clientLng: clientPos.lng,
      clientAddress: clientAddress || "Locația curentă",
    });
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setRideStatus("idle");
    setRideId(null);
    setDriverInfo(null);
  };

  const handleSimulateLocation = () => {
    // Simulate random location near Bucharest for testing
    const baseLat = 44.4268;
    const baseLng = 26.1025;
    const randomLat = baseLat + (Math.random() - 0.5) * 0.05;
    const randomLng = baseLng + (Math.random() - 0.5) * 0.05;
    setClientPos({ lat: randomLat, lng: randomLng });
    setGpsAccuracy(10); // mark the simulated fix as precise so the button enables
    setGpsError(null);
    emit("location:client", { lat: randomLat, lng: randomLng });
    updateClientMarker(randomLat, randomLng);
    toast.success("Locație simulată pentru test");
  };

  // ─── Login Screen ─────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-50 to-gray-100 dark:from-gray-950 dark:via-blue-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="text-5xl mb-2">🚖</div>
            <CardTitle className="text-gray-900 dark:text-white text-2xl font-bold">Taxi App</CardTitle>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {authMode === "login"
                ? "Autentificare cu telefon și parolă"
                : "Creează un cont nou"}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="+40 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pl-10"
                type="tel"
                autoComplete="tel"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Parolă"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pl-10"
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {authMode === "register" && (
              <>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Confirmă parola"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pl-10"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Nume"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pl-10"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Prenume"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pl-10"
                  />
                </div>
              </>
            )}

            {authMode === "login" ? (
              <Button
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg py-6"
                onClick={() => {
                  if (phone.trim().length < 10) {
                    toast.error("Introdu un număr de telefon valid");
                    return;
                  }
                  if (password.length < 6) {
                    toast.error("Parola trebuie să aibă minim 6 caractere");
                    return;
                  }
                  loginMut.mutate({ phone: phone.trim(), password });
                }}
                disabled={loginMut.isPending}
              >
                {loginMut.isPending ? "Se verifică..." : "Intră în cont"}
              </Button>
            ) : (
              <Button
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg py-6"
                onClick={() => {
                  if (phone.trim().length < 10) {
                    toast.error("Introdu un număr de telefon valid");
                    return;
                  }
                  if (password.length < 6) {
                    toast.error("Parola trebuie să aibă minim 6 caractere");
                    return;
                  }
                  if (password !== confirmPassword) {
                    toast.error("Parolele nu coincid");
                    return;
                  }
                  if (firstName.trim().length < 2) {
                    toast.error("Introdu numele");
                    return;
                  }
                  if (lastName.trim().length < 2) {
                    toast.error("Introdu prenumele");
                    return;
                  }
                  registerMut.mutate({
                    phone: phone.trim(),
                    password,
                    name: `${firstName.trim()} ${lastName.trim()}`,
                  });
                }}
                disabled={registerMut.isPending}
              >
                {registerMut.isPending ? "Se creează..." : "Creează Cont"}
              </Button>
            )}

            <Button
              variant="ghost"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setPassword("");
                setConfirmPassword("");
                setFirstName("");
                setLastName("");
              }}
            >
              {authMode === "login"
                ? "Nu ai cont? Creează Cont"
                : "Ai deja cont? Autentifică-te"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main App ─────────────────────────────────────────────────────────────

  const isRideActive = ["pending", "assigned", "accepted", "in_progress"].includes(rideStatus);

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 md:px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🚖</span>
          <span className="text-yellow-600 dark:text-yellow-400 font-bold">Taxi App</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          <span className="text-gray-500 dark:text-gray-400 text-sm truncate max-w-[40vw]">{session.phone}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs">
            Ieșire
          </Button>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative w-full overflow-hidden" style={{ isolation: "isolate" }}>
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 flex items-center justify-center z-10">
            <span className="text-gray-500 dark:text-gray-400">Se încarcă hartă...</span>
          </div>
        )}
        <MapView onMapReady={handleMapReady} className="w-full h-full" />

        {/* Status overlay */}
        {rideStatus === "pending" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 bg-opacity-95 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg z-[1000]">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Se caută șofer...</span>
          </div>
        )}
        {(rideStatus === "assigned") && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-900 bg-opacity-95 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg z-[1000]">
            <Car className="w-4 h-4 text-blue-300" />
            <span className="text-white text-sm font-medium">Șofer asignat, în așteptare acceptare...</span>
          </div>
        )}
        {rideStatus === "accepted" && countdownETA !== null && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-900 bg-opacity-95 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg z-[1000]">
            <Clock className="w-4 h-4 text-green-300" />
            <span className="text-white text-sm font-medium">
              Soferul vine in {countdownETA > 0 ? `~${countdownETA} min` : "Sosind..."}
            </span>
          </div>
        )}
        {rideStatus === "completed" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-800 bg-opacity-95 rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg z-[1000]">
            <CheckCircle className="w-4 h-4 text-green-300" />
            <span className="text-white text-sm font-medium">Cursă finalizată! Mulțumim!</span>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 max-h-[55vh] overflow-y-auto md:max-h-none [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-2xl">
        {rideStatus === "idle" || rideStatus === "rejected" || rideStatus === "cancelled" ? (
          <div className="flex flex-col gap-3">
            {(rideStatus === "rejected" || rideStatus === "cancelled") && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-center">
                <p className="text-red-300 text-sm">
                  {rideStatus === "rejected" ? "Șoferul a refuzat cursa." : "Cursa a fost anulată."}
                </p>
              </div>
            )}
            {/* Live address / GPS status */}
            <div className="flex items-start gap-2 text-sm">
              <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${gpsReady ? "text-green-500" : "text-yellow-500"}`} />
              <div className="min-w-0">
                {gpsReady ? (
                  <p className="text-gray-900 dark:text-white truncate">
                    {addressLoading || !clientAddress ? "Se caută locația ta..." : clientAddress}
                  </p>
                ) : gpsError ? (
                  <p className="text-red-500">{gpsError}</p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Se caută locația ta...</p>
                )}
                {gpsAccuracy !== null && (
                  <p className="text-gray-400 text-xs">Precizie GPS: ±{Math.round(gpsAccuracy)} m</p>
                )}
              </div>
            </div>
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xl py-8 rounded-2xl shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleCallTaxi}
              disabled={requestRideMut.isPending || !gpsReady}
            >
              {!gpsReady ? (
                <>
                  <div className="w-5 h-5 mr-3 border-2 border-black/40 border-t-transparent rounded-full animate-spin"></div>
                  Se determină locația exactă...
                </>
              ) : (
                <>
                  <Car className="w-6 h-6 mr-3" />
                  {requestRideMut.isPending ? "Se trimite..." : "Cheamă Taxi"}
                </>
              )}
            </Button>
            {!gpsReady && (
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs text-center">
                  Așteaptă fixarea GPS-ului (sub {GPS_ACCURACY_THRESHOLD_M} m) pentru a comanda corect.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleSimulateLocation}
                >
                  🧪 Test cu locație simulată
                </Button>
              </div>
            )}
          </div>
        ) : rideStatus === "pending" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Cerere trimisă</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Dispatcherul caută un șofer disponibil...</p>
              </div>
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <Button
              variant="outline"
              className="border-red-700 text-red-400 hover:bg-red-900"
              onClick={() => rideId && cancelRideMut.mutate({ token: session.token, rideId })}
            >
              <XCircle className="w-4 h-4 mr-2" /> Anulează cererea
            </Button>
          </div>
        ) : rideStatus === "assigned" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold">
                {driverInfo?.name?.[0] || "S"}
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">{driverInfo?.name || "Șofer asignat"}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Așteptăm confirmarea șoferului...</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-700 text-red-400 hover:bg-red-900"
              onClick={() => rideId && cancelRideMut.mutate({ token: session.token, rideId })}
            >
              <XCircle className="w-4 h-4 mr-2" /> Anulează
            </Button>
          </div>
        ) : rideStatus === "accepted" || rideStatus === "in_progress" ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {driverInfo?.name?.[0] || "S"}
            </div>
            <div className="flex-1">
              <p className="text-gray-900 dark:text-white font-semibold">{driverInfo?.name || "Soferul tau"}</p>
              {driverInfo?.phone && <p className="text-gray-500 dark:text-gray-400 text-sm">{driverInfo.phone}</p>}
              {countdownETA !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">
                    {countdownETA > 0 ? `~${countdownETA} min` : "Sosind..."}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <Navigation className="w-6 h-6 text-blue-400" />
              <span className="text-blue-400 text-xs">Live</span>
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Driver Arrival Alert Modal */}
      {showArrivalAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="bg-gradient-to-br from-green-900 to-green-800 border-green-600 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-white text-2xl flex items-center justify-center gap-2">
                <CheckCircle className="w-8 h-8 text-green-400" />
                Soferul a sosit!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <p className="text-white font-semibold text-lg">{driverInfo?.name}</p>
                <p className="text-green-300 text-sm">Masina: {driverInfo?.carPlate}</p>
                <p className="text-green-300 text-sm">{driverInfo?.carBrand}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-200 mb-3">Iesiti din casa si asteptati pe trotuar.</p>
                <Button
                  onClick={() => setShowArrivalAlert(false)}
                  className="bg-green-600 hover:bg-green-700 text-white w-full"
                >
                  Am iesit din casa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
