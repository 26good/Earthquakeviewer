import { useState, useEffect } from 'react';
import { EEWData } from '../lib/utils-earthquake';
import { playSound } from '../lib/audio';

export const useEEW = (isSoundEnabled: boolean) => {
  const [eew, setEEW] = useState<EEWData | null>(null);
  const [status, setStatus] = useState<string>('Connecting...');

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;
    let keepAliveTimer: NodeJS.Timeout;
    let fallbackTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket('wss://ws-api.wolfx.jp/jma_eew');
      
      ws.onopen = () => {
        setStatus('System Online / EEW Connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'jma_eew' && !data.isCancel) {
            if (isSoundEnabled) {
              if (data.isFinal) playSound.final();
              else playSound.update();
            }
            setEEW(data);
            
            // Clear EEW after 3 minutes if no new updates
            clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(() => setEEW(null), 180000);
          }
        } catch (e) {
          console.error('EEW Parse Error:', e);
        }
      };
      
      ws.onclose = () => {
        setStatus('Connection Lost. Reconnecting...');
        reconnectTimer = setTimeout(connect, 5000);
      };

      keepAliveTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      clearTimeout(fallbackTimer);
      clearInterval(keepAliveTimer);
      if (ws) ws.close();
    };
  }, [isSoundEnabled]);

  return { eew, status };
};
