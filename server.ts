import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let SETTINGS = {
  rewardRadius: 0.5, // 50cm'ye yaklaşınca ödül açılır
  thresholds: [
    { maxDistance: 20, color: "#3B5BDB", text: "Çok soğuksun... 🥶" },
    { maxDistance: 10, color: "#1C7ED6", text: "Soğuk... ❄️" },
    { maxDistance: 5, color: "#F59F00", text: "Isınıyorsun! 🌡️" },
    { maxDistance: 3, color: "#E8590C", text: "SICAKLAŞIYORSUN! 🔥" },
    { maxDistance: 1.5, color: "#C92A2A", text: "YANIYORSUN! 🔥🔥🔥" },
    { maxDistance: 0.5, color: "#FF0000", text: "LAVA! HEMEN YANINDA! 🌋" }
  ]
};

// Elazığ Elisyum AVM içi konumlar
let TEAMS: Record<string, { name: string; lat: number; lng: number; reward: string }> = {
  "TAKIM-1": {
    name: "Ateş Takımı",
    lat: 38.67062,
    lng: 39.18672,
    reward: "🏆 Elisyum AVM Giriş Katı - Bilgi bankosunun yanındaki kırmızı kutu!"
  },
  "TAKIM-2": {
    name: "Buz Takımı",
    lat: 38.67065,
    lng: 39.18675,
    reward: "🏆 Elisyum AVM Food Court - Orta masadaki mavi zarfın içinde!"
  },
  "TAKIM-3": {
    name: "Fırtına Takımı",
    lat: 38.67060,
    lng: 39.18670,
    reward: "🏆 Elisyum AVM Sinema Önü - Poster panosunun arkasında!"
  },
  "TAKIM-4": {
    name: "Yıldırım Takımı",
    lat: 38.67068,
    lng: 39.18668,
    reward: "🏆 Elisyum AVM Oyun Alanı - Pençe makinasının yanındaki yeşil kutu!"
  },
  "TAKIM-5": {
    name: "Gölge Takımı",
    lat: 38.67055,
    lng: 39.18680,
    reward: "🏆 Elisyum AVM Yürüyen Merdiven - Saksının arkasındaki sarı zarf!"
  }
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.post("/api/verify-code", (req, res) => {
    const { code } = req.body;
    const team = TEAMS[code];
    if (team) {
      res.json({ valid: true, teamName: team.name, settings: SETTINGS });
    } else {
      res.status(404).json({ valid: false, error: "Geçersiz takım kodu!" });
    }
  });

  app.post("/api/get-distance", (req, res) => {
    const { code, lat, lng } = req.body;
    const team = TEAMS[code];
    
    if (!team) {
      return res.status(404).json({ error: "Takım bulunamadı" });
    }

    const distance = haversineDistance(lat, lng, team.lat, team.lng);
    
    // If distance is less than the reward radius, reveal the reward
    const reward = distance < SETTINGS.rewardRadius ? team.reward : null;

    res.json({ distance, reward, targetLat: team.lat, targetLng: team.lng });
  });

  // Admin Endpoints
  app.get("/api/settings", (req, res) => {
    res.json(SETTINGS);
  });

  app.put("/api/settings", (req, res) => {
    const { rewardRadius, thresholds } = req.body;
    if (rewardRadius !== undefined) SETTINGS.rewardRadius = rewardRadius;
    if (thresholds !== undefined) SETTINGS.thresholds = thresholds;
    res.json({ success: true, settings: SETTINGS });
  });

  app.get("/api/teams", (req, res) => {
    res.json(TEAMS);
  });

  app.post("/api/teams", (req, res) => {
    const { code, name, lat, lng, reward } = req.body;
    if (!code || !name || lat == null || lng == null || !reward) {
      return res.status(400).json({ error: "Eksik bilgi" });
    }
    TEAMS[code] = { name, lat, lng, reward };
    res.json({ success: true, team: TEAMS[code] });
  });

  app.put("/api/teams/:code", (req, res) => {
    const { code } = req.params;
    const { name, lat, lng, reward } = req.body;
    if (!TEAMS[code]) {
      return res.status(404).json({ error: "Takım bulunamadı" });
    }
    TEAMS[code] = { ...TEAMS[code], name, lat, lng, reward };
    res.json({ success: true, team: TEAMS[code] });
  });

  app.delete("/api/teams/:code", (req, res) => {
    const { code } = req.params;
    if (TEAMS[code]) {
      delete TEAMS[code];
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Takım bulunamadı" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
