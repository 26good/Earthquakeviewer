import { useState, useRef, useCallback } from 'react';
import { EEWData, EarthquakeHistoryItem, TsunamiInfo } from '../lib/utils-earthquake';
import { initAudioContext, playSound } from '../lib/audio';
import { log } from '../lib/logger';

const LAT = 39.8;
const LNG = 143.2;

const fmt = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const makeEEW = (serial: number, mag: string, maxInt: string, warning: boolean, final: boolean, originTime: string): EEWData => ({
  type: 'jma_eew',
  isCancel: false,
  isFinal: final,
  Title: warning ? '緊急地震速報（警報）' : '緊急地震速報（予報）',
  Hypocenter: '三陸沖',
  OriginTime: originTime,
  MaxInt: maxInt,
  Magnitude: mag,
  Latitude: LAT,
  Longitude: LNG,
  Depth: '10',
  Serial: serial.toString(),
});

const makeQuake = (originTime: string): EarthquakeHistoryItem => ({
  id: `test-${Date.now()}`,
  time: originTime,
  earthquake: {
    time: originTime,
    hypocenter: { name: '三陸沖', latitude: LAT, longitude: LNG, depth: 10, magnitude: 7.4 },
    maxScale: 60,
    domesticTsunami: 'Warning',
  },
  points: [
    { pref: '岩手県', addr: '岩手県沿岸北部', isArea: false, scale: 60 },
    { pref: '宮城県', addr: '宮城県北部', isArea: false, scale: 55 },
    { pref: '青森県', addr: '青森県三八上北', isArea: false, scale: 50 },
    { pref: '秋田県', addr: '秋田県沿岸北部', isArea: false, scale: 45 },
    { pref: '山形県', addr: '山形県村山', isArea: false, scale: 40 },
    { pref: '福島県', addr: '福島県中通り', isArea: false, scale: 30 },
    { pref: '北海道', addr: '十勝地方中部', isArea: false, scale: 30 },
  ],
});

const makeTsunami = (grade: 'Watch' | 'Warning' | 'MajorWarning'): TsunamiInfo => ({
  id: `test-tsunami-${Date.now()}`,
  code: 552,
  cancelled: false,
  time: new Date().toISOString(),
  issue: { source: '気象庁', time: new Date().toISOString(), type: 'Focus' },
  areas: grade === 'MajorWarning' ? [
    { name: '岩手県', grade: 'MajorWarning', immediate: false, firstHeight: { arrivalTime: '約15分後' }, maxHeight: { description: '５ｍ以上', value: 5 } },
    { name: '青森県太平洋沿岸', grade: 'Warning', immediate: false, firstHeight: { arrivalTime: '約20分後' }, maxHeight: { description: '３ｍ', value: 3 } },
    { name: '宮城県', grade: 'Watch', immediate: false, firstHeight: { arrivalTime: '約25分後' }, maxHeight: { description: '１ｍ未満', value: 0.5 } },
  ] : grade === 'Warning' ? [
    { name: '岩手県', grade: 'Warning', immediate: false, firstHeight: { arrivalTime: '約20分後' }, maxHeight: { description: '３ｍ', value: 3 } },
    { name: '青森県太平洋沿岸', grade: 'Watch', immediate: false, firstHeight: { arrivalTime: '約25分後' }, maxHeight: { description: '１ｍ未満', value: 0.5 } },
  ] : [
    { name: '岩手県', grade: 'Watch', immediate: false, firstHeight: { arrivalTime: '約25分後' }, maxHeight: { description: '１ｍ未満', value: 0.5 } },
    { name: '宮城県', grade: 'Watch', immediate: false, firstHeight: { arrivalTime: '約30分後' }, maxHeight: { description: '１ｍ未満', value: 0.5 } },
  ],
});

export const PHASE_LABELS = [
  '',
  '第1報 受信',
  '第2報 更新',
  '警報発令',
  '警報継続',
  '最終報',
  '地震確定',
  '津波注意報',
  '津波警報',
  '大津波警報',
];

