import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/lib/user-context";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Intro from "@/pages/intro";
import SignIn from "@/pages/sign-in";
import Home from "@/pages/home";
import MoodPage from "@/pages/mood";
import PeriodPage from "@/pages/period";
import PartnerPage from "@/pages/partner";
import WishlistPage from "@/pages/wishlist";
import MilestonesPage from "@/pages/milestones";
import TravelPage from "@/pages/travel";
import OutfitPage from "@/pages/outfit";
import RemindersPage from "@/pages/reminders";
import HealthPage from "@/pages/health";
import QuotesPage from "@/pages/quotes";
import SupportPage from "@/pages/support";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading, hasSeenIntro } = useUser();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-primary font-serif text-2xl animate-pulse">ROSA</div>
      </div>
    );
  }

  if (!hasSeenIntro) return <Redirect to="/intro" />;
  if (!user) return <Redirect to="/sign-in" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  const { user } = useUser();

  return (
    <Switch>
      <Route path="/intro" component={Intro} />
      <Route path="/sign-in" component={SignIn} />

      <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/mood">{() => <ProtectedRoute component={MoodPage} />}</Route>
      <Route path="/period">{() => <ProtectedRoute component={PeriodPage} />}</Route>
      <Route path="/partner">{() => <ProtectedRoute component={PartnerPage} />}</Route>
      <Route path="/wishlist">{() => <ProtectedRoute component={WishlistPage} />}</Route>
      <Route path="/milestones">{() => <ProtectedRoute component={MilestonesPage} />}</Route>
      <Route path="/travel">{() => <ProtectedRoute component={TravelPage} />}</Route>
      <Route path="/outfit">{() => <ProtectedRoute component={OutfitPage} />}</Route>
      <Route path="/reminders">{() => <ProtectedRoute component={RemindersPage} />}</Route>
      <Route path="/health">{() => <ProtectedRoute component={HealthPage} />}</Route>
      <Route path="/quotes">{() => <ProtectedRoute component={QuotesPage} />}</Route>
      <Route path="/support">{() => <ProtectedRoute component={SupportPage} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={SettingsPage} />}</Route>

      <Route>
        {user ? (
          <AppLayout>
            <NotFound />
          </AppLayout>
        ) : (
          <NotFound />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
