import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/providers/LanguageProvider";
import WhagonsTitle from '@/assets/WhagonsTitle';
import RotatingBackground from "@/components/marketing/RotatingBackground";
import { HERO_BACKGROUND_IMAGES } from "@/assets/marketing/heroBackgrounds";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  
  const isSpanish = language === 'es-ES' || language.startsWith('es');
  
  const quotes = useMemo(() => {
    if (isSpanish) {
      return [
        'Construye impulso. Un pequeño paso a la vez.',
        'La claridad viene de la acción, no del pensamiento.',
        'Empieza donde estás. Usa lo que tienes. Haz lo que puedas.',
        'Enfócate en el progreso, no en la perfección.',
        'El viaje de mil millas comienza con un solo paso.',
        'Es mejor completar que perfeccionar.',
        'Lo que haces hoy puede mejorar todos tus mañanas.',
        'El éxito es la suma de pequeños esfuerzos, repetidos día tras día.',
        'Tu yo futuro te agradecerá por empezar hoy.',
        'Las pequeñas mejoras diarias conducen a resultados impresionantes.',
        'La única forma de hacer un gran trabajo es amar lo que haces.',
        'Enfócate en ser productivo en lugar de estar ocupado.',
        'Todo experto fue alguna vez un principiante.',
        'El mejor momento para empezar fue ayer. El siguiente mejor momento es ahora.',
        'No tienes que ser genial para empezar, pero tienes que empezar para ser genial.',
        'La acción es la clave fundamental de todo éxito.',
        'La motivación te hace empezar. El hábito te mantiene en marcha.',
        'La diferencia entre lo ordinario y lo extraordinario es ese pequeño extra.',
        'Tu único límite eres tú.',
        'Sueña en grande. Empieza pequeño. Actúa ahora.',
      ];
    }
    return [
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
    ];
  }, [isSpanish]);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    // Randomize quote on every page load
    setQuoteIndex(Math.floor(Math.random() * quotes.length));

    const params = new URLSearchParams(location.search);
    if (params.has('welcome') || location.pathname === '/welcome') {
      setShowWelcome(true);
    }
  }, [location.pathname, location.search, quotes.length]);

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
      <RotatingBackground images={HERO_BACKGROUND_IMAGES} intervalMs={10_000} className="h-screen w-screen">
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        {/* Top-left small logo */}
        <div className="absolute top-6 left-6 z-20 flex items-center">
          <div className="opacity-95">
            <WhagonsTitle />
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-6">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white max-w-3xl">{quotes[quoteIndex]}</h1>
          <div className="mt-8">
            <Button
              size="lg"
              className="cursor-pointer bg-primary text-white hover:bg-primary/90"
              onClick={() => navigate('/workspace/all', { replace: true })}
            >
              {t('home.getStarted', 'Get Started')}
            </Button>
          </div>
        </div>
      </RotatingBackground>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('home.welcome', 'Welcome')}</h1>
          <p className="text-muted-foreground">{t('home.selectWorkspace', 'Select a workspace to get started, or explore your stats below.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/analytics')}>{t('home.viewAnalytics', 'View Analytics')}</Button>
          <Button onClick={() => navigate('/settings')}>{t('home.openSettings', 'Open Settings')}</Button>
        </div>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.workspaces', 'Workspaces')}</CardTitle>
            <CardDescription>{t('home.totalAvailable', 'Total available')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('home.teams', 'Teams')}</CardTitle>
            <CardDescription>{t('home.acrossOrg', 'Across your org')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('home.categories', 'Categories')}</CardTitle>
            <CardDescription>{t('home.forOrganizingTasks', 'For organizing tasks')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('home.templates', 'Templates')}</CardTitle>
            <CardDescription>{t('home.reusableWorkflows', 'Reusable workflows')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('home.tasksOverview', 'Tasks Overview')}</CardTitle>
          <CardDescription>{t('home.currentTotal', 'Current total across all workspaces')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tasks.length}</div>
        </CardContent>
      </Card>

      {/* Recent Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle>{t('home.recentWorkspaces', 'Recent Workspaces')}</CardTitle>
          <CardDescription>{t('home.jumpBackIn', 'Jump back in')}</CardDescription>
        </CardHeader>
        <CardContent>
          {topWorkspaces.length === 0 ? (
            <div className="text-muted-foreground">{t('home.noWorkspaces', 'No workspaces yet. Create one from Settings → Workspaces.')}</div>
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