export const TEST_TOTAL_PHASES = 9;
export const TEST_TOTAL_SEC = 170;

export const useTestMode = () => {
  const [isTestMode, setIsTestMode] = useState(false);
  const [testEEW, setTestEEW] = useState<EEWData | null>(null);
  const [testQuake, setTestQuake] = useState<EarthquakeHistoryItem | null>(null);
  const [testTsunami, setTestTsunami] = useState<TsunamiInfo | null>(null);
  const [testPhase, setTestPhase] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const soundRef = useRef(true);

  const stop = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setIsTestMode(false);
    setTestEEW(null);
    setTestQuake(null);
    setTestTsunami(null);
    setTestPhase(0);
    log('TEST', '[テスト] レプレイ終了');
  }, []);

  const start = useCallback((soundEnabled: boolean) => {
    soundRef.current = soundEnabled;
    const origin = new Date();
    const originStr = fmt(origin);

    setIsTestMode(true);
    setTestPhase(0);
    setTestEEW(null);
    setTestQuake(null);
    setTestTsunami(null);
    timersRef.current.forEach(clearTimeout);

    const snd = (fn: () => void) => {
      if (soundRef.current) { initAudioContext(); fn(); }
    };

    const timeline: { delay: number; fn: () => void }[] = [
      { delay: 0, fn: () => {
        setTestEEW(makeEEW(1, '6.5', '4', false, false, originStr));
        setTestPhase(1);
        snd(playSound.caution);
        log('TEST', `[テスト] 第1報 三陸沖 M6.5 予報受信`);
      }},
      { delay: 7000, fn: () => {
        setTestEEW(makeEEW(2, '7.1', '5弱', false, false, originStr));
        setTestPhase(2);
        snd(playSound.update);
      }},
      { delay: 14000, fn: () => {
        setTestEEW(makeEEW(3, '7.3', '5強', true, false, originStr));
        setTestPhase(3);
        snd(playSound.alert);
        log('TEST', `[テスト] 第3報 警報発令 M7.3 警報`);
      }},
      { delay: 22000, fn: () => {
        setTestEEW(makeEEW(4, '7.4', '6弱', true, false, originStr));
        setTestPhase(4);
        snd(playSound.update);
        log('TEST', `[テスト] 第4報 警報継続 M7.4`);
      }},
      { delay: 33000, fn: () => {
        setTestEEW(makeEEW(5, '7.4', '6強', true, true, originStr));
        setTestPhase(5);
        snd(playSound.end);
        log('TEST', `[テスト] 最終報 結局 M7.4 震度6強`);
      }},
      { delay: 50000, fn: () => {
        setTestEEW(null);
        setTestQuake(makeQuake(originStr));
        setTestPhase(6);
        log('TEST', `[テスト] 地震確定 三陸沖 M7.4 最大震度6強`);
      }},
      { delay: 65000, fn: () => {
        setTestTsunami(makeTsunami('Watch'));
        setTestPhase(7);
        snd(playSound.caution);
        log('TEST', `[テスト] 津波注意報 発令`);
      }},
      { delay: 80000, fn: () => {
        setTestTsunami(makeTsunami('Warning'));
        setTestPhase(8);
        snd(playSound.alert);
        log('TEST', `[テスト] 津波警報 発令`);
      }},
      { delay: 95000, fn: () => {
        setTestTsunami(makeTsunami('MajorWarning'));
        setTestPhase(9);
        snd(playSound.tsunamiDanger);
        log('TEST', `[テスト] 大津波警報 発令 岩手青森`);
      }},
      { delay: TEST_TOTAL_SEC * 1000, fn: stop },
    ];

    timersRef.current = timeline.map(({ delay, fn }) => setTimeout(fn, delay));
  }, [stop]);

  const toggle = useCallback((soundEnabled: boolean) => {
    if (isTestMode) stop(); else start(soundEnabled);
  }, [isTestMode, start, stop]);

  return { isTestMode, testEEW, testQuake, testTsunami, testPhase, toggle, stop };
};
