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

function Router() {
  const [location, navigate] = useLocation();

  // Redirect to installed app on first load or when accessing home page
  useEffect(() => {
    const installedApp = localStorage.getItem("installedApp");
    
    // If on home page and an app is installed, redirect to it
    if (location === "/" && installedApp) {
      if (installedApp === "client") {
        navigate("/client");
      } else if (installedApp === "driver") {
        navigate("/driver");
      } else if (installedApp === "dispatcher") {
        navigate("/dispatcher");
      }
    }
    
    // Log when PWA app is launched via start_url
    if (location === "/client" && installedApp === "client") {
      console.log("PWA Client app launched correctly");
    } else if (location === "/driver" && installedApp === "driver") {
      console.log("PWA Driver app launched correctly");
    } else if (location === "/dispatcher" && installedApp === "dispatcher") {
      console.log("PWA Dispatcher app launched correctly");
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
