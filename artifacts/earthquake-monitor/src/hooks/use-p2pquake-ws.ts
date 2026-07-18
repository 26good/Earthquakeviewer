import { useState, useEffect, useRef, useCallback } from 'react';
import { EEWData, EarthquakeHistoryItem, TsunamiInfo } from '../lib/utils-earthquake';
import { initAudioContext, playSound } from '../lib/audio';

const SBX_URL = 'wss://api-realtime-sandbox.p2pquake.net/v2/ws';

const SCALE_MAP: Record<number, string> = {
  10: '1', 20: '2', 30: '3', 40: '4',
  45: '5弱', 50: '5強', 55: '6弱', 60: '6強', 70: '7',
};

const scaleToMaxInt = (scale: number): string => SCALE_MAP[scale] ?? '不明';

const convertEEW = (msg: Record<string, unknown>): EEWData | null => {
  try {
    const earthquake = msg.earthquake as Record<string, unknown> | undefined;
    const issue = msg.issue as Record<string, unknown> | undefined;
    const hypo = earthquake?.hypocenter as Record<string, unknown> | undefined;

    const isCancel = !!(msg.cancelled) || issue?.type === 'Cancel';
    const isWarning = issue?.type === 'Warning';
    const maxScale = typeof earthquake?.maxScale === 'number' ? earthquake.maxScale : 0;

    return {
      type: 'jma_eew',
      isCancel,
      isFinal: isCancel,
      Title: isWarning ? '緊急地震速報（警報）' : '緊急地震速報（予報）',
      Hypocenter: typeof hypo?.name === 'string' ? hypo.name : '不明',
      OriginTime: typeof earthquake?.time === 'string' ? earthquake.time : String(msg.time ?? ''),
      MaxInt: scaleToMaxInt(maxScale),
      Magnitude: String(hypo?.magnitude ?? ''),
      Latitude: typeof hypo?.latitude === 'number' ? hypo.latitude : undefined,
      Longitude: typeof hypo?.longitude === 'number' ? hypo.longitude : undefined,
      Depth: String(hypo?.depth ?? ''),
      Serial: typeof issue?.serial === 'string' ? issue.serial : '1',
    };
  } catch {
    return null;
  }
};

type SandboxStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SandboxState = {
  eew: EEWData | null;
  history: EarthquakeHistoryItem[];
  selectedQuake: EarthquakeHistoryItem | null;
  tsunami: TsunamiInfo | null;
  sbxStatus: SandboxStatus;
  setSelectedQuake: (q: EarthquakeHistoryItem | null) => void;
};

export const useP2PQuakeWS = (enabled: boolean, isSoundEnabled: boolean): SandboxState => {
  const [eew, setEEW] = useState<EEWData | null>(null);
  const [history, setHistory] = useState<EarthquakeHistoryItem[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<EarthquakeHistoryItem | null>(null);
  const [tsunami, setTsunami] = useState<TsunamiInfo | null>(null);
  const [sbxStatus, setSbxStatus] = useState<SandboxStatus>('disconnected');

  const soundRef = useRef(isSoundEnabled);
  soundRef.current = isSoundEnabled;

  const lastEEWSerialRef = useRef<string | null>(null);
  const lastQuakeIdRef = useRef<string | null>(null);
  const lastTsunamiIdRef = useRef<string | null>(null);
  const eewClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snd = useCallback((fn: () => void) => {
    if (soundRef.current) { initAudioContext(); fn(); }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setEEW(null);
      setHistory([]);
      setSelectedQuake(null);
      setTsunami(null);
      setSbxStatus('disconnected');
      lastEEWSerialRef.current = null;
      lastQuakeIdRef.current = null;
      lastTsunamiIdRef.current = null;
      if (eewClearTimerRef.current) clearTimeout(eewClearTimerRef.current);
      return;
    }

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setSbxStatus('connecting');
      ws = new WebSocket(SBX_URL);

      ws.onopen = () => {
        setSbxStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const code = msg.code as number;

          if (code === 556) {
            const converted = convertEEW(msg);
            if (!converted) return;

            if (converted.isCancel) {
              setEEW(null);
              lastEEWSerialRef.current = null;
              if (eewClearTimerRef.current) clearTimeout(eewClearTimerRef.current);
              snd(playSound.end);
              return;
            }

            const isNew = converted.Serial !== lastEEWSerialRef.current;
            if (isNew) {
              const isWarn = converted.Title?.includes('警報');
              if (isWarn) {
                snd(playSound.alert);
              } else if (!lastEEWSerialRef.current) {
                snd(playSound.detect);
              } else {
                snd(playSound.update);
              }
            }

            lastEEWSerialRef.current = converted.Serial;
            setEEW(converted);

            if (eewClearTimerRef.current) clearTimeout(eewClearTimerRef.current);
            eewClearTimerRef.current = setTimeout(() => {
              setEEW(null);
              lastEEWSerialRef.current = null;
            }, 3 * 60 * 1000);
          }

          if (code === 551) {
            const quake = msg as unknown as EarthquakeHistoryItem;
            if (!quake.earthquake?.hypocenter?.name ||
                quake.earthquake.hypocenter.name === '不明' ||
                quake.earthquake.hypocenter.magnitude === -1.0 ||
                !quake.points?.length) return;

            const isNew = quake.id !== lastQuakeIdRef.current;
            if (isNew) {
              if (quake.earthquake.maxScale >= 50) {
                snd(playSound.alert);
              } else {
                snd(playSound.detect);
              }
              lastQuakeIdRef.current = quake.id;
              setSelectedQuake(quake);
            }

            setHistory(prev => {
              const exists = prev.some(q => q.id === quake.id);
              if (exists) return prev;
              return [quake, ...prev].slice(0, 10);
            });
          }

          if (code === 552) {
            const info = msg as unknown as TsunamiInfo;
            if (info.cancelled || !info.areas?.length) {
              setTsunami(null);
              lastTsunamiIdRef.current = null;
              return;
            }
            if (info.id !== lastTsunamiIdRef.current) {
              lastTsunamiIdRef.current = info.id;
              setTsunami(info);
              const hasMajor = info.areas.some(a => a.grade === 'MajorWarning');
              const hasWarn = info.areas.some(a => a.grade === 'Warning');
              if (hasMajor) snd(playSound.tsunamiDanger);
              else if (hasWarn) snd(playSound.alert);
              else snd(playSound.caution);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setSbxStatus('error');
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        setSbxStatus('error');
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (eewClearTimerRef.current) clearTimeout(eewClearTimerRef.current);
      if (ws) ws.close();
    };
  }, [enabled, snd]);

  return { eew, history, selectedQuake, tsunami, sbxStatus, setSelectedQuake };
};
