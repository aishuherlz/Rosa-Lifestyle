import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/lib/user-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { GardenProvider } from "@/lib/garden-context";
import { NightModeProvider } from "@/lib/night-mode-context";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/landing";
import Intro from "@/pages/intro";
import SignIn from "@/pages/sign-in";
import Home from "@/pages/home";
import MaleDashboard from "@/pages/male-dashboard";
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
import SubscriptionPage from "@/pages/subscription";
import FoodPlannerPage from "@/pages/food-planner";
import SurveysPage from "@/pages/surveys";
import JournalPage from "@/pages/journal";
import GoalsPage from "@/pages/goals";
import ChallengesPage from "@/pages/challenges";
import SkinPage from "@/pages/skin";
import LettersPage from "@/pages/letters";
import CirclesPage from "@/pages/circles";
import FriendsPage from "@/pages/friends";
import HealthSyncPage from "@/pages/health-sync";
import ReportPage from "@/pages/report";
import SanctuaryPage from "@/pages/sanctuary";
import WisdomPage from "@/pages/wisdom";
import AffirmationPage from "@/pages/affirmation";
import SOSPage from "@/pages/sos";
import RoseWallPage from "@/pages/rose-wall";
import RoseQuizPage from "@/pages/rose-quiz";
import SleepPage from "@/pages/sleep";

const queryClient = new QueryClient();

// Centralised isMale helper — single source of truth used throughout the app
export function getIsMale(gender?: string | null): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === "male" || g === "man";
}

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

// Extracted named component — avoids creating new function reference on every render
function HomeRoute() {
  const { user } = useUser();
  if (!user) return <Redirect to="/sign-in" />;
  // Guests or users without gender info → generic home
  if (!user.gender || user.gender === "unspecified") return <Home />;
  // Male users → dedicated male dashboard
  if (getIsMale(user.gender)) return <MaleDashboard />;
  return <Home />;
}

// Rose Wall is women-only — male users are redirected
function RoseWallRoute() {
  const { user } = useUser();
  if (user && getIsMale(user.gender)) return <Redirect to="/" />;
  return <RoseWallPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={Landing} />
      <Route path="/intro" component={Intro} />
      <Route path="/sign-in" component={SignIn} />

      <Route path="/">
        {() => (
          <ProtectedRoute component={HomeRoute} />
        )}
      </Route>
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
      <Route path="/subscription">{() => <ProtectedRoute component={SubscriptionPage} />}</Route>
      <Route path="/food">{() => <ProtectedRoute component={FoodPlannerPage} />}</Route>
      <Route path="/surveys">{() => <ProtectedRoute component={SurveysPage} />}</Route>
      <Route path="/journal">{() => <ProtectedRoute component={JournalPage} />}</Route>
      <Route path="/goals">{() => <ProtectedRoute component={GoalsPage} />}</Route>
      <Route path="/challenges">{() => <ProtectedRoute component={ChallengesPage} />}</Route>
      <Route path="/skin">{() => <ProtectedRoute component={SkinPage} />}</Route>
      <Route path="/letters">{() => <ProtectedRoute component={LettersPage} />}</Route>
      <Route path="/circles">{() => <ProtectedRoute component={CirclesPage} />}</Route>
      <Route path="/friends">{() => <ProtectedRoute component={FriendsPage} />}</Route>
      <Route path="/health-sync">{() => <ProtectedRoute component={HealthSyncPage} />}</Route>
      <Route path="/report">{() => <ProtectedRoute component={ReportPage} />}</Route>
      <Route path="/sanctuary">{() => <ProtectedRoute component={SanctuaryPage} />}</Route>
      <Route path="/wisdom">{() => <ProtectedRoute component={WisdomPage} />}</Route>
      <Route path="/affirmation">{() => <ProtectedRoute component={AffirmationPage} />}</Route>
      <Route path="/sos">{() => <ProtectedRoute component={SOSPage} />}</Route>
      <Route path="/rose-wall">{() => <ProtectedRoute component={RoseWallRoute} />}</Route>
      <Route path="/rose-quiz">{() => <ProtectedRoute component={RoseQuizPage} />}</Route>
      <Route path="/sleep">{() => <ProtectedRoute component={SleepPage} />}</Route>

      <Route>
        {() => {
          const { user } = useUser();
          return user ? (
            <AppLayout>
              <NotFound />
            </AppLayout>
          ) : (
            <NotFound />
          );
        }}
      </Route>
    </Switch>
  );
}

import { scopedStorage } from "@/lib/scoped-storage";

function App() {
  useEffect(() => {
    import("@/lib/notifications").then(async ({ registerSW, requestNotifPermission, showLocalNotification }) => {
      await registerSW();
      const today = new Date().toISOString().split("T")[0];
      const lastRose = scopedStorage.getItem("rosa_daily_notif");
      if (lastRose !== today) {
        const perm = await requestNotifPermission();
        if (perm === "granted") {
          const whispers = [
            "🌹 Good morning. Take a soft breath.",
            "🌹 You are someone's answered prayer today.",
            "🌹 Romanticise your morning. You deserve it.",
            "🌹 Bloom check-in: how is your heart today?",
            "🌹 Your kindness is your superpower.",
          ];
          const w = whispers[new Date().getDate() % whispers.length];
          showLocalNotification("ROSA 🌹", w, "/affirmation");
          scopedStorage.setItem("rosa_daily_notif", today);
        }
      }
    }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NightModeProvider>
          <UserProvider>
            <SubscriptionProvider>
              <GardenProvider>
                <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </GardenProvider>
            </SubscriptionProvider>
          </UserProvider>
        </NightModeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
