import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initTheme } from "@/lib/theme";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "@/pages/Login";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import { ComingSoonPage } from "@/pages/ComingSoon";

// Property
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
import BulkPhotoUpload from "@/pages/property/BulkPhotoUpload";
import BulkPhotoUploadList from "@/pages/property/BulkPhotoUploadList";

// Account (was CRM + Sales)
import ContactList from "@/pages/crm/ContactList";
import ContactDetail from "@/pages/crm/ContactDetail";
import AccountList from "@/pages/crm/AccountList";
import AccountDetail from "@/pages/crm/AccountDetail";
import TaskList from "@/pages/sales/TaskList";
import TaskDetail from "@/pages/sales/TaskDetail";
import LeadList from "@/pages/sales/LeadList";
import LeadDetail from "@/pages/sales/LeadDetail";

// Booking
import ServiceHostList from "@/pages/booking/ServiceHostList";
import ServiceHostDetail from "@/pages/booking/ServiceHostDetail";
import BookingList from "@/pages/booking/BookingList";
import BookingDetail from "@/pages/booking/BookingDetail";
import ContractList from "@/pages/contracts/ContractList";
import ContractDetail from "@/pages/contracts/ContractDetail";
import ContractProductList from "@/pages/products/ContractProductList";
import ContractProductDetail from "@/pages/products/ContractProductDetail";
import ProductList from "@/pages/products/ProductList";
import ProductDetail from "@/pages/products/ProductDetail";
import PromotionList from "@/pages/products/PromotionList";
import PromotionDetail from "@/pages/products/PromotionDetail";
import BeneficiaryList from "@/pages/products/BeneficiaryList";
import BeneficiaryDetail from "@/pages/products/BeneficiaryDetail";
import ServiceList from "@/pages/services/ServiceList";
import ServiceDetail from "@/pages/services/ServiceDetail";

// Finance
import InvoiceList from "@/pages/finance/InvoiceList";
import InvoiceDetail from "@/pages/finance/InvoiceDetail";
import ReceiptList from "@/pages/finance/ReceiptList";
import RecurringScheduleList from "@/pages/finance/RecurringScheduleList";
import CommissionList from "@/pages/crm/CommissionList";
import CommissionDetail from "@/pages/crm/CommissionDetail";

// Maintenance (kept for legacy, not in sidebar)
import WorkOrderList from "@/pages/maintenance/WorkOrderList";
import WorkOrderDetail from "@/pages/maintenance/WorkOrderDetail";

// Settings
import Settings from "@/pages/settings/Settings";
import OrganisationPage from "@/pages/settings/sub/Organisation";
import UsersPage from "@/pages/settings/sub/Users";
import EmailTemplatesPage from "@/pages/settings/sub/EmailTemplates";
import DesignPage from "@/pages/settings/sub/Design";
import ContractTypesPage from "@/pages/settings/sub/ContractTypes";
import ProductGroupsPage from "@/pages/settings/sub/ProductGroups";
import ProductTypesPage from "@/pages/settings/sub/ProductTypes";
import BookingReportPage from "@/pages/settings/sub/BookingReport";
import IntegrationsPage from "@/pages/settings/sub/Integrations";
import PaymentInfoList from "@/pages/crm/PaymentInfoList";
import PaymentInfoDetail from "@/pages/crm/PaymentInfoDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && location !== "/login") {
    return <Redirect to="/login" />;
  }

  if (user && location === "/login") {
    return <Redirect to="/dashboard" />;
  }

  return <Router />;
}

