import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import WhagonsTitle from '@/assets/WhagonsTitle';

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState<boolean>(false);

  const backgroundImages = useMemo(() => [
    // Ocean waves at sunrise
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
    // Golden mountains landscape
    'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1920&q=80',
    // Modern workspace desk
    'https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=1920&q=80',
    // City skyline at dusk
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80',
    // Forest path in autumn
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80',
    // Mountain lake reflection
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80',
    // Desert dunes at sunset
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80',
    // Northern lights aurora
    'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=1920&q=80',
    // Misty morning mountains
    'https://images.unsplash.com/photo-1464822759844-d150f39ac1a2?auto=format&fit=crop&w=1920&q=80',
    // Ocean waves crashing
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1920&q=80',
    // Starry night sky
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80',
    // Zen garden stones
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1920&q=80',
  ], []);
  const quotes = useMemo(() => [
    'Build momentum. One small step at a time.',
    'Clarity comes from action, not thought.',
    'Start where you are. Use what you have. Do what you can.',
    'Focus on progress, not perfection.',
    'The journey of a thousand miles begins with a single step.',
    'Done is better than perfect.',
    'What you do today can improve all your tomorrows.',
    'Success is the sum of small efforts, repeated day in and day out.',
    'Your future self will thank you for starting today.',
    'Small daily improvements lead to stunning results.',
    'The only way to do great work is to love what you do.',
    'Focus on being productive instead of busy.',
    'Every expert was once a beginner.',
    'The best time to start was yesterday. The next best time is now.',
    'You don\'t have to be great to start, but you have to start to be great.',
    'Action is the foundational key to all success.',
    'Motivation gets you started. Habit keeps you going.',
    'The difference between ordinary and extraordinary is that little extra.',
    'Your only limit is you.',
    'Dream big. Start small. Act now.',
  ], []);
  const [bgIndex, setBgIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    // Randomize background and quote on every page load
    setBgIndex(Math.floor(Math.random() * backgroundImages.length));
    setQuoteIndex(Math.floor(Math.random() * quotes.length));

    const params = new URLSearchParams(location.search);
    if (params.has('welcome') || location.pathname === '/welcome') {
      setShowWelcome(true);
    }
  }, [location.pathname, location.search, backgroundImages.length, quotes.length]);

  // Keep the screen awake while the welcome view is visible (best-effort)
  useEffect(() => {
    if (!showWelcome) return;

    let wakeLockSentinel: any | null = null;

    const requestWakeLock = async () => {
      try {
        const nav: any = navigator as any;
        if (nav && nav.wakeLock && typeof nav.wakeLock.request === 'function') {
          wakeLockSentinel = await nav.wakeLock.request('screen');
          // Re-request if it gets released while the page is visible
          wakeLockSentinel.addEventListener?.('release', () => {
            if (document.visibilityState === 'visible') {
              requestWakeLock().catch(() => {});
            }
          });
        }
      } catch (_e) {
        // Ignore; not supported or blocked until user gesture
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!wakeLockSentinel || wakeLockSentinel.released)) {
        requestWakeLock().catch(() => {});
      }
    };

    requestWakeLock().catch(() => {});
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      try { wakeLockSentinel?.release?.(); } catch (_e) {}
      wakeLockSentinel = null;
    };
  }, [showWelcome]);

  // Safely destructure with default values
  const workspacesState = useSelector((s: RootState) => s.workspaces);
  const teamsState = useSelector((s: RootState) => s.teams);
  const categoriesState = useSelector((s: RootState) => s.categories);
  const templatesState = useSelector((s: RootState) => s.templates);
  const tasksState = useSelector((s: RootState) => s.tasks);

  const { value: workspaces = [] } = workspacesState || {};
  const { value: teams = [] } = teamsState || {};
  const { value: categories = [] } = categoriesState || {};
  const { value: templates = [] } = templatesState || {};
  const { value: tasks = [] } = tasksState || {};

  // Data is hydrated globally in AuthProvider; no fetching here

  const topWorkspaces = useMemo(() => workspaces.slice(0, 6), [workspaces]);

  if (showWelcome) {
    return (
      <div
        className="relative h-screen w-screen overflow-hidden"
        style={{
          backgroundImage: `url(${backgroundImages[bgIndex]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        {/* Top-left small logo */}
        <div className="absolute top-6 left-6 z-20 flex items-center">
          <div className="opacity-95">
            <WhagonsTitle />
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center h-screen px-6">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white max-w-3xl">{quotes[quoteIndex]}</h1>
          <div className="mt-8">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100" onClick={() => navigate('/workspace/all', { replace: true })}>
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome</h1>
          <p className="text-muted-foreground">Select a workspace to get started, or explore your stats below.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/analytics')}>View Analytics</Button>
          <Button onClick={() => navigate('/settings')}>Open Settings</Button>
        </div>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Total available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Across your org</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>For organizing tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Reusable workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks overview */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks Overview</CardTitle>
          <CardDescription>Current total across all workspaces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tasks.length}</div>
        </CardContent>
      </Card>

      {/* Recent Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Workspaces</CardTitle>
          <CardDescription>Jump back in</CardDescription>
        </CardHeader>
        <CardContent>
          {topWorkspaces.length === 0 ? (
            <div className="text-muted-foreground">No workspaces yet. Create one from Settings → Workspaces.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topWorkspaces.map((ws: any) => (
                <button
                  key={ws.id}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="p-4 border rounded-md text-left hover:bg-accent transition-colors"
                >
                  <div className="text-base font-medium truncate">{ws.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{ws.description}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Home;


