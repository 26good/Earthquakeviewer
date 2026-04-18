export type EarthquakeHistoryItem = {
  id: string;
  time: string;
  earthquake: {
    time: string;
    hypocenter: {
      name: string;
      latitude: number;
      longitude: number;
      depth: number;
      magnitude: number;
    };
    maxScale: number;
    domesticTsunami: string;
  };
  points: {
    pref: string;
    addr: string;
    isArea: boolean;
    scale: number;
  }[];
};

export type EEWData = {
  type: string;
  isCancel: boolean;
  isFinal: boolean;
  Title: string;
  Hypocenter: string;
  OriginTime: string;
  MaxInt: string;
  Magunitude?: string;
  Magnitude?: string;
  Depth: string;
  Serial: string;
};

export const getScaleText = (scale: number) => {
  const map: Record<number, string> = {
    10: '1', 20: '2', 30: '3', 40: '4', 45: '5-', 50: '5+', 55: '6-', 60: '6+', 70: '7'
  };
  return map[scale] || '?';
};

export const getMagColor = (mag: number) => {
  if (mag >= 6.0) return '#e54d42'; 
  if (mag >= 4.0) return '#f39c12'; 
  return '#559dd6'; 
};

export const getDepthColor = (depth: number | string) => {
  if (depth === "ごく浅い" || depth === 0) return '#e54d42'; 
  if (typeof depth !== 'number') return '#a0a0a8'; 
  if (depth <= 30) return '#e54d42'; 
  if (depth <= 100) return '#f39c12'; 
  return '#559dd6'; 
};
