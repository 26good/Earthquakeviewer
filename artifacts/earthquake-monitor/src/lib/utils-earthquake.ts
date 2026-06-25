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

export type TsunamiGrade = 'MajorWarning' | 'Warning' | 'Watch' | string;

export type TsunamiArea = {
  name: string;
  grade: TsunamiGrade;
  immediate: boolean;
  firstHeight?: {
    arrivalTime?: string;
    condition?: string;
  };
  maxHeight?: {
    description?: string;
    value?: number;
  };
};

export type TsunamiInfo = {
  id: string;
  code: number;
  cancelled: boolean;
  time: string;
  issue?: {
    source?: string;
    time?: string;
    type?: string;
  };
  areas: TsunamiArea[];
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
  Latitude?: string | number;
  Longitude?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  Depth: string;
  Serial: string;
};

export const getScaleText = (scale: number) => {
  const map: Record<number, string> = {
    10: '1', 20: '2', 30: '3', 40: '4', 45: '5-', 50: '5+', 55: '6-', 60: '6+', 70: '7'
  };
  return map[scale] || '?';
};

export const getIntensityColor = (scale: number | string | undefined) => {
  if (typeof scale === 'string') {
    const normalized = scale.replace('弱', '-').replace('強', '+');
    const map: Record<string, string> = {
      '1': '#4682B4',
      '2': '#2E8B57',
      '3': '#DAA520',
      '4': '#E67E22',
      '5-': '#C0392B',
      '5+': '#922B21',
      '6-': '#8E44AD',
      '6+': '#76448A',
      '7': '#512E5F',
    };
    return map[normalized] || '#4b89a8';
  }

  const map: Record<number, string> = {
    10: '#4682B4',
    20: '#2E8B57',
    30: '#DAA520',
    40: '#E67E22',
    45: '#C0392B',
    50: '#922B21',
    55: '#8E44AD',
    60: '#76448A',
    70: '#512E5F',
  };
  return scale ? map[scale] || '#4b89a8' : '#4b89a8';
};

export const getMagColor = (mag: number) => {
  if (!Number.isFinite(mag) || mag <= 0) return '#a0a0a8';
  if (mag < 2.0) return '#3b82f6';
  if (mag < 4.0) return '#22c55e';
  if (mag < 5.0) return '#facc15';
  if (mag < 6.0) return '#f97316';
  if (mag < 7.0) return '#ef4444';
  return '#8b5cf6';
};

export const getDepthColor = (depth: number | string) => {
  if (depth === "ごく浅い" || depth === 0) return '#ef4444';
  if (typeof depth !== 'number' || !Number.isFinite(depth)) return '#a0a0a8';
  if (depth <= 30) return '#ef4444';
  if (depth <= 80) return '#facc15';
  if (depth <= 150) return '#22c55e';
  return '#3b82f6';
};

export const getTsunamiGradeLabel = (grade: TsunamiGrade) => {
  if (grade === 'MajorWarning') return '大津波警報';
  if (grade === 'Warning') return '津波警報';
  if (grade === 'Watch') return '津波注意報';
  return '津波情報';
};

/**
 * Estimate the maximum seismic intensity at the surface point directly above
 * the hypocenter from magnitude and focal depth.
 * Uses the empirical formula: I = 2.606 + 1.498·M − 1.657·log10(depth)
 * (depth floored at 5 km to avoid singularity near surface).
 */
export const computeMaxIntensity = (mag: number, depthKm: number): string => {
  if (!Number.isFinite(mag) || mag <= 0) return '?';
  const d = Math.max(depthKm, 5);
  // Calibrated against JMA intensity records:
  //   M4.5/40km→2, M5/10km→4, M6/10km→5強, M7/10km→6強, M9/30km→6強
  const I = 2.32 + 1.0 * mag - 3.32 * Math.log10(d);
  if (I < 0.5) return '0';
  if (I < 1.5) return '1';
  if (I < 2.5) return '2';
  if (I < 3.5) return '3';
  if (I < 4.5) return '4';
  if (I < 5.0) return '5弱';
  if (I < 5.5) return '5強';
  if (I < 6.0) return '6弱';
  if (I < 6.5) return '6強';
  return '7';
};

export const getTsunamiGradeColor = (grade: TsunamiGrade) => {
  if (grade === 'MajorWarning') return '#8b5cf6';
  if (grade === 'Warning') return '#ef4444';
  if (grade === 'Watch') return '#facc15';
  return '#38bdf8';
};
