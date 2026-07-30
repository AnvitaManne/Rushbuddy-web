import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { AuthPage } from './components/pages/AuthPage';
import { VerifyPage } from './components/pages/VerifyPage';
import { HomePage } from './components/pages/HomePage';
import { PostRequestPage } from './components/pages/PostRequestPage';
import { TrackingPage } from './components/pages/TrackingPage';
import { RunnerFeedPage } from './components/pages/RunnerFeedPage';
import { ActiveDeliveryPage } from './components/pages/ActiveDeliveryPage';
import { RatingPage } from './components/pages/RatingPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { OpsPage } from './components/pages/OpsPage';

function RedirectToHome() {
  return <Navigate to="/home" replace />;
}

function NotFound() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  // Public auth routes
  { path: '/', Component: AuthPage },
  { path: '/verify', Component: VerifyPage },

  // Authenticated app shell routes
  {
    Component: AppShell,
    children: [
      { path: '/home', Component: HomePage },
      { path: '/sender/post', Component: PostRequestPage },
      { path: '/sender/tracking', Component: TrackingPage },
      { path: '/runner/feed', Component: RunnerFeedPage },
      { path: '/runner/active', Component: ActiveDeliveryPage },
      { path: '/rate', Component: RatingPage },
      { path: '/profile', Component: ProfilePage },
      { path: '/ops', Component: OpsPage },
    ],
  },

  // Catch-all
  { path: '*', Component: NotFound },
]);
