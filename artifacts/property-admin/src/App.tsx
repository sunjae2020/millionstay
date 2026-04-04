import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import SuburbList from "@/pages/property/SuburbList";
import SuburbDetail from "@/pages/property/SuburbDetail";
import PropertyList from "@/pages/property/PropertyList";
import PropertyDetail from "@/pages/property/PropertyDetail";
import SpaceOptionList from "@/pages/property/SpaceOptionList";
import SpaceOptionDetail from "@/pages/property/SpaceOptionDetail";
import SpacePolicyList from "@/pages/property/SpacePolicyList";
import SpacePolicyDetail from "@/pages/property/SpacePolicyDetail";
import SpaceList from "@/pages/property/SpaceList";
import SpaceDetail from "@/pages/property/SpaceDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />

      {/* Suburbs */}
      <Route path="/property/suburbs" component={SuburbList} />
      <Route path="/property/suburbs/new" component={SuburbDetail} />
      <Route path="/property/suburbs/:id" component={SuburbDetail} />

      {/* Properties */}
      <Route path="/property/properties" component={PropertyList} />
      <Route path="/property/properties/new" component={PropertyDetail} />
      <Route path="/property/properties/:id" component={PropertyDetail} />

      {/* Space Options */}
      <Route path="/property/space-options" component={SpaceOptionList} />
      <Route path="/property/space-options/new" component={SpaceOptionDetail} />
      <Route path="/property/space-options/:id" component={SpaceOptionDetail} />

      {/* Space Policies */}
      <Route path="/property/space-policies" component={SpacePolicyList} />
      <Route path="/property/space-policies/new" component={SpacePolicyDetail} />
      <Route path="/property/space-policies/:id" component={SpacePolicyDetail} />

      {/* Spaces */}
      <Route path="/property/spaces" component={SpaceList} />
      <Route path="/property/spaces/new" component={SpaceDetail} />
      <Route path="/property/spaces/:id" component={SpaceDetail} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
