import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortalLayout from "@/components/PortalLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import SpaceDetail from "@/pages/SpaceDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Bookings from "@/pages/portal/Bookings";
import BookingDetail from "@/pages/portal/BookingDetail";
import Invoices from "@/pages/portal/Invoices";
import Profile from "@/pages/portal/Profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/spaces/:id" component={SpaceDetail} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />

          {/* Protected portal routes */}
          <Route path="/portal/bookings">
            <ProtectedRoute>
              <PortalLayout>
                <Bookings />
              </PortalLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/portal/bookings/:id">
            {(params) => (
              <ProtectedRoute>
                <PortalLayout>
                  <BookingDetail />
                </PortalLayout>
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/portal/invoices">
            <ProtectedRoute>
              <PortalLayout>
                <Invoices />
              </PortalLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/portal/profile">
            <ProtectedRoute>
              <PortalLayout>
                <Profile />
              </PortalLayout>
            </ProtectedRoute>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
