import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Users, Radio, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallApp = async (appName: string) => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  const apps = [
    {
      name: "Dispatcher",
      icon: Radio,
      color: "yellow",
      borderColor: "border-yellow-800 hover:border-yellow-500",
      shadowColor: "hover:shadow-yellow-900/30",
      bgColor: "bg-yellow-500",
      buttonColor: "bg-yellow-500 hover:bg-yellow-600",
      textColor: "text-black",
      path: "/dispatcher",
      description: "Gestionează curse, șoferi și asignează în timp real",
    },
    {
      name: "Client",
      icon: Users,
      color: "blue",
      borderColor: "border-blue-800 hover:border-blue-500",
      shadowColor: "hover:shadow-blue-900/30",
      bgColor: "bg-blue-600",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      textColor: "text-white",
      path: "/client",
      description: "Cheamă taxi cu un click și urmărește șoferul live",
    },
    {
      name: "Șofer",
      icon: Car,
      color: "green",
      borderColor: "border-green-800 hover:border-green-500",
      shadowColor: "hover:shadow-green-900/30",
      bgColor: "bg-green-600",
      buttonColor: "bg-green-600 hover:bg-green-700",
      textColor: "text-white",
      path: "/driver",
      description: "Acceptă curse și navighează la client cu GPS live",
    },
  ];

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {apps.map((app) => {
          const IconComponent = app.icon;
          return (
            <Card
              key={app.name}
              className={`bg-gray-900 ${app.borderColor} cursor-pointer transition-all hover:scale-105 hover:shadow-2xl ${app.shadowColor}`}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className={`w-16 h-16 ${app.bgColor} rounded-2xl flex items-center justify-center`}>
                  <IconComponent className={`w-8 h-8 ${app.textColor}`} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl mb-1">{app.name}</h2>
                  <p className="text-gray-400 text-sm">{app.description}</p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    onClick={() => navigate(app.path)}
                    className={`w-full ${app.buttonColor} ${app.textColor} font-bold`}
                  >
                    Deschide
                  </Button>
                  {canInstall && (
                    <Button
                      onClick={() => handleInstallApp(app.name)}
                      variant="outline"
                      className="w-full border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Instalează
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl text-center">
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
