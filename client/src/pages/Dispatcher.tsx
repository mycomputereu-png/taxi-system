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
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // tRPC queries and mutations
  const utils = trpc.useUtils();
  const dispatcherLogin = trpc.dispatcher.login.useMutation();
  const driversQuery = trpc.dispatcher.getDrivers.useQuery(undefined, { enabled: isAuthenticated });
  const activeRidesQuery = trpc.dispatcher.getActiveRides.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });
  const historyQuery = trpc.dispatcher.getRideHistory.useQuery(undefined, { enabled: isAuthenticated });
  const clientsQuery = trpc.dispatcher.getAllClientsWithRatings.useQuery();
  const panicAlertsQuery = trpc.dispatcher.getActivePanicAlerts.useQuery(undefined, { enabled: isAuthenticated });
  
  // Handle login
  const handleLogin = useCallback(async () => {
    setIsLoginLoading(true);
    try {
      await dispatcherLogin.mutateAsync({ email: loginEmail, password: loginPassword });
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setIsLoginLoading(false);
    }
  }, [loginEmail, loginPassword, dispatcherLogin]);

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
            <Input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
            <Input
              type="password"
              placeholder="Parolă"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              onClick={handleLogin}
              disabled={isLoginLoading || !loginEmail || !loginPassword}
            >
              {isLoginLoading ? "Se încarcă..." : "Intră în Aplicație"}
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
            <TabsContent value="pending" className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                {pendingRides.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nicio cursă în așteptare</p>
                ) : (
                  pendingRides.map((ride) => (
                    <Card key={ride.id} className="bg-gray-800 border-red-600 border cursor-pointer hover:bg-gray-700" onClick={() => setSelectedRide(ride.id)}>
                      <CardContent className="p-2">
                        <div className="text-xs font-bold text-red-400">Cursă #{ride.id}</div>
                        <div className="text-xs text-gray-300">{ride.clientAddress || "Locație necunoscută"}</div>
                        <div className="text-xs text-gray-400 mt-1">→ {ride.destinationAddress || "Destinație necunoscută"}</div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Active Rides Tab */}
            <TabsContent value="active" className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                {assignedRides.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Nicio cursă activă</p>
                ) : (
                  assignedRides.map((ride) => (
                    <Card key={ride.id} className="bg-gray-800 border-blue-600 border cursor-pointer hover:bg-gray-700" onClick={() => setSelectedRide(ride.id)}>
                      <CardContent className="p-2">
                        <div className="text-xs font-bold text-blue-400">Cursă #{ride.id}</div>
                        <div className="text-xs text-gray-300">{ride.driver?.name || "Șofer necunoscut"}</div>
                        <div className="text-xs text-gray-400 mt-1">Status: {ride.status}</div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Drivers Tab */}
            <TabsContent value="drivers" className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setAddDriverOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Adaugă Șofer
                </Button>
                {driversQuery.data?.map((driver) => (
                  <Card key={driver.id} className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-700" onClick={() => { setSelectedDriver(driver); setDriverDetailsOpen(true); }}>
                    <CardContent className="p-2">
                      <div className="text-xs font-bold text-white">{driver.name}</div>
                      <div className="text-xs text-gray-400">{driver.username}</div>
                      <Badge className={driver.status === "available" ? "bg-green-600" : driver.status === "busy" ? "bg-blue-600" : "bg-gray-600"}>
                        {driver.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                {clientsQuery.data?.map((client) => (
                  <Card key={client.id} className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-700" onClick={() => setSelectedClientId(client.id)}>
                    <CardContent className="p-2">
                      <div className="text-xs font-bold text-white">{client.name || "Client"}</div>
                      <div className="text-xs text-gray-400">{client.phone}</div>
                      <div className="text-xs text-yellow-400">⭐ {client.averageRating?.toFixed(1) || "N/A"}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Panic Alerts Tab */}
            <TabsContent value="panic" className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                {panicAlertsQuery.data?.map((alert) => (
                  <Card key={alert.id} className="bg-gray-800 border-red-600 border cursor-pointer hover:bg-gray-700" onClick={() => setSelectedPanicAlertId(alert.id)}>
                    <CardContent className="p-2">
                      <div className="text-xs font-bold text-red-400">🚨 Alarmă #{alert.id}</div>
                      <div className="text-xs text-gray-300">Client: {alert.clientId}</div>
                      <div className="text-xs text-gray-400 mt-1">Status: {alert.status}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Map */}
        <div className="flex-1 bg-gray-900 relative">
          <MapView onMapReady={(map) => { mapRef.current = map; setMapReady(true); }} />
        </div>
      </div>
    </div>
  );
}
