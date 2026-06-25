import { useState, useEffect, useRef } from 'react';
import { EarthquakeHistoryItem } from '../lib/utils-earthquake';
import { playSound } from '../lib/audio';

const POLL_BASE_MS = 15000;
const POLL_MAX_MS = 120000;

const formatLastUpdateTime = () =>
  new Date().toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// Exponential backoff with ±20% jitter to avoid thundering herd
const backoffMs = (attempt: number, base: number, max: number) => {
  const delay = Math.min(base * 2 ** attempt, max);
  return delay * (0.8 + Math.random() * 0.4);
};

export const useEarthquakes = (isSoundEnabled: boolean) => {
  const [history, setHistory] = useState<EarthquakeHistoryItem[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<EarthquakeHistoryItem | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  const lastQuakeIdRef = useRef<string | null>(null);
  const errorCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=20');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list: EarthquakeHistoryItem[] = await res.json();

        const validQuakes = list.filter(eq =>
          eq.earthquake?.hypocenter?.name &&
          eq.earthquake.hypocenter.name !== '不明' &&
          eq.earthquake.hypocenter.magnitude !== -1.0 &&
          eq.points?.length > 0
        );

        if (validQuakes.length > 0) {
          const newQuakeId = validQuakes[0].id;
          const isNew = lastQuakeIdRef.current && newQuakeId !== lastQuakeIdRef.current;

          if (isNew && isSoundEnabled) {
            if (validQuakes[0].earthquake.maxScale >= 50) {
              playSound.alert();
            } else {
              playSound.detect();
            }
          }

          if (isNew || !lastQuakeIdRef.current) {
            setSelectedQuake(validQuakes[0]);
          }

          lastQuakeIdRef.current = newQuakeId;
          setHistory(validQuakes.slice(0, 10));
        }

        setLastUpdate(formatLastUpdateTime());
        // Success: reset error counter, schedule next poll at normal interval
        errorCountRef.current = 0;
        if (!cancelled) {
          timerRef.current = setTimeout(fetchHistory, backoffMs(0, POLL_BASE_MS, POLL_BASE_MS));
        }
      } catch {
        // Error: exponential backoff
        errorCountRef.current += 1;
        const delay = backoffMs(errorCountRef.current - 1, POLL_BASE_MS, POLL_MAX_MS);
        if (!cancelled) {
          timerRef.current = setTimeout(fetchHistory, delay);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isSoundEnabled]);

  return { history, selectedQuake, setSelectedQuake, lastUpdate };
};
