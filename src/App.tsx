import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';
import { useEffect, useState } from 'react';
import { useAuth } from './providers/AuthProvider';
import toast from 'react-hot-toast';
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

const getEffectDisplayName = (effect: WeatherEffect | CelebrationEffect): string => {
  const names: Record<string, string> = {
    'radiography': 'Deep Perspective',
    'snow': 'Snow',
    'rain': 'Rain',
    'fog': 'Fog',
    'clouds': 'Clouds',
    'aurora': 'Aurora',
    'lightning': 'Lightning',
    'meteor': 'Meteor',
    'storm': 'Storm',
    'bugs': 'Bugs',
    'fish': 'Fish',
    'confetti': 'Confetti',
    'hearts': 'Hearts',
    'fireworks': 'Fireworks',
    'none': 'None'
  };
  return names[effect] || effect;
};

const EffectsLayer = () => {
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>('none');
  const [celebrationEffect, setCelebrationEffect] = useState<CelebrationEffect>('none');
  const { user } = useAuth();

  // Only show effects if user is authenticated
  const effectsEnabled = !!user;

  useEffect(() => {
    if (!effectsEnabled) return; // Don't attach listeners if not authenticated

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input field (e.g., assistant)
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('role') === 'textbox' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      // Ctrl+Shift+S - stop all effects
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's') && !isInputFocused) {
        e.preventDefault();
        setWeatherEffect('none');
        setCelebrationEffect('none');
        return;
      }
      
      // Ctrl+Shift+M - cycle through weather effects
      if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm') && !isInputFocused) {
        e.preventDefault();
        setWeatherEffect(prev => {
          let next: WeatherEffect;
          if (prev === 'none') next = 'radiography';
          else if (prev === 'radiography') next = 'snow';
          else if (prev === 'snow') next = 'rain';
          else if (prev === 'rain') next = 'fog';
          else if (prev === 'fog') next = 'clouds';
          else if (prev === 'clouds') next = 'aurora';
          else if (prev === 'aurora') next = 'lightning';
          else if (prev === 'lightning') next = 'meteor';
          else if (prev === 'meteor') next = 'storm';
          else if (prev === 'storm') next = 'bugs';
          else if (prev === 'bugs') next = 'fish';
          else if (prev === 'fish') next = 'none';
          else next = 'none';
          
          if (next !== 'none') {
            toast.success(getEffectDisplayName(next));
          }
          return next;
        });
      }

      // Ctrl+Shift+C - cycle through celebration effects
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c') && !isInputFocused) {
        e.preventDefault();
        setCelebrationEffect(prev => {
          let next: CelebrationEffect;
          if (prev === 'none') next = 'confetti';
          else if (prev === 'confetti') next = 'hearts';
          else if (prev === 'hearts') next = 'fireworks';
          else next = 'none';
          
          if (next !== 'none') {
            toast.success(getEffectDisplayName(next));
          }
          return next;
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

export const App = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppRouter />
      <EffectsLayer />
    </BrowserRouter>
  );
};

export default App;
