import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let SETTINGS = {
  rewardRadius: 15,
  thresholds: [
    { maxDistance: 100, color: "#3B5BDB", text: "Çok soğuksun..." },
    { maxDistance: 50, color: "#F59F00", text: "Isınıyorsun!" },
    { maxDistance: 20, color: "#E8590C", text: "SICAKLAŞIYORSUN!" },
    { maxDistance: 10, color: "#C92A2A", text: "YANIYORSUN! 🔥" }
  ]
};

// Target data (In a real app, this might come from a database)
let TEAMS: Record<string, { name: string; lat: number; lng: number; reward: string }> = {
  "KIRMIZI-KARTAL-42": {
    name: "Red Eagles",
    lat: 41.0082, // Sample Istanbul coordinates
    lng: 28.9784,
    reward: "Sahne arkasındaki kırmızı koltukların hemen yanında!"
  },
  "MAVI-ASLAN-07": {
    name: "Blue Lions",
    lat: 41.0122,
    lng: 28.9744,
    reward: "Girişteki vestiyerin arkasındaki mavi kutuda!"
  },
  "YESIL-KURT-13": {
    name: "Green Wolves",
    lat: 41.0052,
    lng: 28.9824,
    reward: "Barın sağ tarafındaki yeşil saksının içinde!"
  },
  "TEST-01": {
    name: "Test Takımı",
    lat: 38.67343079262147,
    lng: 39.16065547479917,
    reward: "Test başarılı! Ödülü aldın."
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
