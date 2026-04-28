import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dispatcher from "./pages/Dispatcher";
import ClientApp from "./pages/ClientApp";
import DriverApp from "./pages/DriverApp";
import { useEffect, useState } from "react";

// Helper function to detect subdomain
function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  
  // Save hostname to localStorage for debugging on mobile
  try {
    localStorage.setItem("debugHostname", hostname);
    localStorage.setItem("debugHostnameParts", JSON.stringify(parts));
    localStorage.setItem("debugTimestamp", new Date().toISOString());
  } catch (e) {
    console.error("Failed to save debug info:", e);
  }
  
  console.log("[getSubdomain] hostname:", hostname);
  console.log("[getSubdomain] parts:", parts);
  console.log("[getSubdomain] parts.length:", parts.length);
  
  // Check if it's a subdomain (not localhost or IP)
  if (parts.length > 2 && !hostname.includes("localhost")) {
    const subdomain = parts[0];
    console.log("[getSubdomain] subdomain candidate:", subdomain);
    if (["client", "driver", "dispatcher"].includes(subdomain)) {
      console.log("[getSubdomain] valid subdomain found:", subdomain);
      return subdomain;
    }
  }
  
  console.log("[getSubdomain] no valid subdomain detected");
  return null;
}

function Router() {
  const [location, navigate] = useLocation();
  const [redirected, setRedirected] = useState(false);

  // Redirect based on subdomain or installed app - runs immediately on mount
  useEffect(() => {
    // Only redirect once to prevent loops
    if (redirected) return;

    const subdomain = getSubdomain();
    const installedApp = localStorage.getItem("installedApp");
    const debugHostname = localStorage.getItem("debugHostname");
    
    // Log debug info
    console.log("[Router] Hostname:", debugHostname);
    console.log("[Router] Detected subdomain:", subdomain);
    console.log("[Router] Current location:", location);
    console.log("[Router] Installed app:", installedApp);
    
    // Priority 1: If on a subdomain, redirect to that app's route
    if (subdomain && location === "/") {
      console.log(`[Router] Subdomain detected: ${subdomain}, redirecting to /${subdomain}`);
      navigate(`/${subdomain}`);
      localStorage.setItem("installedApp", subdomain);
      setRedirected(true);
      return;
    }
    
    // Priority 2: If on home page and an app is installed, redirect to it
    if (location === "/" && installedApp && !subdomain) {
      console.log(`[Router] Installed app detected: ${installedApp}, redirecting to /${installedApp}`);
      if (installedApp === "client") {
        navigate("/client");
      } else if (installedApp === "driver") {
        navigate("/driver");
      } else if (installedApp === "dispatcher") {
        navigate("/dispatcher");
      }
      setRedirected(true);
      return;
    }
    
    // Log when app is launched via subdomain or PWA
    if (location === "/client" && (subdomain === "client" || installedApp === "client")) {
      console.log("[Router] Client app launched");
    } else if (location === "/driver" && (subdomain === "driver" || installedApp === "driver")) {
      console.log("[Router] Driver app launched");
    } else if (location === "/dispatcher" && (subdomain === "dispatcher" || installedApp === "dispatcher")) {
      console.log("[Router] Dispatcher app launched");
    }
  }, [location, navigate, redirected]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dispatcher" component={Dispatcher} />
      <Route path="/driver" component={DriverApp} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
