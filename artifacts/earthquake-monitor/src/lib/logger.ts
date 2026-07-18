export type LogEntry = {
  id: number;
  time: string;
  category: 'EEW' | 'QUAKE' | 'TSUNAMI' | 'SBX' | 'AUDIO' | 'NOTIF' | 'SYSTEM' | 'TEST';
  message: string;
};

const CAT_COLORS: Record<LogEntry['category'], string> = {
  EEW: '#38bdf8',
  QUAKE: '#4ade80',
  TSUNAMI: '#f87171',
  SBX: '#fbbf24',
  AUDIO: '#a78bfa',
  NOTIF: '#f472b6',
  SYSTEM: '#94a3b8',
  TEST: '#fb923c',
};

const eventTarget = new EventTarget();
let _id = 0;

export const getCategoryColor = (cat: LogEntry['category']) => CAT_COLORS[cat];

export const log = (category: LogEntry['category'], message: string) => {
  const entry: LogEntry = {
    id: ++_id,
    time: new Date().toLocaleTimeString('ja-JP', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    category,
    message,
  };
  eventTarget.dispatchEvent(new CustomEvent('app-log', { detail: entry }));
};

export const subscribeLogs = (handler: (entry: LogEntry) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent<LogEntry>).detail);
  eventTarget.addEventListener('app-log', listener);
  return () => eventTarget.removeEventListener('app-log', listener);
};
