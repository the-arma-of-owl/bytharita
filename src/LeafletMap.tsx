import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Crosshair, LocateFixed } from 'lucide-react';

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom red target marker
const targetIcon = new L.DivIcon({
  html: `<div style="
    width: 20px; height: 20px;
    background: radial-gradient(circle, #ff3333 0%, #cc0000 60%, #990000 100%);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(255,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Draggable handle marker for radius adjustment
const handleIcon = new L.DivIcon({
  html: `<div style="
    width: 18px; height: 18px;
    background: radial-gradient(circle, #FFD700 0%, #FFA500 100%);
    border: 3px solid #333;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(255,215,0,0.6);
    cursor: grab;
  "></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface LeafletMapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  onRadiusChange?: (index: number, newRadius: number) => void;
  defaultLat?: number;
  defaultLng?: number;
  settings?: any;
  isSettingsMode?: boolean;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Search component inside the map
function SearchControl() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<any>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=tr`
      );
      const data = await res.json();
      setResults(data);
      setShowResults(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const selectResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    map.flyTo([lat, lon], 19, { duration: 1.5 });
    setShowResults(false);
    setQuery(item.display_name.split(',')[0]);
  };

  return (
    <div className="absolute top-3 left-3 z-[1000] w-72" onClick={e => e.stopPropagation()}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Konum ara..."
          className="w-full bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xl"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {showResults && results.length > 0 && (
        <div className="mt-1 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => selectResult(r)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 border-b border-zinc-800/50 last:border-0 transition-colors text-zinc-200"
            >
              <div className="font-medium truncate">{r.display_name.split(',')[0]}</div>
              <div className="text-xs text-zinc-500 truncate mt-0.5">{r.display_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Locate me button
function LocateControl() {
  const map = useMap();
  const handleLocate = () => {
    map.locate({ setView: true, maxZoom: 20, enableHighAccuracy: true });
  };
  return (
    <button
      onClick={handleLocate}
      className="absolute bottom-4 right-4 z-[1000] bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-3 rounded-xl shadow-xl hover:bg-zinc-800 transition-colors group"
      title="Konumumu bul"
    >
      <LocateFixed className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
    </button>
  );
}

// Click handler for location selection
function ClickHandler({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Draggable handle for radius adjustment
function DraggableHandle({
  center,
  radius,
  index,
  onRadiusChange,
}: {
  center: [number, number];
  radius: number;
  index: number;
  onRadiusChange: (index: number, newRadius: number) => void;
}) {
  const map = useMap();

  // Calculate handle position: east of center at `radius` meters
  const getHandlePos = useCallback((): [number, number] => {
    const centerLatLng = L.latLng(center[0], center[1]);
    const point = map.latLngToLayerPoint(centerLatLng);
    // Calculate pixels for this radius at current zoom
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center[0] * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
    const radiusPixels = radius / metersPerPixel;
    const handlePoint = L.point(point.x + radiusPixels, point.y);
    const handleLatLng = map.layerPointToLatLng(handlePoint);
    return [handleLatLng.lat, handleLatLng.lng];
  }, [center, radius, map]);

  const [handlePos, setHandlePos] = useState<[number, number]>(getHandlePos);

  useEffect(() => {
    setHandlePos(getHandlePos());
  }, [getHandlePos]);

  // Also update on zoom
  useMapEvents({
    zoom() {
      setHandlePos(getHandlePos());
    }
  });

  const handleMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = handleMarkerRef.current;
    if (!marker) return;

    marker.on('drag', (e: any) => {
      const newLatLng = e.target.getLatLng();
      const dist = haversineDistance(center[0], center[1], newLatLng.lat, newLatLng.lng);
      onRadiusChange(index, Math.max(0.5, Math.round(dist * 10) / 10));
    });

    return () => {
      marker.off('drag');
    };
  }, [center, index, onRadiusChange]);

  return (
    <Marker
      position={handlePos}
      icon={handleIcon}
      draggable={true}
      ref={handleMarkerRef}
    />
  );
}

export default function LeafletMap({
  onLocationSelect,
  onRadiusChange,
  defaultLat = 38.67062,
  defaultLng = 39.18672,
  settings,
  isSettingsMode = false,
}: LeafletMapProps) {
  const zoom = isSettingsMode ? 19 : 17;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={[defaultLat, defaultLng]}
        zoom={zoom}
        maxZoom={22}
        className="w-full h-full"
        style={{ background: '#111' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; Google'
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          maxZoom={22}
          maxNativeZoom={20}
        />

        {/* Target marker */}
        <Marker position={[defaultLat, defaultLng]} icon={targetIcon} />

        {/* Threshold circles */}
        {settings?.thresholds?.map((t: any, i: number) => (
          <Circle
            key={i}
            center={[defaultLat, defaultLng]}
            radius={t.maxDistance}
            pathOptions={{
              color: t.color,
              fillColor: t.color,
              fillOpacity: 0.12,
              weight: 2,
              opacity: 0.8,
              dashArray: isSettingsMode ? '6 4' : undefined,
            }}
          />
        ))}

        {/* Draggable handles in settings mode */}
        {isSettingsMode && onRadiusChange && settings?.thresholds?.map((t: any, i: number) => (
          <DraggableHandle
            key={`handle-${i}`}
            center={[defaultLat, defaultLng]}
            radius={t.maxDistance}
            index={i}
            onRadiusChange={onRadiusChange}
          />
        ))}

        {/* Click to select location */}
        {!isSettingsMode && <ClickHandler onLocationSelect={onLocationSelect} />}

        {/* Search bar */}
        <SearchControl />

        {/* Locate me button */}
        <LocateControl />
      </MapContainer>

      {isSettingsMode && (
        <div className="absolute top-3 right-3 z-[1000] bg-black/80 backdrop-blur-md px-3 py-2 rounded-lg text-sm text-yellow-400 pointer-events-none border border-yellow-700/50 flex items-center gap-2">
          <Crosshair className="w-4 h-4" />
          Sarı noktalardan tutarak çapı ayarlayın
        </div>
      )}

      {!isSettingsMode && (
        <div className="absolute top-3 right-3 z-[1000] bg-black/80 backdrop-blur-md px-3 py-2 rounded-lg text-sm text-blue-400 pointer-events-none border border-blue-700/50 flex items-center gap-2">
          <Crosshair className="w-4 h-4" />
          Haritadan konum seçmek için tıklayın
        </div>
      )}
    </div>
  );
}
