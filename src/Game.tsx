import { useState, useEffect, useRef, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Trophy, ShieldAlert, Wifi, Zap, Smartphone, ChevronRight } from "lucide-react";

type View = "join" | "permissions" | "game" | "reward";

interface GameState {
  code: string;
  teamName: string;
  distance: number | null;
  reward: string | null;
  error: string | null;
  settings: any | null;
  userLat?: number;
  userLng?: number;
  targetLat?: number;
  targetLng?: number;
}

export default function Game() {
  const [view, setView] = useState<View>("join");
  const [gameState, setGameState] = useState<GameState>({
    code: "",
    teamName: "",
    distance: null,
    reward: null,
    error: null,
    settings: null,
  });
  
  const [watchId, setWatchId] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Audio for iOS fallback
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playBeep = (freq: number, duration: number) => {
    if (!audioContextRef.current) return;
    try {
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      osc.connect(gain);
      gain.connect(audioContextRef.current.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
      osc.start();
      osc.stop(audioContextRef.current.currentTime + duration);
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setGameState(s => ({ ...s, error: "GPS desteklenmiyor!" }));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch("/api/get-distance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: gameState.code,
              lat: latitude,
              lng: longitude,
            }),
          });
          const data = await res.json();
          if (data.distance !== undefined) {
            setGameState(s => ({ 
              ...s, 
              distance: data.distance,
              reward: data.reward || s.reward,
              userLat: latitude,
              userLng: longitude,
              targetLat: data.targetLat,
              targetLng: data.targetLng
            }));

            if (data.reward) {
              setView("reward");
              if (id) navigator.geolocation.clearWatch(id);
            }
          }
        } catch (err) {
          console.error("Mesafe hatası:", err);
        }
      },
      (err) => {
        setGameState(s => ({ ...s, error: "Konum izni reddedildi!" }));
      },
      { enableHighAccuracy: true }
    );
    setWatchId(id);
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setGameState(s => ({ ...s, error: null }));
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: gameState.code }),
      });
      const data = await res.json();
      if (data.valid) {
        setGameState(s => ({ ...s, teamName: data.teamName, settings: data.settings }));
        setView("permissions");
      } else {
        setGameState(s => ({ ...s, error: data.error || "Hatalı kod!" }));
      }
    } catch (err) {
      setGameState(s => ({ ...s, error: "Sunucu hatası!" }));
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const lerpColor = (c1: string, c2: string, ratio: number) => {
    const r1 = hexToRgb(c1);
    const r2 = hexToRgb(c2);
    const r = Math.round(r1.r + (r2.r - r1.r) * ratio);
    const g = Math.round(r1.g + (r2.g - r1.g) * ratio);
    const b = Math.round(r1.b + (r2.b - r1.b) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Signal properties based on distance
  const getSignalProps = (dist: number | null, settings: any) => {
    if (dist === null || !settings || !settings.thresholds) return { color: "#111", text: "Konum aranıyor...", pulse: 0 };
    
    const thresholds = [...settings.thresholds].sort((a, b) => a.maxDistance - b.maxDistance);
    if (thresholds.length === 0) return { color: "#111", text: "Ayar yok", pulse: 0 };

    // Find the current active text
    const activeText = thresholds.find(t => dist <= t.maxDistance)?.text || thresholds[thresholds.length - 1].text;
    
    // Smooth Color Interpolation
    let color = thresholds[thresholds.length - 1].color; // Default to furthest color
    
    if (dist <= thresholds[0].maxDistance) {
      color = thresholds[0].color;
    } else if (dist >= thresholds[thresholds.length - 1].maxDistance) {
      color = thresholds[thresholds.length - 1].color;
    } else {
      // Find the two thresholds we are between
      for (let i = 0; i < thresholds.length - 1; i++) {
        const t1 = thresholds[i];
        const t2 = thresholds[i+1];
        if (dist >= t1.maxDistance && dist < t2.maxDistance) {
          // dist is between t1 (closer) and t2 (further)
          const ratio = (dist - t1.maxDistance) / (t2.maxDistance - t1.maxDistance);
          // lerp from t1.color to t2.color. 
          color = lerpColor(t1.color, t2.color, ratio);
          break;
        }
      }
    }

    // Default vibration intervals based on distance for now, or could make these dynamic too
    let pulse = 0, freq = 200, interval = 2000;
    if (dist < 20) { pulse = 150; freq = 800; interval = 250; }
    else if (dist < 50) { pulse = 300; freq = 600; interval = 500; }
    else if (dist < 100) { pulse = 500; freq = 400; interval = 1000; }

    return { color, text: activeText, pulse, freq, interval };
  };

  const signal = getSignalProps(gameState.distance, gameState.settings);

  // Vibration / Beep effects
  useEffect(() => {
    if (view !== "game" || !signal.pulse) return;

    const tick = () => {
      if (navigator.vibrate) {
        navigator.vibrate(signal.pulse);
      }
      playBeep(signal.freq || 400, 0.1);
    };

    const interval = setInterval(tick, signal.interval || 1000);

    return () => clearInterval(interval);
  }, [view, signal.pulse, signal.freq, signal.interval]);

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {view === "join" && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-900/50">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-center">SICAK SOĞUK</h1>
            <p className="text-gray-400 mb-8 text-center text-sm">Etkinlik Kodunu Girerek Başla</p>
            
            <form onSubmit={handleVerify} className="w-full max-w-sm space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="TAKIM-KODU-XX"
                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center font-mono tracking-widest focus:ring-2 focus:ring-blue-600 outline-none transition-all uppercase"
                  value={gameState.code}
                  onChange={e => setGameState(s => ({ ...s, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              {gameState.error && (
                <p className="text-red-500 text-sm text-center font-medium">{gameState.error}</p>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-xl font-bold flex items-center justify-center gap-2 group transition-all"
              >
                GİRİŞ YAP <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </motion.div>
        )}

        {view === "permissions" && (
          <motion.div
            key="permissions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-screen p-8 text-center"
          >
            <ShieldAlert className="w-20 h-20 text-yellow-500 mb-6" />
            <h2 className="text-2xl font-bold mb-4">İzinler Gerekli</h2>
            <p className="text-gray-400 mb-8 max-w-xs">
              Oyunu oynamak için konumunuzu takip etmemiz ve titreşim/ses bildirimlerini etkinleştirmemiz gerekiyor.
            </p>
            <div className="space-y-4 w-full max-w-xs">
              <button
                onClick={() => {
                  initAudio();
                  startTracking();
                  setView("game");
                }}
                className="w-full bg-white text-black p-4 rounded-xl font-bold flex items-center justify-center gap-3"
              >
                <MapPin className="w-5 h-5" /> ŞİMDİ BAŞLAT
              </button>
            </div>
          </motion.div>
        )}

        {view === "game" && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, backgroundColor: signal.color }}
            className="fixed inset-0 flex flex-col items-center justify-between py-20 px-8 transition-colors duration-500"
          >
            <div className="text-center">
              <span className="bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                {gameState.teamName}
              </span>
            </div>

            {/* Test Modu Overlay */}
            <div className="fixed top-4 left-4 z-50 bg-black/80 backdrop-blur-sm text-xs font-mono p-3 rounded-xl text-zinc-300 border border-zinc-700/50 pointer-events-none shadow-xl">
              <div className="text-yellow-400 font-bold mb-2">🛠 TEST MODU</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-zinc-500">Mevcut:</span>
                <span>{gameState.userLat?.toFixed(5)}, {gameState.userLng?.toFixed(5)}</span>
                <span className="text-zinc-500">Hedef:</span>
                <span>{gameState.targetLat?.toFixed(5)}, {gameState.targetLng?.toFixed(5)}</span>
                <span className="text-zinc-500 mt-1">Mesafe:</span>
                <span className="font-bold text-white mt-1">{gameState.distance?.toFixed(1)}m</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: signal.interval ? signal.interval / 1000 : 2, repeat: Infinity }}
                className="w-32 h-32 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center shadow-2xl"
              >
                <Wifi className="w-12 h-12 text-white" />
              </motion.div>
              <h2 className="text-4xl font-black tracking-tighter text-center uppercase drop-shadow-lg">
                {signal.text}
              </h2>
            </div>

            <div className="w-full max-w-xs space-y-4 text-center">
              <p className="text-white/60 text-sm font-medium flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4" /> Telefonu Elinde Tut
              </p>
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white"
                  animate={{ width: `${Math.max(0, 100 - (gameState.distance || 100))}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {view === "reward" && (
          <motion.div
            key="reward"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-green-600"
          >
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-bounce">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-4xl font-black mb-4">TEBRİKLER!</h2>
            <div className="text-xl font-medium mb-8 bg-black/20 p-6 rounded-2xl backdrop-blur-md">
              {gameState.reward}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-white text-black font-bold rounded-xl active:scale-95 transition-transform"
            >
              YENİDEN BAŞLAT
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
