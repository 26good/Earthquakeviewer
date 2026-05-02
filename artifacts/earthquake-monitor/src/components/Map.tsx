import React, { useEffect, useRef, useState } from 'react';
import { Circle, GeoJSON, MapContainer, Marker, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { EEWData, EarthquakeHistoryItem, TsunamiInfo, getIntensityColor, getScaleText, getTsunamiGradeColor } from '../lib/utils-earthquake';

type UserLocation = { lat: number; lng: number } | null;

type Props = {
  currentQuake: EarthquakeHistoryItem | null;
  eew: EEWData | null;
  tsunami: TsunamiInfo | null;
  userLocation: UserLocation;
  onSetUserLocation: (loc: UserLocation) => void;
  settingLocation: boolean;
};

const P_WAVE_SPEED_KM_PER_SEC = 6.0;
const S_WAVE_SPEED_KM_PER_SEC = 3.5;
const MAX_WAVE_RADIUS_KM = 2500;

const getWaveRadiusKm = (quakeTime: string, depth: number, speed: number, now: number) => {
  const originTime = new Date(quakeTime.replace(/-/g, '/')).getTime();
  if (!Number.isFinite(originTime)) return 0;
  const elapsedSeconds = Math.max(0, (now - originTime) / 1000);
  const travelDistance = elapsedSeconds * speed;
  const surfaceDistance = Math.sqrt(Math.max(0, travelDistance ** 2 - Math.max(0, depth) ** 2));
  return Math.min(surfaceDistance, MAX_WAVE_RADIUS_KM);
};

const parseCoordinate = (value: string | number | undefined) => {
  if (value === undefined || value === null) return 0;
  const coordinate = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
};

const AutoZoomToEpicenter = ({ quake }: { quake: EarthquakeHistoryItem | null }) => {
  const map = useMap();
  useEffect(() => {
    if (!quake || quake.earthquake.hypocenter.latitude <= 0) return;
    map.flyTo(
      [quake.earthquake.hypocenter.latitude, quake.earthquake.hypocenter.longitude],
      Math.max(map.getZoom(), 7),
      { duration: 1.2 }
    );
  }, [map, quake?.id]);
  return null;
};

const MapClickHandler = ({
  settingLocation,
  onSetUserLocation,
}: {
  settingLocation: boolean;
  onSetUserLocation: (loc: UserLocation) => void;
}) => {
  useMapEvents({
    click(e) {
      if (settingLocation) {
        onSetUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

const getTsunamiAreaPrefNames = (name: string): string[] => {
  if (name.includes('北海道')) return ['北海道'];
  const matches = name.match(/[^\s、]+?[都道府県]/g);
  return matches || [];
};

const useAnimationNow = (active: boolean) => {
  const [now, setNow] = useState(Date.now());
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last > 80) {
        setNow(Date.now());
        last = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return now;
};

export const EarthquakeMap = ({ currentQuake, eew, tsunami, userLocation, onSetUserLocation, settingLocation }: Props) => {
  const [geoData, setGeoData] = useState<any>(null);

  const hasTsunamiInfo = !!tsunami && tsunami.areas.length > 0;
  const tsunamiPrefGrades: Record<string, string> = {};
  tsunami?.areas.forEach(area => {
    getTsunamiAreaPrefNames(area.name).forEach(prefName => {
      const current = tsunamiPrefGrades[prefName];
      if (!current || area.grade === 'MajorWarning' || (area.grade === 'Warning' && current !== 'MajorWarning')) {
        tsunamiPrefGrades[prefName] = area.grade;
      }
    });
  });

  const eewEpicenter =
    eew && !eew.isCancel
      ? {
          lat: parseCoordinate(eew.Latitude ?? eew.latitude),
          lng: parseCoordinate(eew.Longitude ?? eew.longitude),
          depth: parseInt(eew.Depth || '0', 10) || 0,
          time: eew.OriginTime,
        }
      : null;

  const waveEpicenter =
    eewEpicenter && eewEpicenter.lat > 0 && eewEpicenter.lng > 0 ? eewEpicenter : null;

  const now = useAnimationNow(!!waveEpicenter);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
      .then(r => r.json())
      .then(data => setGeoData(data));
  }, []);

  const prefScales: Record<string, number> = {};
  if (currentQuake) {
    currentQuake.points.forEach(p => {
      prefScales[p.pref] = Math.max(prefScales[p.pref] || 0, p.scale);
    });
  }

  const getStyle = (feature: any) => {
    let fillColor = '#15151b';
    let borderColor = '#3a3a50';
    let borderWeight = 0.8;
    const featureText = JSON.stringify(feature.properties);

    if (currentQuake) {
      for (const pref in prefScales) {
        const prefName = pref.replace(/[県府都]$/, '');
        if (featureText.includes(prefName)) {
          fillColor = getIntensityColor(prefScales[pref]);
          break;
        }
      }
    }

    if (hasTsunamiInfo) {
      for (const pref in tsunamiPrefGrades) {
        const prefName = pref.replace(/[県府都]$/, '');
        if (featureText.includes(prefName)) {
          borderColor = getTsunamiGradeColor(tsunamiPrefGrades[pref]);
          borderWeight = 2.5;
          break;
        }
      }
    }

    return {
      color: borderColor,
      weight: borderWeight,
      fillColor,
      fillOpacity: 1,
      opacity: 1,
    };
  };

  const createIcon = (scale: number) =>
    L.divIcon({
      className: '',
      html: `<div class="intensity-icon scale-${scale}">${getScaleText(scale)}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

  const epicenterIcon = L.divIcon({
    className: 'epicenter-mark',
    html: `×`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const userLocationIcon = L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 8px #38bdf8;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  const pWaveRadius = waveEpicenter
    ? getWaveRadiusKm(waveEpicenter.time, waveEpicenter.depth, P_WAVE_SPEED_KM_PER_SEC, now) * 1000
    : 0;
  const sWaveRadius = waveEpicenter
    ? getWaveRadiusKm(waveEpicenter.time, waveEpicenter.depth, S_WAVE_SPEED_KM_PER_SEC, now) * 1000
    : 0;

  const geoKey = `${currentQuake?.id || 'default'}-${JSON.stringify(tsunamiPrefGrades)}`;

  return (
    <MapContainer
      center={[37.5, 137.5]}
      zoom={5.5}
      zoomControl={false}
      attributionControl={false}
      minZoom={4}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      className={settingLocation ? 'cursor-crosshair' : ''}
    >
      <AutoZoomToEpicenter quake={currentQuake} />
      <ZoomControl position="bottomright" />
      <MapClickHandler settingLocation={settingLocation} onSetUserLocation={onSetUserLocation} />

      {geoData && (
        <GeoJSON key={geoKey} data={geoData} style={getStyle} />
      )}

      {waveEpicenter && pWaveRadius > 0 && (
        <Circle
          center={[waveEpicenter.lat, waveEpicenter.lng]}
          radius={pWaveRadius}
          pathOptions={{
            color: '#4cc9f0',
            fillColor: '#4cc9f0',
            fillOpacity: 0.04,
            opacity: 0.85,
            weight: 2,
            dashArray: '8 8',
          }}
          interactive={false}
        />
      )}

      {waveEpicenter && sWaveRadius > 0 && (
        <Circle
          center={[waveEpicenter.lat, waveEpicenter.lng]}
          radius={sWaveRadius}
          pathOptions={{
            color: '#f97316',
            fillColor: '#f97316',
            fillOpacity: 0.06,
            opacity: 0.9,
            weight: 3,
          }}
          interactive={false}
        />
      )}

      {currentQuake && currentQuake.earthquake.hypocenter.latitude > 0 && (
        <Marker
          position={[currentQuake.earthquake.hypocenter.latitude, currentQuake.earthquake.hypocenter.longitude]}
          icon={epicenterIcon}
          interactive={false}
        />
      )}

      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={userLocationIcon}
          interactive={false}
        />
      )}

      {currentQuake && geoData && geoData.features.map((feature: any, i: number) => {
        let matchedPref: string | null = null;
        for (const pref in prefScales) {
          const prefName = pref.replace(/[県府都]$/, '');
          if (JSON.stringify(feature.properties).includes(prefName)) {
            matchedPref = pref;
            break;
          }
        }
        if (!matchedPref) return null;

        let coords = feature.geometry.coordinates[0];
        if (feature.geometry.type === 'MultiPolygon') coords = coords[0];
        let latSum = 0, lngSum = 0, pts = 0;
        coords.forEach((pt: number[]) => { lngSum += pt[0]; latSum += pt[1]; pts++; });

        return (
          <Marker
            key={i}
            position={[latSum / pts, lngSum / pts]}
            icon={createIcon(prefScales[matchedPref])}
            interactive={false}
          />
        );
      })}
    </MapContainer>
  );
};
