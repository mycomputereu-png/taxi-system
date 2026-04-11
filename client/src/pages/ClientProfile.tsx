import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Star, MapPin, Clock, User, Phone } from "lucide-react";

type ClientProfileProps = {
  token: string;
  onBack: () => void;
};

export default function ClientProfile({ token, onBack }: ClientProfileProps) {
  // Placeholder - getProfile not yet implemented
  const profileQuery = { data: null, isLoading: false };

  if (profileQuery.isLoading || !profileQuery.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-gray-400">Se încarcă profil...</p>
      </div>
    );
  }

  const profile = profileQuery.data as any;
  const { client = {}, rides = [], ratingsReceived = [], avgRating = 0, totalRatings = 0, completedRides = 0 } = profile || {};

  // Create a map of ratings by ride ID for quick lookup
  const ratingsByRideId = new Map();
  (ratingsReceived as any[]).forEach((item) => {
    if (item.ride && item.ride.id) {
      ratingsByRideId.set(item.ride.id, item);
    }
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Profil Client</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Client Info */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informații Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">{client.phone}</span>
            </div>
            {client.name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{client.name}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-700 grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Total Curse</p>
                <p className="text-xl font-bold text-white">{rides.length}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Curse Finalizate</p>
                <p className="text-xl font-bold text-green-400">{completedRides}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Rating Mediu</p>
                <p className="text-xl font-bold text-yellow-400">{avgRating.toFixed(1)}/5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ride History with Inline Ratings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Istoric Curse ({rides.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rides && rides.length > 0 ? (
              (rides as any[]).map((item, idx) => {
                const rideRating = ratingsByRideId.get(item.ride.id);
                return (
                  <div
                    key={idx}
                    className="border border-gray-700 rounded-lg p-4 bg-gray-900"
                  >
                    {/* Ride Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-white font-medium">Cursa #{item.ride.id}</p>
                        <p className="text-gray-400 text-sm">
                          {new Date(item.ride.createdAt).toLocaleDateString("ro-RO")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${
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

                    {/* Driver Info */}
                    {item.driver && (
                      <p className="text-gray-400 text-sm mb-2">
                        Șofer: <span className="text-white">{item.driver.name}</span>
                      </p>
                    )}

                    {/* Address */}
                    {item.ride.clientAddress && (
                      <div className="flex gap-2 text-gray-400 text-sm mb-2">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{item.ride.clientAddress}</span>
                      </div>
                    )}

                    {/* Completion Time */}
                    {item.ride.completedAt && (
                      <p className="text-gray-400 text-xs mb-3">
                        Finalizată: {new Date(item.ride.completedAt).toLocaleString("ro-RO")}
                      </p>
                    )}

                    {/* Inline Rating if exists */}
                    {rideRating && rideRating.rating && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="bg-gray-800 rounded p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`text-lg ${
                                    star <= rideRating.rating.rating
                                      ? "text-yellow-400"
                                      : "text-gray-600"
                                  }`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-gray-400 text-xs">
                              {new Date(rideRating.rating.createdAt).toLocaleDateString("ro-RO")}
                            </span>
                          </div>
                          {rideRating.driver && (
                            <p className="text-gray-400 text-sm mb-1">
                              Evaluare de la: <span className="text-white font-medium">{rideRating.driver.name}</span>
                            </p>
                          )}
                          {rideRating.rating.comment && (
                            <p className="text-gray-300 text-sm italic">
                              "{rideRating.rating.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-gray-400 text-center py-4">Nicio cursă disponibilă</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
