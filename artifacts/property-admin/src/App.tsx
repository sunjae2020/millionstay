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
import CommissionList from "@/pages/crm/CommissionList";
import CommissionDetail from "@/pages/crm/CommissionDetail";
import PaymentInfoList from "@/pages/crm/PaymentInfoList";
import PaymentInfoDetail from "@/pages/crm/PaymentInfoDetail";
import ContactList from "@/pages/crm/ContactList";
import ContactDetail from "@/pages/crm/ContactDetail";
import AccountList from "@/pages/crm/AccountList";
import AccountDetail from "@/pages/crm/AccountDetail";
import TaskList from "@/pages/sales/TaskList";
import TaskDetail from "@/pages/sales/TaskDetail";
import LeadList from "@/pages/sales/LeadList";
import LeadDetail from "@/pages/sales/LeadDetail";
import ServiceHostList from "@/pages/booking/ServiceHostList";
import ServiceHostDetail from "@/pages/booking/ServiceHostDetail";
import BookingList from "@/pages/booking/BookingList";
import BookingDetail from "@/pages/booking/BookingDetail";
import ContractProductList from "@/pages/products/ContractProductList";
import ContractProductDetail from "@/pages/products/ContractProductDetail";
import ContractList from "@/pages/contracts/ContractList";
import ContractDetail from "@/pages/contracts/ContractDetail";
import InvoiceList from "@/pages/finance/InvoiceList";
import InvoiceDetail from "@/pages/finance/InvoiceDetail";
import WorkOrderList from "@/pages/maintenance/WorkOrderList";
import WorkOrderDetail from "@/pages/maintenance/WorkOrderDetail";

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

      {/* CRM - Commissions */}
      <Route path="/crm/commissions" component={CommissionList} />
      <Route path="/crm/commissions/new" component={CommissionDetail} />
      <Route path="/crm/commissions/:id" component={CommissionDetail} />

      {/* CRM - Payment Info */}
      <Route path="/crm/payment-info" component={PaymentInfoList} />
      <Route path="/crm/payment-info/new" component={PaymentInfoDetail} />
      <Route path="/crm/payment-info/:id" component={PaymentInfoDetail} />

      {/* CRM - Contacts */}
      <Route path="/crm/contacts" component={ContactList} />
      <Route path="/crm/contacts/new" component={ContactDetail} />
      <Route path="/crm/contacts/:id" component={ContactDetail} />

      {/* CRM - Accounts */}
      <Route path="/crm/accounts" component={AccountList} />
      <Route path="/crm/accounts/new" component={AccountDetail} />
      <Route path="/crm/accounts/:id" component={AccountDetail} />

      {/* Sales - Tasks */}
      <Route path="/sales/tasks" component={TaskList} />
      <Route path="/sales/tasks/new" component={TaskDetail} />
      <Route path="/sales/tasks/:id" component={TaskDetail} />

      {/* Sales - Leads */}
      <Route path="/sales/leads" component={LeadList} />
      <Route path="/sales/leads/new" component={LeadDetail} />
      <Route path="/sales/leads/:id" component={LeadDetail} />

      {/* Booking - Service Hosts */}
      <Route path="/booking/service-hosts" component={ServiceHostList} />
      <Route path="/booking/service-hosts/new" component={ServiceHostDetail} />
      <Route path="/booking/service-hosts/:id" component={ServiceHostDetail} />

      {/* Booking - Bookings */}
      <Route path="/booking/bookings" component={BookingList} />
      <Route path="/booking/bookings/new" component={BookingDetail} />
      <Route path="/booking/bookings/:id" component={BookingDetail} />

      {/* Products */}
      <Route path="/products/contract-products" component={ContractProductList} />
      <Route path="/products/contract-products/new" component={ContractProductDetail} />
      <Route path="/products/contract-products/:id" component={ContractProductDetail} />

      {/* Contracts */}
      <Route path="/contracts/contracts" component={ContractList} />
      <Route path="/contracts/contracts/new" component={ContractDetail} />
      <Route path="/contracts/contracts/:id" component={ContractDetail} />

      {/* Finance */}
      <Route path="/finance/invoices" component={InvoiceList} />
      <Route path="/finance/invoices/new" component={InvoiceDetail} />
      <Route path="/finance/invoices/:id" component={InvoiceDetail} />
      <Route path="/maintenance/work-orders" component={WorkOrderList} />
      <Route path="/maintenance/work-orders/new" component={WorkOrderDetail} />
      <Route path="/maintenance/work-orders/:id" component={WorkOrderDetail} />

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
