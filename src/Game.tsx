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
}

export default function Game() {
  const [view, setView] = useState<View>("join");
  const [gameState, setGameState] = useState<GameState>({
    code: "",
    teamName: "",
    distance: null,
    reward: null,
    error: null,
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
              reward: data.reward || s.reward
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
        setGameState(s => ({ ...s, teamName: data.teamName }));
        setView("permissions");
      } else {
        setGameState(s => ({ ...s, error: data.error || "Hatalı kod!" }));
      }
    } catch (err) {
      setGameState(s => ({ ...s, error: "Sunucu hatası!" }));
    }
  };

  // Signal properties based on distance
  const getSignalProps = (dist: number | null) => {
    if (dist === null) return { color: "#111", text: "Konum aranıyor...", pulse: 0 };
    if (dist > 100) return { color: "#3B5BDB", text: "Çok soğuksun...", pulse: 0, freq: 200, interval: 2000 };
    if (dist > 50) return { color: "#F59F00", text: "Isınıyorsun!", pulse: 500, freq: 400, interval: 1000 };
    if (dist > 20) return { color: "#E8590C", text: "SICAKLAŞIYORSUN!", pulse: 300, freq: 600, interval: 500 };
    return { color: "#C92A2A", text: "YANIYORSUN! 🔥", pulse: 150, freq: 800, interval: 250 };
  };

  const signal = getSignalProps(gameState.distance);

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
