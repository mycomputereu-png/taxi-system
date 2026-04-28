import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ro } from "date-fns/locale";

interface DriverDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: {
    id: number;
    name: string;
    username: string;
    phone?: string;
    carPlate?: string;
    carBrand?: string;
  };
}

type PeriodType = "today" | "week" | "month" | "all";

export function DriverDetailsModal({ open, onOpenChange, driver }: DriverDetailsModalProps) {
  const [period, setPeriod] = useState<PeriodType>("today");

  // Calculate date range based on period
  const getDateRange = (p: PeriodType) => {
    const now = new Date();
    switch (p) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "week":
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "all":
        return { startDate: undefined, endDate: undefined };
    }
  };

  const dateRange = getDateRange(period);

  // Fetch ride counts for all periods
  const todayRange = getDateRange("today");
  const weekRange = getDateRange("week");
  const monthRange = getDateRange("month");
  const allRange = getDateRange("all");

  const { data: todayRides = [] } = trpc.dispatcher.getDriverRides.useQuery({
    driverId: driver.id,
    startDate: todayRange.startDate,
    endDate: todayRange.endDate,
  });

  const { data: weekRides = [] } = trpc.dispatcher.getDriverRides.useQuery({
    driverId: driver.id,
    startDate: weekRange.startDate,
    endDate: weekRange.endDate,
  });

  const { data: monthRides = [] } = trpc.dispatcher.getDriverRides.useQuery({
    driverId: driver.id,
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
  });

  const { data: allRides = [] } = trpc.dispatcher.getDriverRides.useQuery({
    driverId: driver.id,
    startDate: allRange.startDate,
    endDate: allRange.endDate,
  });

  // Fetch driver rides for current period
  const { data: rides = [], isLoading: ridesLoading } = trpc.dispatcher.getDriverRides.useQuery({
    driverId: driver.id,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Fetch driver statistics
  const { data: stats, isLoading: statsLoading } = trpc.dispatcher.getDriverStatistics.useQuery({
    driverId: driver.id,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const isLoading = ridesLoading || statsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detalii Șofer: {driver.name}
          </DialogTitle>
        </DialogHeader>

        {/* Driver Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 rounded-lg">
          <div>
            <p className="text-sm text-slate-400">Utilizator</p>
            <p className="font-semibold">{driver.username}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Telefon</p>
            <p className="font-semibold">{driver.phone || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Placa Mașinii</p>
            <p className="font-semibold">{driver.carPlate || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Marca Mașinii</p>
            <p className="font-semibold">{driver.carBrand || "-"}</p>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex gap-4 p-4 flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <Button
              variant={period === "today" ? "default" : "outline"}
              onClick={() => setPeriod("today")}
              size="sm"
            >
              Azi
            </Button>
            <span className="text-xs text-slate-400">{todayRides.length}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              variant={period === "week" ? "default" : "outline"}
              onClick={() => setPeriod("week")}
              size="sm"
            >
              Săptămâna
            </Button>
            <span className="text-xs text-slate-400">{weekRides.length}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              variant={period === "month" ? "default" : "outline"}
              onClick={() => setPeriod("month")}
              size="sm"
            >
              Luna
            </Button>
            <span className="text-xs text-slate-400">{monthRides.length}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              variant={period === "all" ? "default" : "outline"}
              onClick={() => setPeriod("all")}
              size="sm"
            >
              Tot
            </Button>
            <span className="text-xs text-slate-400">{allRides.length}</span>
          </div>
        </div>

        {/* Statistics */}
        {!isLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-900 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-slate-400">Curse Totale</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalRides}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">Curse Finalizate</p>
              <p className="text-2xl font-bold text-green-400">{stats.completedRides}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">Total KM</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.totalDistanceKm.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">Venituri</p>
              <p className="text-2xl font-bold text-green-500">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">Rating Mediu</p>
              <p className="text-2xl font-bold text-amber-400">
                {stats.averageRating ? stats.averageRating.toFixed(1) : "-"} ⭐
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">Ratinguri</p>
              <p className="text-2xl font-bold text-purple-400">{stats.ratingCount}</p>
            </div>
          </div>
        )}

        {/* Rides Table */}
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Curse</h3>
          {isLoading ? (
            <p className="text-center text-slate-400">Se încarcă...</p>
          ) : rides.length === 0 ? (
            <p className="text-center text-slate-400">Nicio cursă în această perioadă</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Client</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">KM</th>
                    <th className="px-4 py-2 text-right">Venit</th>
                  </tr>
                </thead>
                <tbody>
                  {rides.map((ride) => (
                    <tr key={ride.id} className="border-b border-slate-700 hover:bg-slate-800">
                      <td className="px-4 py-3">
                        {format(new Date(ride.createdAt), "dd MMM yyyy HH:mm", { locale: ro })}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold">{ride.clientName || "Client"}</p>
                          <p className="text-xs text-slate-400">{ride.clientPhone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ride.status === "completed" ? "bg-green-900 text-green-200" :
                          ride.status === "in_progress" ? "bg-blue-900 text-blue-200" :
                          ride.status === "accepted" ? "bg-purple-900 text-purple-200" :
                          "bg-slate-700 text-slate-200"
                        }`}>
                          {ride.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ride.distanceKm ? parseFloat(String(ride.distanceKm)).toFixed(1) : "-"} km
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${ride.revenue ? parseFloat(String(ride.revenue)).toFixed(2) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
