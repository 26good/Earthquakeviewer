import { useEffect, useRef, useState } from 'react';
import { TsunamiInfo } from '../lib/utils-earthquake';
import { initAudioContext, playSound } from '../lib/audio';

export const useTsunami = (isSoundEnabled: boolean) => {
  const [tsunami, setTsunami] = useState<TsunamiInfo | null>(null);
  const [lastTsunamiUpdate, setLastTsunamiUpdate] = useState<string>('--:--:--');
  const lastAlertIdRef = useRef<string | null>(null);

  const fetchTsunami = async () => {
    try {
      const res = await fetch('https://api.p2pquake.net/v2/history?codes=552&limit=10');
      const list: TsunamiInfo[] = await res.json();
      const active = list.find(item => !item.cancelled && item.areas?.length > 0) || null;
      setTsunami(active);
      setLastTsunamiUpdate(new Date().toLocaleTimeString('ja-JP', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));

      if (active && active.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = active.id;
        if (isSoundEnabled) {
          initAudioContext();
          playSound.tsunamiDanger();
        }
      }
    } catch (e) {
      console.error('Error fetching tsunami information:', e);
    }
  };

  useEffect(() => {
    fetchTsunami();
    const interval = setInterval(fetchTsunami, 3000);
    return () => clearInterval(interval);
  }, [isSoundEnabled]);

  return { tsunami, lastTsunamiUpdate };
};
