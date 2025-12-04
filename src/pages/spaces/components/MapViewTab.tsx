import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Map } from "lucide-react";

type MarkerType = "user" | "task";

interface LatLngMarker {
  id: string;
  type: MarkerType;
  label: string;
  lat: number;
  lng: number;
}

declare global {
  interface Window { google: any }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = '';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
    document.head.appendChild(script);
  });
}

export default function MapViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [showUsers, setShowUsers] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const gMarkersRef = useRef<any[]>([]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Sample markers near San Francisco
  const sampleMarkers = useMemo<LatLngMarker[]>(() => {
    const center = { lat: 37.7749, lng: -122.4194 };
    const rand = (seed: number) => ((Math.sin(seed) + 1) / 2);
    const items: LatLngMarker[] = [];
    for (let i = 0; i < 6; i++) {
      items.push({ id: `u-${i}`, type: 'user', label: `User ${i + 1}`, lat: center.lat + (rand(i * 3) - 0.5) * 0.08, lng: center.lng + (rand(i * 5) - 0.5) * 0.12 });
    }
    for (let i = 0; i < 8; i++) {
      items.push({ id: `t-${i}`, type: 'task', label: `Task ${i + 1}`, lat: center.lat + (rand(i * 7) - 0.5) * 0.1, lng: center.lng + (rand(i * 11) - 0.5) * 0.16 });
    }
    return items;
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setLoadError('Missing VITE_GOOGLE_MAPS_API_KEY');
      return;
    }
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch((e) => setLoadError(e.message || 'Failed to load Google Maps'));
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!window.google?.maps) return;

    const google = window.google as any;
    const center = { lat: 37.7749, lng: -122.4194 };
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    // create markers
    gMarkersRef.current.forEach(m => m.setMap(null));
    gMarkersRef.current = sampleMarkers.map(m => {
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: `${m.label} (${m.type})`,
        label: m.type === 'user' ? { text: 'U', color: '#fff' } : { text: 'T', color: '#fff' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: m.type === 'user' ? '#2563eb' : '#059669',
          fillOpacity: 1,
          strokeWeight: 0
        }
      });
      // attach type for filtering
      (marker as any).__type = m.type;
      return marker;
    });

    // fit bounds
    const bounds = new google.maps.LatLngBounds();
    sampleMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
    map.fitBounds(bounds);
  }, [ready, sampleMarkers]);

  // Visibility filter for markers
  useEffect(() => {
    const google = window.google as any;
    if (!google || !mapInstanceRef.current) return;
    gMarkersRef.current.forEach(marker => {
      const t = (marker as any).__type as MarkerType;
      const visible = (t === 'user' && showUsers) || (t === 'task' && showTasks);
      marker.setMap(visible ? mapInstanceRef.current : null);
    });
  }, [showUsers, showTasks]);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Map className="w-4 h-4" />
        <span>Google Map</span>
        <span className="text-xs ml-auto">space {workspaceId ?? ""}</span>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="py-3 flex items-center justify-between">
          <CardTitle className="text-base">Activity Map</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={showUsers ? "secondary" : "outline"} onClick={() => setShowUsers(v => !v)}>Users</Button>
            <Button size="sm" variant={showTasks ? "secondary" : "outline"} onClick={() => setShowTasks(v => !v)}>Tasks</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 h-full">
          {!apiKey || loadError ? (
            <div className="h-[520px] border rounded-md flex items-center justify-center text-sm text-muted-foreground">
              {loadError ? loadError : 'Missing Google Maps API key'}
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-[520px] rounded-md border" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


