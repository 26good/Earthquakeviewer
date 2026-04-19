import React from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from 'react';
import NotFound from "@/pages/not-found";
import { initAudioContext } from './lib/audio';
import { useEarthquakes } from './hooks/use-earthquakes';
import { useEEW } from './hooks/use-eew';
import { EarthquakeMap } from './components/Map';
import { getScaleText, getMagColor, getDepthColor, getIntensityColor } from './lib/utils-earthquake';

const queryClient = new QueryClient();

function Home() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  
  useEffect(() => {
    initAudioContext();
  }, []);
  
  const handleSoundToggle = () => {
    if (!isSoundEnabled) {
      initAudioContext();
    }
    setIsSoundEnabled(!isSoundEnabled);
  };

  const { history, selectedQuake, setSelectedQuake, lastUpdate, version } = useEarthquakes(isSoundEnabled);
  const { eew, status } = useEEW(isSoundEnabled);

  const displayData = eew || selectedQuake;
  const isEEWMode = !!eew;
  
  const isWarning = eew?.Title?.includes('警報');
  const currentMagnitude = isEEWMode
    ? parseFloat(eew.Magunitude || eew.Magnitude || "0")
    : selectedQuake?.earthquake.hypocenter.magnitude || 0;
  const currentDepth = isEEWMode
    ? parseInt(eew.Depth || "0")
    : selectedQuake?.earthquake.hypocenter.depth || 0;
  const currentIntensityColor = getIntensityColor(
    isEEWMode ? eew.MaxInt : selectedQuake?.earthquake.maxScale
  );
  const currentMagColor = getMagColor(currentMagnitude);
  const currentDepthColor = getDepthColor(currentDepth);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white dark">
      <EarthquakeMap currentQuake={selectedQuake} eew={eew} />

      <button 
        id="sound-toggle" 
        onClick={handleSoundToggle}
        className={`absolute top-5 right-5 z-50 rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 backdrop-blur-md border cursor-pointer
          ${isSoundEnabled 
            ? 'text-white border-[#4cd0a7] bg-[#4cd0a7]/10 shadow-[0_0_10px_rgba(76,208,167,0.3)]' 
            : 'text-[#a0a0a8] border-white/20 bg-black/50'}`}
      >
        {isSoundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
      </button>

      {isEEWMode && (
        <div className="wave-legend absolute top-20 right-5 z-50 rounded-2xl border border-white/10 bg-[#141419]/85 px-4 py-3 text-xs text-white/80 backdrop-blur-md shadow-2xl">
          <div className="mb-2 font-bold text-white">P波・S波 推定到達範囲</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-8 rounded-full border border-[#4cc9f0]"></span>
            <span>P波</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-8 rounded-full bg-[#f97316]/50 ring-1 ring-[#f97316]"></span>
            <span>S波</span>
          </div>
        </div>
      )}

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
                {isEEWMode ? eew.Title || "緊急地震速報" : "ℹ 各地の震度情報"}
              </div>
              {isEEWMode && (
                <div className={`p-3 flex items-center justify-center text-white text-sm
                  ${isWarning ? 'bg-[#d93b3b]' : 'bg-[#d98c3b]'}`}
                >
                  第{eew.Serial || "1"}報
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="mb-4 flex flex-col-reverse">
                <div className="text-2xl font-black leading-tight">
                  {isEEWMode ? eew.Hypocenter || "不明" : selectedQuake?.earthquake.hypocenter.name}
                  <span className="text-sm font-normal ml-2">{isEEWMode ? "で地震" : "で地震がありました"}</span>
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  {isEEWMode ? `${eew.OriginTime} 発生` : `${selectedQuake ? new Date(selectedQuake.earthquake.time).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--/-- --:--'} ごろ`}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg mb-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300"
                style={{ backgroundColor: currentIntensityColor }}
              >
                <div className="text-lg font-black leading-tight">
                  {isEEWMode && <div className="text-sm">推定</div>}
                  最大震度
                </div>
                <div className="text-5xl font-sans font-black leading-none text-white">
                  {isEEWMode ? (eew.MaxInt || "-") : (selectedQuake ? getScaleText(selectedQuake.earthquake.maxScale) : "-")}
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 font-bold text-base">
                <div>マグニチュード</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-sans font-normal transition-colors duration-300" style={{ color: currentMagColor }}>
                    {isEEWMode 
                      ? parseFloat(eew.Magunitude || eew.Magnitude || "0").toFixed(1) 
                      : (selectedQuake && selectedQuake.earthquake.hypocenter.magnitude !== -1.0 ? selectedQuake.earthquake.hypocenter.magnitude.toFixed(1) : "不明")}
                  </div>
                  <div className="w-2.5 h-[26px] rounded-sm transition-colors duration-300" 
                    style={{ backgroundColor: currentMagColor, boxShadow: `0 0 12px ${currentMagColor}` }}>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 font-bold text-base">
                <div>深さ</div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-sans font-normal flex items-baseline transition-colors duration-300" style={{ color: currentDepthColor }}>
                    {isEEWMode 
                      ? parseInt(eew.Depth || "0") 
                      : (selectedQuake?.earthquake.hypocenter.depth === 0 ? "ごく浅い" : selectedQuake?.earthquake.hypocenter.depth || "--")}
                    <span className="text-sm ml-1">{isEEWMode || (selectedQuake && selectedQuake.earthquake.hypocenter.depth !== 0) ? "km" : ""}</span>
                  </div>
                  <div className="w-2.5 h-[26px] rounded-sm transition-colors duration-300" 
                    style={{ backgroundColor: currentDepthColor, boxShadow: `0 0 12px ${currentDepthColor}` }}>
                  </div>
                </div>
              </div>

              <div className={`mt-4 font-bold text-[0.95rem] leading-snug rounded-lg
                ${isEEWMode 
                  ? 'text-[#f4d03f] text-left' 
                  : 'bg-[#3c4961] text-white text-center p-3'}`}
              >
                {isEEWMode 
                  ? (isWarning ? "緊急地震速報（警報）発表\n強い揺れに警戒してください" : "緊急地震速報（予報）発表\n今後の情報に注意してください")
                  : (selectedQuake?.earthquake.domesticTsunami === "None" ? "津波の心配なし" : "津波警報・注意報発令中")}
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel flex-grow flex flex-col overflow-hidden min-h-0 p-3 rounded-xl pointer-events-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm m-0 text-[#a0a0a8]">地震履歴</h2>
            <span className="text-xs text-[#4cd0a7] font-mono">{lastUpdate}</span>
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

      <div className="status-bar absolute bottom-5 right-5 z-50 bg-[#141419]/85 backdrop-blur-md px-4 py-2 rounded-full text-xs text-[#a0a0a8] transition-colors duration-300">
        {status} | Ver {version}
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
