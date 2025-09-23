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
  ], []);
  const quotes = useMemo(() => [
    'Build momentum. One small step at a time.',
    'Clarity comes from action, not thought.',
    'Start where you are. Use what you have. Do what you can.',
    'Focus on progress, not perfection.',
  ], []);
  const [bgIndex, setBgIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('welcome') || location.pathname === '/welcome') {
      setShowWelcome(true);
      setBgIndex(Math.floor(Math.random() * backgroundImages.length));
      setQuoteIndex(Math.floor(Math.random() * quotes.length));
    }
  }, [location.pathname, location.search, backgroundImages.length, quotes.length]);

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


