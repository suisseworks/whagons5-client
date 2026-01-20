import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';
import { useEffect, useState } from 'react';
import { useAuth } from './providers/AuthProvider';
import { showNotificationToast, getNotificationIcon } from './components/ui/NotificationToast';
import RadiographyEffect from './components/marketing/RadiographyEffect';
import SnowEffect from './components/marketing/SnowEffect';
import RainEffect from './components/marketing/RainEffect';
import FogEffect from './components/marketing/FogEffect';
import AuroraEffect from './components/marketing/AuroraEffect';
import LightningEffect from './components/marketing/LightningEffect';
import MeteorEffect from './components/marketing/MeteorEffect';
import LightningRainEffect from './components/marketing/LightningRainEffect';
import BugEffect from './components/marketing/BugEffect';
import FishEffect from './components/marketing/FishEffect';
import CloudEffect from './components/marketing/CloudEffect';
import ConfettiEffect from './components/marketing/ConfettiEffect';
import HeartsEffect from './components/marketing/HeartsEffect';
import FireworksEffect from './components/marketing/FireworksEffect';

// Initialize icon caching
import './database/iconInit';

type WeatherEffect = 'none' | 'radiography' | 'snow' | 'rain' | 'fog' | 'clouds' | 'aurora' | 'lightning' | 'meteor' | 'storm' | 'bugs' | 'fish';
type CelebrationEffect = 'none' | 'confetti' | 'hearts' | 'fireworks';

const EffectsLayer = () => {
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>('none');
  const [celebrationEffect, setCelebrationEffect] = useState<CelebrationEffect>('none');
  const { user } = useAuth();

  // Only show effects if user is authenticated
  const effectsEnabled = !!user;

  useEffect(() => {
    if (!effectsEnabled) return; // Don't attach listeners if not authenticated

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+M - cycle through weather effects
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        setCelebrationEffect('none'); // Turn off celebration effects
        setWeatherEffect(prev => {
          if (prev === 'none') return 'radiography';
          if (prev === 'radiography') return 'snow';
          if (prev === 'snow') return 'rain';
          if (prev === 'rain') return 'fog';
          if (prev === 'fog') return 'clouds';
          if (prev === 'clouds') return 'aurora';
          if (prev === 'aurora') return 'lightning';
          if (prev === 'lightning') return 'meteor';
          if (prev === 'meteor') return 'storm';
          if (prev === 'storm') return 'bugs';
          if (prev === 'bugs') return 'fish';
          if (prev === 'fish') return 'none';
          return 'none';
        });
      }

      // Ctrl+C - cycle through celebration effects
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        setWeatherEffect('none'); // Turn off weather effects
        setCelebrationEffect(prev => {
          if (prev === 'none') return 'confetti';
          if (prev === 'confetti') return 'hearts';
          if (prev === 'hearts') return 'fireworks';
          return 'none';
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectsEnabled]);

  // Only render effects if user is authenticated
  if (!effectsEnabled) return null;

  return (
    <>
      {weatherEffect === 'radiography' && <RadiographyEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'snow' && <SnowEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'rain' && <RainEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'fog' && <FogEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'clouds' && <CloudEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'aurora' && <AuroraEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'lightning' && <LightningEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'meteor' && <MeteorEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'storm' && <LightningRainEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'bugs' && <BugEffect onClose={() => setWeatherEffect('none')} />}
      {weatherEffect === 'fish' && <FishEffect onClose={() => setWeatherEffect('none')} />}
      {celebrationEffect === 'confetti' && <ConfettiEffect onClose={() => setCelebrationEffect('none')} />}
      {celebrationEffect === 'hearts' && <HeartsEffect onClose={() => setCelebrationEffect('none')} />}
      {celebrationEffect === 'fireworks' && <FireworksEffect onClose={() => setCelebrationEffect('none')} />}
    </>
  );
};

// Component to handle service worker messages
const ServiceWorkerListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for messages from service worker
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data) return;

      // Handle notification clicks
      if (event.data.type === 'NOTIFICATION_CLICKED') {
        if (event.data.url) {
          navigate(event.data.url);
        }
      }

      // Handle new notifications - refresh from IndexedDB and show toast
      if (event.data.type === 'NEW_NOTIFICATION') {
        const notification = event.data.notification;
        
        // Show beautiful toast notification
        showNotificationToast({
          title: notification?.title || 'New Notification',
          body: notification?.body || '',
          onClick: notification?.url ? () => navigate(notification.url) : undefined,
          icon: getNotificationIcon(notification?.data?.type),
          duration: 6000,
        });
        
        // Dynamically import to avoid circular dependencies
        const { store } = await import('./store/store');
        const { genericInternalActions } = await import('./store/genericSlices');
        
        await store.dispatch(genericInternalActions.notifications.getFromIndexedDB({ force: true }) as any);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [navigate]);

  return null;
};

export const App = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ServiceWorkerListener />
      <AppRouter />
      <EffectsLayer />
    </BrowserRouter>
  );
};

export default App;
