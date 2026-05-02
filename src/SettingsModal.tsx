import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";

export interface Threshold {
  maxDistance: number;
  color: string;
  text: string;
}

export interface Settings {
  rewardRadius: number;
  thresholds: Threshold[];
}

interface SettingsModalProps {
  initialSettings: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export default function SettingsModal({ initialSettings, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings);

  const addThreshold = () => {
    setSettings(s => ({
      ...s,
      thresholds: [...s.thresholds, { maxDistance: 30, color: "#FFFFFF", text: "Yeni Eşik" }].sort((a, b) => b.maxDistance - a.maxDistance)
    }));
  };

  const removeThreshold = (idx: number) => {
    setSettings(s => ({
      ...s,
      thresholds: s.thresholds.filter((_, i) => i !== idx)
    }));
  };

  const updateThreshold = (idx: number, field: keyof Threshold, value: any) => {
    setSettings(s => {
      const newThresholds = [...s.thresholds];
      newThresholds[idx] = { ...newThresholds[idx], [field]: value };
      // Note: We don't sort immediately to prevent input focus loss, sorting happens on save or optionally.
      return { ...s, thresholds: newThresholds };
    });
  };

  const handleSave = async () => {
    try {
      // Sort thresholds descending by maxDistance before saving
      const sortedSettings = {
        ...settings,
        thresholds: [...settings.thresholds].sort((a, b) => b.maxDistance - a.maxDistance)
      };
      
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sortedSettings)
      });
      onSave(sortedSettings);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur z-10">
          <h2 className="text-xl font-bold">Oyun & Yakınlık Ayarları</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-zinc-200">Buluş Yarıçapı</h3>
            <p className="text-sm text-zinc-400 mb-4">Oyuncunun ödülü görebilmesi için hedefe ne kadar yaklaşması gerektiği (metre).</p>
            <input 
              type="number" 
              value={settings.rewardRadius}
              onChange={e => setSettings(s => ({ ...s, rewardRadius: parseFloat(e.target.value) || 0 }))}
              className="w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-200">Mesafe ve Renk Eşikleri</h3>
                <p className="text-sm text-zinc-400">Hangi mesafeden itibaren hangi renk/metin geçerli olacak. Oyun içindeki renkler bu eşikler arasında yumuşak geçiş yapacaktır.</p>
              </div>
              <button 
                onClick={addThreshold}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>

            <div className="space-y-3">
              {settings.thresholds.map((t, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1">Max Mesafe (m)</label>
                    <input 
                      type="number" 
                      value={t.maxDistance}
                      onChange={e => updateThreshold(i, "maxDistance", parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-xs text-zinc-500 mb-1">Metin</label>
                    <input 
                      type="text" 
                      value={t.text}
                      onChange={e => updateThreshold(i, "text", e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-zinc-500 mb-1">Renk</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={t.color}
                        onChange={e => updateThreshold(i, "color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-xs font-mono">{t.color}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeThreshold(i)}
                    className="self-end mb-1 p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
