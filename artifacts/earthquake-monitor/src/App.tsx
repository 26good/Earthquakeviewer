import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { initAudioContext } from './lib/audio';
import { useEarthquakes } from './hooks/use-earthquakes';
import { useEEW } from './hooks/use-eew';
import { useTsunami } from './hooks/use-tsunami';
import { EarthquakeMap } from './components/Map';
import {
  getScaleText,
  getMagColor,
  getDepthColor,
  getIntensityColor,
  getTsunamiGradeColor,
  getTsunamiGradeLabel,
} from './lib/utils-earthquake';

const queryClient = new QueryClient();

const formatClockTime = () =>
  new Date().toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const P_WAVE_SPEED = 6.0;
const S_WAVE_SPEED = 3.5;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const parseCoordinate = (value: string | number | undefined): number => {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const CITY_PRESETS = [
  { label: '札幌', lat: 43.0618, lng: 141.3545 },
  { label: '仙台', lat: 38.2688, lng: 140.8721 },
  { label: '東京', lat: 35.6895, lng: 139.6917 },
  { label: '横浜', lat: 35.4437, lng: 139.6380 },
  { label: '名古屋', lat: 35.1815, lng: 136.9066 },
  { label: '大阪', lat: 34.6937, lng: 135.5023 },
  { label: '広島', lat: 34.3853, lng: 132.4553 },
  { label: '福岡', lat: 33.5904, lng: 130.4017 },
  { label: '那覇', lat: 26.2124, lng: 127.6809 },
];

type UserLocation = { lat: number; lng: number; label?: string } | null;

// Load/save location from localStorage so it persists across reloads
const loadSavedLocation = (): UserLocation => {
  try {
    const s = localStorage.getItem('user_location_v1');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
};
const saveLocation = (loc: UserLocation) => {
  try {
    if (loc) localStorage.setItem('user_location_v1', JSON.stringify(loc));
    else localStorage.removeItem('user_location_v1');
  } catch {}
};

function Home() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(formatClockTime);
  const [userLocation, setUserLocation] = useState<UserLocation>(loadSavedLocation);
  const [settingLocation, setSettingLocation] = useState(false);
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const locationPanelRef = useRef<HTMLDivElement>(null);

  // Resume audio context on any interaction
  useEffect(() => {
    const resume = () => initAudioContext();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, []);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(formatClockTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close location panel when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationPanelRef.current && !locationPanelRef.current.contains(e.target as Node)) {
        if (!settingLocation) setShowLocationPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingLocation]);

  // Cancel location-setting mode with Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingLocation(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSoundToggle = () => {
    if (!isSoundEnabled) initAudioContext();
    setIsSoundEnabled(v => !v);
  };

  const handleSetUserLocation = useCallback((loc: UserLocation) => {
    setUserLocation(loc);
    saveLocation(loc);
    setSettingLocation(false);
    setShowLocationPanel(false);
  }, []);

  const handleCitySelect = (city: typeof CITY_PRESETS[number]) => {
    const loc = { lat: city.lat, lng: city.lng, label: city.label };
    handleSetUserLocation(loc);
  };

  const handleMapClick = () => {
    setSettingLocation(true);
    setShowLocationPanel(false);
  };

  const { history, selectedQuake, setSelectedQuake, lastUpdate } = useEarthquakes(isSoundEnabled);
  const { eew, status } = useEEW(isSoundEnabled);
  const { tsunami, lastTsunamiUpdate } = useTsunami(isSoundEnabled);

  const displayData = eew || selectedQuake;
  const isEEWMode = !!eew;
  const isWarning = eew?.Title?.includes('警報');

  const tsunamiLevel =
    tsunami?.areas.some(a => a.grade === 'MajorWarning') ? 'MajorWarning' :
    tsunami?.areas.some(a => a.grade === 'Warning') ? 'Warning' :
    tsunami?.areas.some(a => a.grade === 'Watch') ? 'Watch' : null;

  const currentMagnitude = isEEWMode
    ? parseFloat(eew.Magunitude || eew.Magnitude || '0')
    : selectedQuake?.earthquake.hypocenter.magnitude || 0;
  const currentDepth = isEEWMode
    ? parseInt(eew.Depth || '0')
    : selectedQuake?.earthquake.hypocenter.depth || 0;
  const currentIntensityColor = getIntensityColor(
    isEEWMode ? eew.MaxInt : selectedQuake?.earthquake.maxScale
  );
  const currentMagColor = getMagColor(currentMagnitude);
  const currentDepthColor = getDepthColor(currentDepth);

  // P/S wave radius display (updates via currentTime ticker in parent)
  let eewElapsedSec = 0;
  let pRadiusKm = 0;
  let sRadiusKm = 0;
  if (isEEWMode && eew) {
    const originTs = new Date(eew.OriginTime?.replace(/-/g, '/')).getTime();
    if (Number.isFinite(originTs)) {
      eewElapsedSec = Math.max(0, (Date.now() - originTs) / 1000);
      const depth = parseInt(eew.Depth || '0') || 0;
      pRadiusKm = Math.min(Math.sqrt(Math.max(0, (eewElapsedSec * P_WAVE_SPEED) ** 2 - depth ** 2)), 2500);
      sRadiusKm = Math.min(Math.sqrt(Math.max(0, (eewElapsedSec * S_WAVE_SPEED) ** 2 - depth ** 2)), 2500);
    }
  }

  // Countdown to user's location
  type Countdown = { pSec: number | null; sSec: number | null; distKm: number };
  let countdown: Countdown | null = null;
  if (isEEWMode && userLocation && eew) {
    const epiLat = parseCoordinate(eew.Latitude ?? eew.latitude);
    const epiLng = parseCoordinate(eew.Longitude ?? eew.longitude);
    if (epiLat !== 0 && epiLng !== 0) {
      const distKm = haversineKm(userLocation.lat, userLocation.lng, epiLat, epiLng);
      const originTs = new Date(eew.OriginTime?.replace(/-/g, '/')).getTime();
      const elapsedSec = Number.isFinite(originTs) ? Math.max(0, (Date.now() - originTs) / 1000) : 0;
      const pSec = Math.round(distKm / P_WAVE_SPEED - elapsedSec);
      const sSec = Math.round(distKm / S_WAVE_SPEED - elapsedSec);
      countdown = { pSec: pSec > 0 ? pSec : null, sSec: sSec > 0 ? sSec : null, distKm };
    }
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white dark">
      <EarthquakeMap
        currentQuake={selectedQuake}
        eew={eew}
        tsunami={tsunami}
        userLocation={userLocation}
        onSetUserLocation={handleSetUserLocation}
        settingLocation={settingLocation}
      />

      {/* Top-right buttons row */}
      <div className="absolute top-5 right-5 z-50 flex items-center gap-2">
        {/* Location button — always visible */}
        <div ref={locationPanelRef} className="relative">
          <button
            onClick={() => {
              if (settingLocation) { setSettingLocation(false); return; }
              setShowLocationPanel(v => !v);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 backdrop-blur-md border cursor-pointer
              ${settingLocation
                ? 'text-yellow-300 border-yellow-300 bg-yellow-300/10 animate-pulse'
                : userLocation
                  ? 'text-[#38bdf8] border-[#38bdf8]/60 bg-[#38bdf8]/10'
                  : 'text-[#a0a0a8] border-white/20 bg-black/50'}`}
          >
            📍 {settingLocation ? '地図をクリック...' : (userLocation?.label ?? (userLocation ? `${userLocation.lat.toFixed(2)},${userLocation.lng.toFixed(2)}` : '位置を設定'))}
          </button>

          {/* Location picker dropdown */}
          {showLocationPanel && !settingLocation && (
            <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-white/15 bg-[#141419]/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="mb-2 text-xs font-bold text-white/60">都市から選ぶ</div>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {CITY_PRESETS.map(city => (
                  <button
                    key={city.label}
                    className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer
                      ${userLocation?.label === city.label
                        ? 'bg-[#38bdf8]/30 text-[#38bdf8] border border-[#38bdf8]/40'
                        : 'bg-white/8 hover:bg-white/15 text-white/80'}`}
                    onClick={() => handleCitySelect(city)}
                  >
                    {city.label}
                  </button>
                ))}
              </div>
              <button
                className="w-full rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 px-3 py-2 text-xs font-bold text-[#38bdf8] hover:bg-[#38bdf8]/25 cursor-pointer mb-1"
                onClick={handleMapClick}
              >
                🗺 地図をクリックして設定
              </button>
              {userLocation && (
                <button
                  className="w-full rounded-lg bg-red-900/20 border border-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/40 cursor-pointer"
                  onClick={() => handleSetUserLocation(null)}
                >
                  位置をリセット
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sound toggle */}
        <button
          id="sound-toggle"
          onClick={handleSoundToggle}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 backdrop-blur-md border cursor-pointer
            ${isSoundEnabled
              ? 'text-white border-[#4cd0a7] bg-[#4cd0a7]/10 shadow-[0_0_10px_rgba(76,208,167,0.3)]'
              : 'text-[#a0a0a8] border-white/20 bg-black/50'}`}
        >
          {isSoundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
        </button>
      </div>

      {/* EEW P/S wave legend */}
      {isEEWMode && (
        <div className="wave-legend absolute top-20 right-5 z-50 rounded-2xl border border-white/10 bg-[#141419]/85 px-4 py-3 text-xs text-white/80 backdrop-blur-md shadow-2xl min-w-[175px]">
          <div className="mb-2 font-bold text-white/90">P波・S波 推定到達範囲</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-8 rounded-full border border-[#4cc9f0] shrink-0"></span>
            <span>P波 約 <b>{Math.round(pRadiusKm)}</b> km</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-8 rounded-full bg-[#f97316]/50 ring-1 ring-[#f97316] shrink-0"></span>
            <span>S波 約 <b>{Math.round(sRadiusKm)}</b> km</span>
          </div>
          <div className="text-white/40">経過 {Math.floor(eewElapsedSec)} 秒</div>

          {/* Countdown to user location */}
          {userLocation && countdown && (
            <div className="mt-3 border-t border-white/10 pt-2 space-y-0.5">
              <div className="text-white/70 mb-1 font-semibold">
                {userLocation.label ?? '設定地点'} まで
              </div>
              <div className="text-[#4cc9f0]">
                P波: {countdown.pSec !== null ? `約 ${countdown.pSec} 秒後` : '通過済み'}
              </div>
              <div className="text-[#f97316]">
                S波: {countdown.sSec !== null ? `約 ${countdown.sSec} 秒後` : '通過済み'}
              </div>
              <div className="text-white/35 pt-0.5">距離 {Math.round(countdown.distKm)} km</div>
            </div>
          )}
          {isEEWMode && !userLocation && (
            <div className="mt-2 text-white/35 text-[11px]">
              📍 位置を設定すると到達時刻を表示
            </div>
          )}
        </div>
      )}

      {/* Left panel */}
      <div className="ui-layer absolute top-5 left-5 w-[350px] h-[calc(100vh-40px)] z-50 flex flex-col gap-4 pointer-events-none">

        {displayData && (
          <div className={`rounded-xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/10 transition-colors duration-300 pointer-events-auto
            ${isEEWMode ? (isWarning ? 'bg-[#d33c30]/10' : 'bg-[#d37e30]/10') : 'bg-[#202434]'}`}
          >
            <div className="flex items-stretch text-base font-black">
              <div className={`flex-1 p-3 flex items-center justify-center text-white
                ${isEEWMode
                  ? (isWarning ? 'eew-warning-header tracking-wider' : 'eew-forecast-header tracking-wider')
                  : 'bg-[#3b5078]'}`}
              >
                {isEEWMode ? (eew.Title || '緊急地震速報') : 'ℹ 各地の震度情報'}
              </div>
              {isEEWMode && (
                <div className={`p-3 flex items-center justify-center text-white text-sm
                  ${isWarning ? 'bg-[#d93b3b]' : 'bg-[#d98c3b]'}`}
                >
                  第{eew.Serial || '1'}報
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="mb-4 flex flex-col-reverse">
                <div className="text-2xl font-black leading-tight">
                  {isEEWMode
                    ? (eew.Hypocenter && eew.Hypocenter.length > 0 ? eew.Hypocenter : '震源調査中')
                    : selectedQuake?.earthquake.hypocenter.name}
                  <span className="text-sm font-normal ml-2">
                    {isEEWMode ? 'で地震' : 'で地震がありました'}
                  </span>
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  {isEEWMode
                    ? `${eew.OriginTime || '--:--'} 発生`
                    : `${selectedQuake
                        ? new Date(selectedQuake.earthquake.time.replace(/-/g, '/')).toLocaleString('ja-JP', {
                            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })
                        : '--/-- --:--'} ごろ`}
                </div>
              </div>

              <div
                className="flex items-center justify-between p-3 rounded-lg mb-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300"
                style={{ backgroundColor: currentIntensityColor }}
              >
                <div className="text-lg font-black leading-tight">
                  {isEEWMode && <div className="text-sm">推定</div>}
                  最大震度
                </div>
                <div className="text-5xl font-sans font-black leading-none text-white">
                  {isEEWMode
                    ? (eew.MaxInt?.length > 0 ? eew.MaxInt.replace('弱', '-').replace('強', '+') : '?')
                    : (selectedQuake ? getScaleText(selectedQuake.earthquake.maxScale) : '-')}
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 font-bold text-base">
                <div>マグニチュード</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-sans font-normal" style={{ color: currentMagColor }}>
                    {isEEWMode
                      ? parseFloat(eew.Magunitude || eew.Magnitude || '0').toFixed(1)
                      : (selectedQuake && selectedQuake.earthquake.hypocenter.magnitude !== -1.0
                          ? selectedQuake.earthquake.hypocenter.magnitude.toFixed(1)
                          : '不明')}
                  </div>
                  <div className="w-2.5 h-[26px] rounded-sm"
                    style={{ backgroundColor: currentMagColor, boxShadow: `0 0 12px ${currentMagColor}` }} />
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 font-bold text-base">
                <div>深さ</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-sans font-normal flex items-baseline" style={{ color: currentDepthColor }}>
                    {isEEWMode
                      ? parseInt(eew.Depth || '0')
                      : (selectedQuake?.earthquake.hypocenter.depth === 0
                          ? 'ごく浅い'
                          : selectedQuake?.earthquake.hypocenter.depth || '--')}
                    <span className="text-sm ml-1">
                      {isEEWMode || (selectedQuake && selectedQuake.earthquake.hypocenter.depth !== 0) ? 'km' : ''}
                    </span>
                  </div>
                  <div className="w-2.5 h-[26px] rounded-sm"
                    style={{ backgroundColor: currentDepthColor, boxShadow: `0 0 12px ${currentDepthColor}` }} />
                </div>
              </div>

              <div
                className={`mt-4 font-bold text-[0.95rem] leading-snug rounded-lg p-3 text-center
                  ${isEEWMode ? 'text-[#f4d03f] text-left bg-transparent !p-0' : ''}`}
                style={isEEWMode ? undefined : (tsunamiLevel ? {
                  backgroundColor: getTsunamiGradeColor(tsunamiLevel),
                  color: tsunamiLevel === 'Watch' ? '#111827' : '#fff',
                  boxShadow: `0 0 18px ${getTsunamiGradeColor(tsunamiLevel)}55`,
                } : { backgroundColor: '#3c4961', color: '#fff' })}
              >
                {isEEWMode
                  ? (isWarning
                      ? '緊急地震速報（警報）発表\n強い揺れに警戒してください'
                      : '緊急地震速報（予報）発表\n今後の情報に注意してください')
                  : (tsunamiLevel ? `${getTsunamiGradeLabel(tsunamiLevel)} 発表中` : '津波の心配なし')}
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel flex-grow flex flex-col overflow-hidden min-h-0 p-3 rounded-xl pointer-events-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm m-0 text-[#a0a0a8]">地震履歴</h2>
            <span className="text-sm text-white">最終更新：{lastUpdate}</span>
          </div>
          <div className="history-list overflow-y-auto flex-grow flex flex-col gap-2 p-px custom-scrollbar">
            {history.map(eq => {
              const scale = eq.earthquake.maxScale;
              const timeStr = eq.earthquake.time.substring(5, 16).replace('-', '/');
              return (
                <div
                  key={eq.id}
                  className={`flex items-center bg-black/30 border border-white/5 rounded-lg p-2 gap-2 cursor-pointer transition-colors duration-200 flex-shrink-0 hover:bg-white/10
                    ${selectedQuake?.id === eq.id ? 'ring-1 ring-[#4cd0a7] bg-white/5' : ''}`}
                  onClick={() => setSelectedQuake(eq)}
                >
                  <div className={`min-w-[32px] h-[32px] rounded-full flex items-center justify-center font-mono text-base border-2 border-white/20 scale-${scale}`}>
                    {getScaleText(scale)}
                  </div>
                  <div className="flex flex-col flex-grow overflow-hidden">
                    <div className="text-[0.65rem] text-[#a0a0a8]">{timeStr}</div>
                    <div className="text-[0.85rem] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                      {eq.earthquake.hypocenter.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Clock */}
      <div className="current-time-panel absolute top-5 left-[390px] z-50 rounded-xl border border-white/10 bg-[#141419]/85 px-4 py-3 text-white backdrop-blur-md shadow-2xl">
        <div className="text-sm font-bold text-white">現在時刻</div>
        <div className="text-sm text-white">{currentTime}</div>
      </div>

      {/* Tsunami panel — hidden when EEW wave legend is showing (right side conflict) */}
      {tsunami && tsunami.areas.length > 0 && (
        <div
          className={`tsunami-panel absolute top-20 right-5 z-50 w-[360px] max-w-[calc(100vw-40px)] rounded-2xl border bg-[#141419]/92 p-4 text-white backdrop-blur-md shadow-2xl
            ${isEEWMode ? 'hidden' : ''}`}
          style={{ borderColor: tsunamiLevel ? `${getTsunamiGradeColor(tsunamiLevel)}55` : 'rgba(255,255,255,0.15)' }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black" style={{ color: tsunamiLevel ? getTsunamiGradeColor(tsunamiLevel) : '#fff' }}>
                {tsunamiLevel ? getTsunamiGradeLabel(tsunamiLevel) : '津波情報'} 発表中
              </div>
              <div className="text-xs text-white/60">最終更新：{lastTsunamiUpdate}</div>
            </div>
          </div>
          <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {tsunami.areas.map(area => {
              const arrived = area.immediate;
              return (
                <div
                  key={`${area.name}-${area.grade}`}
                  className="rounded-lg border border-white/10 bg-black/35 p-2"
                  style={arrived ? { borderColor: `${getTsunamiGradeColor(area.grade)}88` } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{area.name}</span>
                    <div className="flex items-center gap-1">
                      {arrived && (
                        <span className="rounded px-2 py-0.5 text-xs font-black bg-white text-black animate-pulse">
                          到達済み
                        </span>
                      )}
                      <span
                        className="rounded px-2 py-0.5 text-xs font-black"
                        style={{
                          backgroundColor: getTsunamiGradeColor(area.grade),
                          color: area.grade === 'Watch' ? '#111827' : '#fff',
                        }}
                      >
                        {getTsunamiGradeLabel(area.grade)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-white/75">
                    {arrived
                      ? '津波到達中 / '
                      : `到達予想：${area.firstHeight?.condition || area.firstHeight?.arrivalTime || '調査中'} / `}
                    高さ：{area.maxHeight?.description || '不明'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="status-bar absolute bottom-5 right-5 z-50 bg-[#141419]/85 backdrop-blur-md px-4 py-2 rounded-full text-xs text-[#a0a0a8]">
        {status} | Ver 1.4.0
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
