import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dispatcher from "./pages/Dispatcher";
import ClientApp from "./pages/ClientApp";
import DriverApp from "./pages/DriverApp";

function Router() {
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
