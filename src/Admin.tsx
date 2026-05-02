import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, MapPin, X, Settings as SettingsIcon } from "lucide-react";
import CesiumMap from "./CesiumMap";
import SettingsModal, { Settings } from "./SettingsModal";

interface Team {
  name: string;
  lat: number;
  lng: number;
  reward: string;
}

export default function Admin() {
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [settings, setSettings] = useState<Settings>({ rewardRadius: 15, thresholds: [] });
  const [loading, setLoading] = useState(true);
  
  // Form & Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    lat: 41.0082,
    lng: 28.9784,
    reward: ""
  });

  const fetchData = async () => {
    try {
      const [teamsRes, settingsRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/settings")
      ]);
      setTeams(await teamsRes.json());
      setSettings(await settingsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingCode(null);
    setFormData({ code: "", name: "", lat: 41.0082, lng: 28.9784, reward: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (code: string, team: Team) => {
    setEditingCode(code);
    setFormData({ code, ...team });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.reward) return;

    try {
      const method = editingCode ? "PUT" : "POST";
      const url = editingCode ? `/api/teams/${editingCode}` : "/api/teams";

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      await fetchData();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`${code} takımını silmek istediğinize emin misiniz?`)) return;
    try {
      await fetch(`/api/teams/${code}`, { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <SettingsIcon className="w-5 h-5" /> Genel Ayarlar
            </button>
            <button 
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" /> Yeni Takım
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {Object.entries(teams).map(([code, team]) => (
            <div key={code} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-zinc-800 text-xs px-2 py-1 rounded font-mono text-zinc-300">{code}</span>
                  <h3 className="text-lg font-bold">{team.name}</h3>
                </div>
                <p className="text-sm text-zinc-400 mb-2">{team.reward}</p>
                <div className="flex items-center gap-1 text-xs text-blue-400 font-mono">
                  <MapPin className="w-3 h-3" />
                  {team.lat.toFixed(5)}, {team.lng.toFixed(5)}
                </div>
              </div>
              <div className="flex gap-2 self-end md:self-auto">
                <button 
                  onClick={() => openEditModal(code, team)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(code)}
                  className="p-2 bg-red-900/50 text-red-400 hover:bg-red-900 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {Object.keys(teams).length === 0 && (
            <div className="text-center text-zinc-500 py-12">Henüz takım eklenmemiş.</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-[95vw] max-w-7xl h-[95vh] flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur z-10">
              <h2 className="text-xl font-bold">{editingCode ? "Takımı Düzenle" : "Yeni Takım Ekle"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex flex-col md:flex-row gap-6 flex-1 min-h-0">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Takım Kodu</label>
                  <input 
                    type="text" 
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    disabled={!!editingCode}
                    placeholder="Örn: KIRMIZI-KARTAL"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Takım Adı</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Örn: Kırmızı Kartallar"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Ödül Tarifi</label>
                  <textarea 
                    value={formData.reward}
                    onChange={e => setFormData({...formData, reward: e.target.value})}
                    placeholder="Örn: Sahne arkasındaki koltukların altı"
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Enlem (Lat)</label>
                    <input 
                      type="number" 
                      value={formData.lat}
                      onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Boylam (Lng)</label>
                    <input 
                      type="number" 
                      value={formData.lng}
                      onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex-[2] min-h-[400px] h-full border border-zinc-800 rounded-xl relative">
                <div className="absolute top-2 left-2 z-10 bg-black/80 px-3 py-2 rounded-lg text-sm pointer-events-none border border-zinc-700">
                  Haritadan konum seçmek için tıklayın
                </div>
                {isModalOpen && (
                  <CesiumMap 
                    onLocationSelect={handleLocationSelect} 
                    defaultLat={formData.lat} 
                    defaultLng={formData.lng} 
                    settings={settings}
                  />
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <button 
                onClick={() => setIsModalOpen(false)}
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
      )}

      {isSettingsOpen && (
        <SettingsModal 
          initialSettings={settings} 
          onClose={() => setIsSettingsOpen(false)} 
          onSave={(newSettings) => {
            setSettings(newSettings);
            setIsSettingsOpen(false);
          }} 
        />
      )}
    </div>
  );
}
