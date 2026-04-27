import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dispatcher from "./pages/Dispatcher";
import ClientApp from "./pages/ClientApp";
import DriverApp from "./pages/DriverApp";
import { useEffect } from "react";

// Helper function to detect subdomain
function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  
  // Check if it's a subdomain (not localhost or IP)
  if (parts.length > 2 && !hostname.includes("localhost")) {
    const subdomain = parts[0];
    if (["client", "driver", "dispatcher"].includes(subdomain)) {
      return subdomain;
    }
  }
  
  return null;
}

function Router() {
  const [location, navigate] = useLocation();

  // Redirect based on subdomain or installed app
  useEffect(() => {
    const subdomain = getSubdomain();
    const installedApp = localStorage.getItem("installedApp");
    
    // Priority 1: If on a subdomain, redirect to that app's route
    if (subdomain && location === "/") {
      console.log(`Subdomain detected: ${subdomain}, redirecting to /${subdomain}`);
      navigate(`/${subdomain}`);
      localStorage.setItem("installedApp", subdomain);
      return;
    }
    
    // Priority 2: If on home page and an app is installed, redirect to it
    if (location === "/" && installedApp) {
      console.log(`Installed app detected: ${installedApp}, redirecting to /${installedApp}`);
      if (installedApp === "client") {
        navigate("/client");
      } else if (installedApp === "driver") {
        navigate("/driver");
      } else if (installedApp === "dispatcher") {
        navigate("/dispatcher");
      }
      return;
    }
    
    // Log when app is launched via subdomain or PWA
    if (location === "/client" && (subdomain === "client" || installedApp === "client")) {
      console.log("Client app launched");
    } else if (location === "/driver" && (subdomain === "driver" || installedApp === "driver")) {
      console.log("Driver app launched");
    } else if (location === "/dispatcher" && (subdomain === "dispatcher" || installedApp === "dispatcher")) {
      console.log("Dispatcher app launched");
    }
  }, [location, navigate]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dispatcher" component={Dispatcher} />
      <Route path="/client" component={ClientApp} />
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
