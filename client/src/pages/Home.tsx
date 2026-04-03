import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Users, Radio } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-6">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-7xl mb-4">🚖</div>
        <h1 className="text-4xl font-bold text-white mb-3">Sistem Taxi</h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Platformă completă de gestionare taxi cu tracking în timp real
        </p>
      </div>

      {/* App Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {/* Dispatcher */}
        <Card
          className="bg-gray-900 border-yellow-800 hover:border-yellow-500 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-yellow-900/30"
          onClick={() => navigate("/dispatcher")}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center">
              <Radio className="w-8 h-8 text-black" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-1">Dispatcher</h2>
              <p className="text-gray-400 text-sm">
                Gestionează curse, șoferi și asignează în timp real
              </p>
            </div>
            <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
              Deschide
            </Button>
          </CardContent>
        </Card>

        {/* Client */}
        <Card
          className="bg-gray-900 border-blue-800 hover:border-blue-500 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-900/30"
          onClick={() => navigate("/client")}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-1">Client</h2>
              <p className="text-gray-400 text-sm">
                Cheamă taxi cu un click și urmărește șoferul live
              </p>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Deschide
            </Button>
          </CardContent>
        </Card>

        {/* Driver */}
        <Card
          className="bg-gray-900 border-green-800 hover:border-green-500 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-green-900/30"
          onClick={() => navigate("/driver")}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center">
              <Car className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-1">Șofer</h2>
              <p className="text-gray-400 text-sm">
                Acceptă curse și navighează la client cu GPS live
              </p>
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold">
              Deschide
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl text-center">
        {[
          { icon: "📍", label: "GPS în timp real" },
          { icon: "🗺️", label: "Google Maps" },
          { icon: "⚡", label: "WebSocket live" },
          { icon: "🔵", label: "Rută albastră" },
        ].map((f) => (
          <div key={f.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-gray-400 text-xs">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
