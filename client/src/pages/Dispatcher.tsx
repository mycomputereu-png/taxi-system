import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useSocket, getSocket } from "@/hooks/useSocket";
import { DriverDetailsModal } from "@/components/DriverDetailsModal";
import {
  MapPin, Users, Car, Clock, Plus, Trash2, LogOut, CheckCircle, XCircle, Navigation, Star, Phone, ArrowLeft
} from "lucide-react";


type DriverMarker = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
  marker?: google.maps.Marker;
};

type ClientMarker = {
  id: number;
  rideId: number;
  phone?: string;
  name?: string;
  lat: number;
  lng: number;
  marker?: google.maps.Marker;
};

type RideWithClientDriver = {
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
  driver?: {
    id: number;
    name: string;
    phone: string | null;
    username: string;
    carPlate: string | null;
    carBrand: string | null;
  } | null;
};

export default function Dispatcher() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { emit, on, socket: socketRef } = useSocket();

  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const clientMarkersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const [driverLocations, setDriverLocations] = useState<Map<number, DriverMarker>>(new Map());
  const [clientLocations, setClientLocations] = useState<Map<number, ClientMarker>>(new Map());
  const [selectedRide, setSelectedRide] = useState<number | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({ username: "", password: "", name: "", phone: "", carPlate: "", carBrand: "" });
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [ratingsSortBy, setRatingsSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [ridesSortBy, setRidesSortBy] = useState<"newest" | "oldest" | "completed" | "cancelled">("newest");
  const [selectedPanicAlertId, setSelectedPanicAlertId] = useState<number | null>(null);
  const [panicResponseNote, setPanicResponseNote] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [driverDetailsOpen, setDriverDetailsOpen] = useState(false);

  // tRPC queries
  const utils = trpc.useUtils();
  const driversQuery = trpc.dispatcher.getDrivers.useQuery(undefined, { enabled: isAuthenticated });
  const activeRidesQuery = trpc.dispatcher.getActiveRides.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });
  const historyQuery = trpc.dispatcher.getRideHistory.useQuery(undefined, { enabled: isAuthenticated });
  const clientsQuery = trpc.dispatcher.getAllClientsWithRatings.useQuery();
  
  // Debug logging
  if (clientsQuery.data) {
    console.log("Clients data:", clientsQuery.data.slice(0, 3).map(item => ({
      phone: item.client.phone,
      rideCount: item.rideCount,
      avgRating: item.avgRating,
      ratingCount: item.ratingCount,
    })));
  }
  const panicAlertsQuery = trpc.panic.getActivePanicAlerts.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const clientProfileQuery = trpc.dispatcher.getClientProfile.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const addDriverMut = trpc.dispatcher.addDriver.useMutation({
    onSuccess: () => {
      toast.success("Șofer adăugat cu succes!");
      utils.dispatcher.getDrivers.invalidate();
      setNewDriver({ username: "", password: "", name: "", phone: "", carPlate: "", carBrand: "" });
      setAddDriverOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDriverMut = trpc.dispatcher.deleteDriver.useMutation({
    onSuccess: () => {
      toast.success("Șofer șters!");
      utils.dispatcher.getDrivers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignRideMut = trpc.dispatcher.assignRide.useMutation({
    onSuccess: () => {
      toast.success("Cursă asignată!");
      utils.dispatcher.getActiveRides.invalidate();
      setAssignDialogOpen(false);
      setSelectedRide(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelRideMut = trpc.dispatcher.cancelRide.useMutation({
    onSuccess: () => {
      toast.success("Cursă anulată!");
      utils.dispatcher.getActiveRides.invalidate();
    },
  });

  // Invalidate client profile when client ratings change
  useEffect(() => {
    if (!socketRef.current) return;
    const handleClientRated = () => {
      utils.dispatcher.getClientProfile.invalidate();
      utils.dispatcher.getAllClientsWithRatings.invalidate();
    };
    socketRef.current.on("client:rated", handleClientRated);
    return () => {
      socketRef.current?.off("client:rated", handleClientRated);
    };
  }, [socketRef, utils]);

  // Socket.IO setup
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Wait for Socket.IO to connect before emitting auth
    const socket = socketRef.current || getSocket();
    const handleConnect = () => {
      console.log("[Dispatcher] Socket.IO connected, emitting auth:dispatcher");
      emit("auth:dispatcher");
    };
    
    if (socket.connected) {
      handleConnect();
    } else {
      socket.once("connect", handleConnect);
    }

    const unsubDriverLoc = on("driver:location", (data: { driverId: number; lat: number; lng: number }) => {
      console.log("[Dispatcher] driver:location event received:", data);
      setDriverLocations((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.driverId);
        next.set(data.driverId, { ...(existing || { id: data.driverId, name: "", status: "available" }), lat: data.lat, lng: data.lng });
        console.log("[Dispatcher] Updated driver locations:", next);
        return next;
      });
    });

    const unsubDriverStatus = on("driver:status", (data: { driverId: number; status: string }) => {
      console.log("[Dispatcher] driver:status event received:", data);
      // Update driver locations map with new status
      setDriverLocations((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.driverId);
        if (existing) {
          next.set(data.driverId, { ...existing, status: data.status });
        }
        return next;
      });
      // Also invalidate drivers query to update the list
      utils.dispatcher.getDrivers.invalidate();
    });

    const unsubRideNew = on("ride:new", (data: any) => {
      console.log("[Dispatcher] Ride new event received:", data);
      toast.info(`🚖 Cerere nouă taxi de la ${data.clientPhone}`, { duration: 8000 });
      setClientLocations((prev) => {
        const next = new Map(prev);
        next.set(data.clientId, {
          id: data.clientId,
          rideId: data.rideId,
          phone: data.clientPhone,
          name: data.clientName,
          lat: parseFloat(String(data.lat)),
          lng: parseFloat(String(data.lng)),
        });
        console.log("[Dispatcher] Updated client locations:", next);
        return next;
      });
      utils.dispatcher.getActiveRides.invalidate();
    });

    const unsubRideStatus = on("ride:status", () => {
      utils.dispatcher.getActiveRides.invalidate();
    });

    const unsubClientLoc = on("client:location", (data: { clientId: number; lat: number; lng: number }) => {
      setClientLocations((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.clientId);
        if (existing) next.set(data.clientId, { ...existing, lat: data.lat, lng: data.lng });
        return next;
      });
    });

    return () => {
      unsubDriverLoc();
      unsubDriverStatus();
      unsubRideNew();
      unsubRideStatus();
      unsubClientLoc();
    };
  }, [isAuthenticated, emit, on, utils]);

  // Initialize driver locations from DB
  useEffect(() => {
    if (!driversQuery.data) return;
    setDriverLocations((prev) => {
      const next = new Map(prev);
      for (const d of driversQuery.data) {
        if (d.currentLat && d.currentLng) {
          const existing = next.get(d.id);
          next.set(d.id, {
            id: d.id,
            name: d.name,
            status: d.status,
            lat: parseFloat(String(d.currentLat)),
            lng: parseFloat(String(d.currentLng)),
            ...(existing || {}),
          });
        }
      }
      return next;
    });
  }, [driversQuery.data]);

  // Initialize client locations from active rides
  useEffect(() => {
    if (!activeRidesQuery.data) return;
    setClientLocations((prev) => {
      const next = new Map(prev);
      for (const r of activeRidesQuery.data) {
        if (r.clientLat && r.clientLng && r.client) {
          next.set(r.clientId, {
            id: r.clientId,
            rideId: r.id,
            phone: r.client.phone,
            name: r.client.name ?? undefined,
            lat: parseFloat(String(r.clientLat)),
            lng: parseFloat(String(r.clientLng)),
          });
        }
      }
      return next;
    });
  }, [activeRidesQuery.data]);

  // Update map markers
  useEffect(() => {
    console.log("[Dispatcher] Map marker update effect triggered, mapReady:", mapReady, "driverLocations:", driverLocations.size);
    if (!mapReady || !mapRef.current) return;

    // Driver markers (green with arrow)
    driverLocations.forEach((d) => {
      console.log("[Dispatcher] Rendering driver marker for driver", d.id, "at", d.lat, d.lng);
      let marker = driverMarkersRef.current.get(d.id);
      if (!marker) {
        marker = new google.maps.Marker({
          map: mapRef.current!,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: "#22c55e",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: d.name,
          zIndex: 100,
          animation: google.maps.Animation.DROP,
        });
        const infoWindow = new google.maps.InfoWindow();
        marker.addListener("click", () => {
          const statusColor = d.status === "available" ? "#22c55e" : "#f59e0b";
          infoWindow.setContent(
            `<div style="background:#1f2937;color:#fff;padding:12px;border-radius:8px;font-family:Arial,sans-serif;">
              <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${d.name}</div>
              <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">ID: ${d.id}</div>
              <div style="display:inline-block;padding:4px 8px;background:${statusColor};color:#fff;border-radius:4px;font-size:11px;font-weight:bold;">${d.status.toUpperCase()}</div>
            </div>`
          );
          infoWindow.open(mapRef.current!, marker);
        });
        driverMarkersRef.current.set(d.id, marker);
      }
      marker.setPosition({ lat: d.lat, lng: d.lng });
      // Update icon color based on status
      const fillColor = d.status === "available" ? "#22c55e" : "#f59e0b";
      marker.setIcon({
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: fillColor,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      });
    });

    // Client markers (red circle)
    console.log("[Dispatcher] Rendering client markers, count:", clientLocations.size);
    clientLocations.forEach((c) => {
      console.log("[Dispatcher] Processing client marker:", c);
      let marker = clientMarkersRef.current.get(c.id);
      if (!marker) {
        marker = new google.maps.Marker({
          map: mapRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
          title: c.phone,
          zIndex: 50,
          animation: google.maps.Animation.DROP,
        });
        const infoWindow = new google.maps.InfoWindow();
        marker.addListener("click", () => {
          infoWindow.setContent(
            `<div style="background:#1f2937;color:#fff;padding:12px;border-radius:8px;font-family:Arial,sans-serif;">
              <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${c.name || "Client"}</div>
              <div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">${c.phone}</div>
              <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">Cursă #${c.rideId}</div>
              <button onclick="window.dispatchEvent(new CustomEvent('assignRide', {detail: ${c.rideId}})" style="background:#3b82f6;color:white;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;width:100%;">Asignează</button>
            </div>`
          );
          infoWindow.open(mapRef.current!, marker);
        });
        clientMarkersRef.current.set(c.id, marker);
      }
      marker.setPosition({ lat: c.lat, lng: c.lng });
    });
    // Fit bounds to show all markers
    if ((driverLocations.size > 0 || clientLocations.size > 0) && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      driverLocations.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
      clientLocations.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
      mapRef.current.fitBounds(bounds, 100);
    }
  }, [mapReady, driverLocations, clientLocations]);

  // Listen for assign from map popup
  useEffect(() => {
    const handler = (e: Event) => {
      const rideId = (e as CustomEvent).detail;
      setSelectedRide(rideId);
      setAssignDialogOpen(true);
    };
    window.addEventListener("assignRide", handler);
    return () => window.removeEventListener("assignRide", handler);
  }, []);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    console.log("[Dispatcher] Map ready callback triggered");
    mapRef.current = map;
    setMapReady(true);
    // Set initial view to Bucharest
    map.setCenter({ lat: 44.4268, lng: 26.1025 });
    map.setZoom(13);
    console.log("[Dispatcher] Map initialized and centered");
    // Add map styles for better visibility
    map.setOptions({
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
          featureType: "administrative.locality",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#263c3f" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.fill",
          stylers: [{ color: "#6b9080" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#38414e" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#212a37" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#746855" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#1f2835" }],
        },
        {
          featureType: "road.highway",
          elementType: "labels.text.fill",
          stylers: [{ color: "#f3751ff" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#2f3948" }],
        },
        {
          featureType: "transit.station",
          elementType: "labels.text.fill",
          stylers: [{ color: "#d59563" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#17263c" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.fill",
          stylers: [{ color: "#515c6d" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#17263c" }],
        },
      ],
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Se încarcă...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="w-96 bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-center text-2xl">🚖 Dispatcher</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-gray-400 text-center">Autentifică-te pentru a accesa panoul de dispatcher</p>
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              onClick={() => {
                const loginUrl = getLoginUrl();
                window.location.href = loginUrl;
              }}
            >
              Autentificare Dispatcher
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableDrivers = driversQuery.data?.filter((d) => d.status === "available") ?? [];
  const busyDrivers = driversQuery.data?.filter((d) => d.status === "busy") ?? [];
  const pendingRides = activeRidesQuery.data?.filter((r) => r.status === "pending") ?? [];
  const assignedRides = activeRidesQuery.data?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚖</span>
          <h1 className="text-xl font-bold text-yellow-400">Taxi Dispatcher</h1>
          <Badge className="bg-green-600 text-white">Online</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={() => logout()} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            <LogOut className="w-4 h-4 mr-1" /> Ieșire
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-96 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Stats Bar */}
          <div className="px-3 py-3 border-b border-gray-800 grid grid-cols-3 gap-2">
            <Card className="bg-gray-800 border-gray-700 p-2">
              <div className="text-xs text-gray-400">Curse</div>
              <div className="text-lg font-bold text-red-400">{pendingRides.length}</div>
            </Card>
            <Card className="bg-gray-800 border-gray-700 p-2">
              <div className="text-xs text-gray-400">Active</div>
              <div className="text-lg font-bold text-blue-400">{assignedRides.length}</div>
            </Card>
            <Card className="bg-gray-800 border-gray-700 p-2">
              <div className="text-xs text-gray-400">Șoferi</div>
              <div className="text-lg font-bold text-green-400">{driversQuery.data?.length || 0}</div>
            </Card>
          </div>

          <Tabs defaultValue="pending" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid grid-cols-5 m-3 bg-gray-800">
              <TabsTrigger value="pending" className="text-xs font-semibold dispatcher-tab-pending">
                <Car className="w-3 h-3 mr-1" /> Curse
                {pendingRides.length > 0 && (
                  <span className="ml-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                    {pendingRides.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs font-semibold dispatcher-tab-active">
                <Car className="w-3 h-3 mr-1" /> Active
                {assignedRides.length > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {assignedRides.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="drivers" className="text-xs font-semibold dispatcher-tab-drivers">
                <Users className="w-3 h-3 mr-1" /> Șoferi
              </TabsTrigger>
              <TabsTrigger value="clients" className="text-xs font-semibold dispatcher-tab-clients">
                <Users className="w-3 h-3 mr-1" /> Clienți
              </TabsTrigger>
              <TabsTrigger value="panic" className="text-xs font-semibold dispatcher-tab-panic">
                <span className="text-lg mr-1">🚨</span> SOS
                {panicAlertsQuery.data && panicAlertsQuery.data.length > 0 && (
                  <span className="ml-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                    {panicAlertsQuery.data.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Pending Rides Tab */}
            <TabsContent value="pending" className="flex-1 overflow-y-auto px-3 pb-3 mt-0">
              {pendingRides.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Curse în așteptare ({pendingRides.length})
                  </h3>
                  {pendingRides.map((ride) => (
                    <Card key={ride.id} className="mb-2 bg-gray-800 border-red-800 hover:border-red-600 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white text-sm">{ride.client?.name || "Client"}</p>
                              <Badge className="bg-red-700 text-xs">Nou</Badge>
                            </div>
                            <div className="mt-2 space-y-1">
                              <p className="text-gray-300 text-xs flex items-center gap-1">
                                <span className="font-medium">Tel:</span> {ride.client?.phone}
                              </p>
                              {ride.clientAddress && (
                                <p className="text-gray-400 text-xs flex items-start gap-1">
                                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>{ride.clientAddress}</span>
                                </p>
                              )}
                              {ride.clientLat && ride.clientLng && (
                                <p className="text-gray-500 text-xs">
                                  📍 {parseFloat(String(ride.clientLat)).toFixed(4)}, {parseFloat(String(ride.clientLng)).toFixed(4)}
                                </p>
                              )}
                              <p className="text-gray-500 text-xs mt-1">
                                {new Date(ride.createdAt).toLocaleTimeString("ro-RO")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-xs whitespace-nowrap"
                              onClick={() => { setSelectedRide(ride.id); setAssignDialogOpen(true); }}
                            >
                              <Navigation className="w-3 h-3 mr-1" /> Asignează
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-700 text-red-400 hover:bg-red-900 text-xs whitespace-nowrap"
                              onClick={() => cancelRideMut.mutate({ rideId: ride.id })}
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Anulează
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {pendingRides.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nicio cursă în așteptare</p>
                </div>
              )}
            </TabsContent>

            {/* Active Rides Tab */}
            <TabsContent value="active" className="flex-1 overflow-y-auto px-3 pb-3 mt-0">
              {assignedRides.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">Curse active ({assignedRides.length})</h3>
                  {assignedRides.map((ride) => (
                    <Card key={ride.id} className="mb-2 bg-gray-800 border-gray-700">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-white text-sm">{ride.client?.name || ride.client?.phone}</p>
                            <p className="text-gray-400 text-xs">
                              Șofer: {ride.driver?.name || "—"}
                            </p>
                            <Badge
                              className={`text-xs mt-1 ${
                                ride.status === "accepted" ? "bg-green-700" :
                                ride.status === "assigned" ? "bg-blue-700" :
                                ride.status === "in_progress" ? "bg-purple-700" : "bg-gray-700"
                              }`}
                            >
                              {ride.status}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-700 text-red-400 hover:bg-red-900 text-xs"
                            onClick={() => cancelRideMut.mutate({ rideId: ride.id })}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {assignedRides.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nicio cursă activă</p>
                </div>
              )}
            </TabsContent>

            {/* Drivers Tab */}
            <TabsContent value="drivers" className="flex-1 overflow-y-auto px-3 pb-3 mt-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Șoferi ({driversQuery.data?.length ?? 0})</h3>
                <Dialog open={addDriverOpen} onOpenChange={setAddDriverOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Adaugă
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Adaugă Șofer Nou</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                      <Input
                        placeholder="Nume complet"
                        value={newDriver.name}
                        onChange={(e) => setNewDriver((p) => ({ ...p, name: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Username"
                        value={newDriver.username}
                        onChange={(e) => setNewDriver((p) => ({ ...p, username: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Parolă"
                        type="password"
                        value={newDriver.password}
                        onChange={(e) => setNewDriver((p) => ({ ...p, password: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Telefon (opțional)"
                        value={newDriver.phone}
                        onChange={(e) => setNewDriver((p) => ({ ...p, phone: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Numărul mașinii (opțional)"
                        value={newDriver.carPlate}
                        onChange={(e) => setNewDriver((p) => ({ ...p, carPlate: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Input
                        placeholder="Marca automobilului (opțional)"
                        value={newDriver.carBrand}
                        onChange={(e) => setNewDriver((p) => ({ ...p, carBrand: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                      <Button
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                        onClick={() => addDriverMut.mutate(newDriver)}
                        disabled={addDriverMut.isPending}
                      >
                        {addDriverMut.isPending ? "Se adaugă..." : "Adaugă Șofer"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {driversQuery.data?.map((driver) => (
                <Card
                  key={driver.id}
                  className="mb-2 bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
                  onClick={() => {
                    setSelectedDriver(driver);
                    setDriverDetailsOpen(true);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white text-sm">{driver.name}</p>
                        <p className="text-gray-400 text-xs">@{driver.username}</p>
                        {driver.phone && <p className="text-gray-500 text-xs">☎️ {driver.phone}</p>}
                        {(driver as any).carPlate && <p className="text-gray-500 text-xs">🚗 {(driver as any).carPlate}</p>}
                        {(driver as any).carBrand && <p className="text-gray-500 text-xs">📍 {(driver as any).carBrand}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs ${
                            driver.status === "available" ? "bg-green-700" :
                            driver.status === "busy" ? "bg-orange-700" : "bg-gray-700"
                          }`}
                        >
                          {driver.status === "available" ? "Disponibil" :
                           driver.status === "busy" ? "Ocupat" : "Offline"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-900 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDriverMut.mutate({ driverId: driver.id });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {(!driversQuery.data || driversQuery.data.length === 0) && (
                <div className="text-center text-gray-500 mt-8">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Niciun șofer înregistrat</p>
                </div>
              )}
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="flex-1 overflow-hidden flex flex-col mt-0">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 px-3 pt-3 flex-shrink-0">Clienți și rating-uri</h3>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {clientsQuery.data && clientsQuery.data.length > 0 ? (
                  clientsQuery.data.map((item: any) => (
                    <Card
                      key={item.client.id}
                      className="mb-2 bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 hover:border-gray-600 transition-colors"
                      onClick={() => setSelectedClientId(item.client.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium mb-1">{item.client.name || item.client.phone}</p>
                            <p className="text-gray-400 text-xs mb-2">Tel: {item.client.phone}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-gray-900 rounded p-1.5">
                                <p className="text-gray-400">Curse</p>
                                <p className="text-white font-semibold">{item.rideCount || 0}</p>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5">
                                {item.avgRating && item.avgRating > 0 ? (
                                  <>
                                    <p className="text-gray-400">Rating</p>
                                    <p className="text-yellow-400 font-semibold">★ {Number(item.avgRating).toFixed(1)}</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-gray-400">Rating</p>
                                    <p className="text-gray-500 text-xs">N/A</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <p>Niciun client</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Panic Alerts Tab */}
            <TabsContent value="panic" className="flex-1 overflow-y-auto px-3 pb-3 mt-0">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <span className="text-lg">🚨</span> Alerte SOS
              </h3>
              {panicAlertsQuery.data && panicAlertsQuery.data.length > 0 ? (
                panicAlertsQuery.data.map((alert: any) => (
                  <Card
                    key={alert.id}
                    className={`mb-2 cursor-pointer transition-colors ${
                      selectedPanicAlertId === alert.id
                        ? "bg-red-900 border-red-600"
                        : "bg-gray-800 border-red-700 hover:bg-gray-750"
                    }`}
                    onClick={() => setSelectedPanicAlertId(alert.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg animate-pulse">🚨</span>
                            <p className="text-white text-sm font-bold">Șofer #{alert.driverId}</p>
                            <Badge className="bg-red-600 text-white text-xs">{alert.status}</Badge>
                          </div>
                          <p className="text-gray-300 text-xs mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {alert.driverAddress || "Locație necunoscută"}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(alert.createdAt).toLocaleString("ro-RO")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <p>Nicio alertă de urgență</p>
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 overflow-y-auto px-3 pb-3 mt-0">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Istoric curse</h3>
              {historyQuery.data?.map((ride) => (
                <Card key={ride.id} className="mb-2 bg-gray-800 border-gray-700">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">#{ride.id} - {(ride as RideWithClientDriver).client?.name || (ride as RideWithClientDriver).client?.phone}</p>
                        <p className="text-gray-400 text-xs">Șofer: {(ride as RideWithClientDriver).driver?.name || "—"}</p>
                        <p className="text-gray-500 text-xs">{new Date(ride.createdAt).toLocaleString("ro-RO")}</p>
                      </div>
                      <Badge
                        className={`text-xs ${
                          ride.status === "completed" ? "bg-green-700" :
                          ride.status === "cancelled" ? "bg-gray-700" :
                          ride.status === "rejected" ? "bg-red-700" : "bg-blue-700"
                        }`}
                      >
                        {ride.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Map */}
        <div className="flex-1 relative flex flex-col">
          <MapView onMapReady={handleMapReady} className="flex-1 w-full" />

          {/* Map Legend */}
          <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 rounded-lg p-3 text-xs text-white border border-gray-700">
            <div className="font-semibold mb-2 text-yellow-400">Legendă</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Șoferi disponibili ({availableDrivers.length})</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Șoferi ocupați ({busyDrivers.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Clienți în așteptare ({clientLocations.size})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Client Profile Dialog */}
      <Dialog open={!!selectedClientId} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-h-screen overflow-y-auto max-w-2xl">
          {clientProfileQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-400">Se încarcă profil...</p>
            </div>
          ) : clientProfileQuery.data ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>Profil Client</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Client Info */}
                <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium">{clientProfileQuery.data.client.name || clientProfileQuery.data.client.phone}</p>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {clientProfileQuery.data.client.phone}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-700 mt-2">
                    <div>
                      <p className="text-gray-400 text-xs">Total Curse</p>
                      <p className="text-lg font-bold text-white">{clientProfileQuery.data.rides.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Finalizate</p>
                      <p className="text-lg font-bold text-green-400">{clientProfileQuery.data.completedRides}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Rating Mediu</p>
                      <p className="text-lg font-bold text-yellow-400">{typeof clientProfileQuery.data.avgRating === 'number' ? clientProfileQuery.data.avgRating.toFixed(1) : "N/A"}/5</p>
                    </div>
                  </div>
                </div>



                {/* Ride History */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-300">Istoric Curse ({clientProfileQuery.data.rides.length})</h3>
                    <select
                      value={ridesSortBy}
                      onChange={(e) => setRidesSortBy(e.target.value as any)}
                      className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1"
                    >
                      <option value="newest">Cea mai nouă</option>
                      <option value="oldest">Cea mai veche</option>
                      <option value="completed">Finalizate</option>
                      <option value="cancelled">Anulate</option>
                    </select>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {clientProfileQuery.data.rides.length > 0 ? (
                      clientProfileQuery.data.rides
                        .sort((a, b) => {
                          if (ridesSortBy === "newest") return new Date(b.ride.createdAt).getTime() - new Date(a.ride.createdAt).getTime();
                          if (ridesSortBy === "oldest") return new Date(a.ride.createdAt).getTime() - new Date(b.ride.createdAt).getTime();
                          if (ridesSortBy === "completed") return (b.ride.status === "completed" ? 1 : 0) - (a.ride.status === "completed" ? 1 : 0);
                          if (ridesSortBy === "cancelled") return (b.ride.status === "cancelled" ? 1 : 0) - (a.ride.status === "cancelled" ? 1 : 0);
                          return 0;
                        })
                        .map((item, idx) => (
                        <div key={idx} className="border border-gray-700 rounded-lg p-2 bg-gray-800">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-white text-sm font-medium">Cursa #{item.ride.id}</p>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                item.ride.status === "completed"
                                  ? "bg-green-900 text-green-300 border-green-700"
                                  : item.ride.status === "cancelled"
                                  ? "bg-red-900 text-red-300 border-red-700"
                                  : "bg-gray-700 text-gray-300 border-gray-600"
                              }`}
                            >
                              {item.ride.status === "completed"
                                ? "Finalizată"
                                : item.ride.status === "cancelled"
                                ? "Anulată"
                                : item.ride.status}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-xs mb-1">
                            {new Date(item.ride.createdAt).toLocaleDateString("ro-RO")}
                          </p>
                          {item.driver && (
                            <p className="text-gray-400 text-xs mb-1">Șofer: <span className="text-white">{item.driver.name}</span></p>
                          )}
                          {item.ride.clientAddress && (
                            <p className="text-gray-400 text-xs flex items-start gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              {item.ride.clientAddress}
                            </p>
                          )}
                          
                          {/* Inline Rating if exists */}
                          {clientProfileQuery.data.ratingsReceived.find((r: any) => r.ride && r.ride.id === item.ride.id) && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="bg-gray-900 rounded p-2">
                                {(() => {
                                  const rideRating = clientProfileQuery.data.ratingsReceived.find((r: any) => r.ride && r.ride.id === item.ride.id);
                                  if (!rideRating) return null;
                                  return (
                                    <>
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex gap-0.5">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <span key={star} className={`text-xs ${star <= rideRating.rating.rating ? "text-yellow-400" : "text-gray-600"}`}>★</span>
                                          ))}
                                        </div>
                                        <span className="text-gray-500 text-xs">{new Date(rideRating.rating.createdAt).toLocaleDateString("ro-RO")}</span>
                                      </div>
                                      {rideRating.driver && <p className="text-gray-400 text-xs mb-1">De la: <span className="text-white">{rideRating.driver.name}</span></p>}
                                      {rideRating.rating.comment && <p className="text-gray-300 text-xs italic">\"{rideRating.rating.comment}\"</p>}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-xs text-center py-2">Nicio cursă</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-red-400">
              <p>Eroare la încărcarea profilului</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Ride Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Asignează Cursă #{selectedRide}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-gray-400 text-sm">Selectează un șofer disponibil:</p>
            {availableDrivers.length === 0 ? (
              <p className="text-red-400 text-center py-4">Niciun șofer disponibil momentan</p>
            ) : (
              availableDrivers.map((driver) => (
                <Button
                  key={driver.id}
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-800 text-white justify-start"
                  onClick={() => {
                    if (selectedRide) assignRideMut.mutate({ rideId: selectedRide, driverId: driver.id });
                  }}
                  disabled={assignRideMut.isPending}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {driver.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{driver.name}</p>
                      <p className="text-gray-400 text-xs">@{driver.username} {driver.phone && `· ${driver.phone}`}</p>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Driver Details Modal */}
      {selectedDriver && (
        <DriverDetailsModal
          open={driverDetailsOpen}
          onOpenChange={setDriverDetailsOpen}
          driver={selectedDriver}
        />
      )}
    </div>
  );
}