function Router() {
  return (
    <Switch>
      {/* ── Auth ───────────────────────────────────────── */}
      <Route path="/login" component={LoginPage} />

      {/* ── Dashboard ──────────────────────────────────── */}
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />

      {/* ── ACCOUNT ───────────────────────────────────── */}
      <Route path="/account/contacts" component={ContactList} />
      <Route path="/account/contacts/new" component={ContactDetail} />
      <Route path="/account/contacts/:id" component={ContactDetail} />

      <Route path="/account/accounts" component={AccountList} />
      <Route path="/account/accounts/new" component={AccountDetail} />
      <Route path="/account/accounts/:id" component={AccountDetail} />

      <Route path="/account/leads" component={LeadList} />
      <Route path="/account/leads/new" component={LeadDetail} />
      <Route path="/account/leads/:id" component={LeadDetail} />

      <Route path="/account/tasks" component={TaskList} />
      <Route path="/account/tasks/new" component={TaskDetail} />
      <Route path="/account/tasks/:id" component={TaskDetail} />

      {/* ── PROPERTY ──────────────────────────────────── */}
      <Route path="/property/properties" component={PropertyList} />
      <Route path="/property/properties/new" component={PropertyDetail} />
      <Route path="/property/properties/:id" component={PropertyDetail} />

      <Route path="/property/spaces" component={SpaceList} />
      <Route path="/property/spaces/new" component={SpaceDetail} />
      <Route path="/property/spaces/:id" component={SpaceDetail} />

      <Route path="/property/bulk-photo-upload" component={BulkPhotoUploadList} />
      <Route path="/property/bulk-photo-upload/new" component={BulkPhotoUpload} />

      <Route path="/property/space-options" component={SpaceOptionList} />
      <Route path="/property/space-options/new" component={SpaceOptionDetail} />
      <Route path="/property/space-options/:id" component={SpaceOptionDetail} />

      <Route path="/property/space-policies" component={SpacePolicyList} />
      <Route path="/property/space-policies/new" component={SpacePolicyDetail} />
      <Route path="/property/space-policies/:id" component={SpacePolicyDetail} />

      {/* ── BOOKING ───────────────────────────────────── */}
      <Route path="/booking/bookings" component={BookingList} />
      <Route path="/booking/bookings/new" component={BookingDetail} />
      <Route path="/booking/bookings/:id" component={BookingDetail} />

      <Route path="/booking/contracts" component={ContractList} />
      <Route path="/booking/contracts/new" component={ContractDetail} />
      <Route path="/booking/contracts/:id" component={ContractDetail} />

      <Route path="/booking/contract-products" component={ContractProductList} />
      <Route path="/booking/contract-products/new" component={ContractProductDetail} />
      <Route path="/booking/contract-products/:id" component={ContractProductDetail} />

      <Route path="/booking/service-hosts" component={ServiceHostList} />
      <Route path="/booking/service-hosts/new" component={ServiceHostDetail} />
      <Route path="/booking/service-hosts/:id" component={ServiceHostDetail} />

      {/* ── PRODUCTS ──────────────────────────────────── */}
      <Route path="/products/products/new" component={ProductDetail} />
      <Route path="/products/products/:id" component={ProductDetail} />
      <Route path="/products/products" component={ProductList} />
      <Route path="/products/promotions" component={PromotionList} />
      <Route path="/products/promotions/new" component={PromotionDetail} />
      <Route path="/products/promotions/:id" component={PromotionDetail} />
      <Route path="/products/beneficiaries" component={BeneficiaryList} />
      <Route path="/products/beneficiaries/new" component={BeneficiaryDetail} />
      <Route path="/products/beneficiaries/:id" component={BeneficiaryDetail} />

      <Route path="/services" component={ServiceList} />
      <Route path="/services/new" component={ServiceDetail} />
      <Route path="/services/:id" component={ServiceDetail} />

      {/* ── FINANCE ───────────────────────────────────── */}
      <Route path="/finance/invoices" component={InvoiceList} />
      <Route path="/finance/invoices/new" component={InvoiceDetail} />
      <Route path="/finance/invoices/:id" component={InvoiceDetail} />

      <Route path="/finance/transactions">
        {() => <ComingSoonPage title="Transactions" subtitle="View all financial transactions" />}
      </Route>
      <Route path="/finance/receipts" component={ReceiptList} />

      <Route path="/finance/commissions" component={CommissionList} />
      <Route path="/finance/commissions/new" component={CommissionDetail} />
      <Route path="/finance/commissions/:id" component={CommissionDetail} />

      <Route path="/finance/recurring" component={RecurringScheduleList} />

      {/* ── SETTINGS HUB ──────────────────────────────── */}
      <Route path="/settings" component={Settings} />

      <Route path="/settings/organisation" component={OrganisationPage} />
      <Route path="/settings/users" component={UsersPage} />
      <Route path="/settings/email-templates" component={EmailTemplatesPage} />
      <Route path="/settings/design" component={DesignPage} />
      <Route path="/settings/integrations" component={IntegrationsPage} />

      <Route path="/settings/contract-types" component={ContractTypesPage} />
      <Route path="/settings/product-groups" component={ProductGroupsPage} />
      <Route path="/settings/product-types" component={ProductTypesPage} />

      <Route path="/settings/payment-info" component={PaymentInfoList} />
      <Route path="/settings/payment-info/new" component={PaymentInfoDetail} />
      <Route path="/settings/payment-info/:id" component={PaymentInfoDetail} />

      <Route path="/settings/cost-center">
        {() => <ComingSoonPage title="Cost Center" subtitle="Cost centre configuration" />}
      </Route>

      <Route path="/settings/suburbs" component={SuburbList} />
      <Route path="/settings/suburbs/new" component={SuburbDetail} />
      <Route path="/settings/suburbs/:id" component={SuburbDetail} />

      <Route path="/settings/system-log">
        {() => <ComingSoonPage title="System Log" subtitle="Audit trail of system events" />}
      </Route>

      <Route path="/settings/reports/bookings" component={BookingReportPage} />
      <Route path="/settings/reports/revenue">
        {() => <ComingSoonPage title="Revenue Report" subtitle="Revenue breakdown and trends" />}
      </Route>
      <Route path="/settings/reports/occupancy">
        {() => <ComingSoonPage title="Occupancy Report" subtitle="Space occupancy over time" />}
      </Route>

      {/* ── MAINTENANCE (legacy, not in sidebar) ─────── */}
      <Route path="/maintenance/work-orders" component={WorkOrderList} />
      <Route path="/maintenance/work-orders/new" component={WorkOrderDetail} />
      <Route path="/maintenance/work-orders/:id" component={WorkOrderDetail} />

      {/* ── REDIRECTS — old paths → new paths ─────────── */}
      <Route path="/crm/contacts">
        {() => <Redirect to="/account/contacts" />}
      </Route>
      <Route path="/crm/contacts/:id">
        {(params) => <Redirect to={`/account/contacts/${params.id}`} />}
      </Route>
      <Route path="/crm/accounts">
        {() => <Redirect to="/account/accounts" />}
      </Route>
      <Route path="/crm/accounts/:id">
        {(params) => <Redirect to={`/account/accounts/${params.id}`} />}
      </Route>
      <Route path="/crm/commissions">
        {() => <Redirect to="/finance/commissions" />}
      </Route>
      <Route path="/crm/commissions/:id">
        {(params) => <Redirect to={`/finance/commissions/${params.id}`} />}
      </Route>
      <Route path="/crm/payment-info">
        {() => <Redirect to="/settings/payment-info" />}
      </Route>
      <Route path="/crm/payment-info/:id">
        {(params) => <Redirect to={`/settings/payment-info/${params.id}`} />}
      </Route>
      <Route path="/sales/tasks">
        {() => <Redirect to="/account/tasks" />}
      </Route>
      <Route path="/sales/tasks/:id">
        {(params) => <Redirect to={`/account/tasks/${params.id}`} />}
      </Route>
      <Route path="/sales/leads">
        {() => <Redirect to="/account/leads" />}
      </Route>
      <Route path="/sales/leads/:id">
        {(params) => <Redirect to={`/account/leads/${params.id}`} />}
      </Route>
      <Route path="/contracts/contracts">
        {() => <Redirect to="/booking/contracts" />}
      </Route>
      <Route path="/contracts/contracts/:id">
        {(params) => <Redirect to={`/booking/contracts/${params.id}`} />}
      </Route>
      <Route path="/products/contract-products">
        {() => <Redirect to="/booking/contract-products" />}
      </Route>
      <Route path="/products/contract-products/:id">
        {(params) => <Redirect to={`/booking/contract-products/${params.id}`} />}
      </Route>
      <Route path="/property/suburbs">
        {() => <Redirect to="/settings/suburbs" />}
      </Route>
      <Route path="/property/suburbs/:id">
        {(params) => <Redirect to={`/settings/suburbs/${params.id}`} />}
      </Route>
      <Route path="/maintenance/organisation">
        {() => <Redirect to="/settings/organisation" />}
      </Route>
      <Route path="/maintenance/users">
        {() => <Redirect to="/settings/users" />}
      </Route>
      <Route path="/maintenance/system-log">
        {() => <Redirect to="/settings/system-log" />}
      </Route>
      <Route path="/finance/payment-info">
        {() => <Redirect to="/settings/payment-info" />}
      </Route>
      <Route path="/finance/cost-centers">
        {() => <Redirect to="/settings/cost-center" />}
      </Route>
      <Route path="/contracts/contract-types">
        {() => <Redirect to="/settings/contract-types" />}
      </Route>
      <Route path="/contracts/beneficiaries">
        {() => <Redirect to="/products/beneficiaries" />}
      </Route>
      <Route path="/reports/bookings">
        {() => <Redirect to="/settings/reports/bookings" />}
      </Route>
      <Route path="/reports/revenue">
        {() => <Redirect to="/settings/reports/revenue" />}
      </Route>
      <Route path="/reports/occupancy">
        {() => <Redirect to="/settings/reports/occupancy" />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedRouter />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
