import React from 'react';
import { Circle, GeoJSON, MapContainer, Marker, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { EEWData, EarthquakeHistoryItem, getIntensityColor, getScaleText } from '../lib/utils-earthquake';
import { useEffect, useState } from 'react';

type Props = {
  currentQuake: EarthquakeHistoryItem | null;
  eew: EEWData | null;
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

export const EarthquakeMap = ({ currentQuake, eew }: Props) => {
  const [geoData, setGeoData] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
      .then(r => r.json())
      .then(data => setGeoData(data));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const prefScales: Record<string, number> = {};
  if (currentQuake) {
    currentQuake.points.forEach(p => {
      prefScales[p.pref] = Math.max(prefScales[p.pref] || 0, p.scale);
    });
  }

  const getStyle = (feature: any) => {
    let color = '#15151b';
    if (currentQuake) {
      for (const pref in prefScales) {
        const prefName = pref.replace(/県|府|都/, '');
        if (JSON.stringify(feature.properties).includes(prefName)) {
          const scale = prefScales[pref];
          color = getIntensityColor(scale);
        }
      }
    }
    return {
      color: '#444',
      weight: 1,
      fillColor: color,
      fillOpacity: 1
    };
  };

  const createIcon = (scale: number) => {
    return L.divIcon({
      className: '',
      html: `<div class="intensity-icon scale-${scale}">${getScaleText(scale)}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const epicenterIcon = L.divIcon({
    className: 'epicenter-mark',
    html: `×`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  const pWaveIcon = L.divIcon({
    className: '',
    html: `<div class="seismic-wave p-wave-ring"></div>`,
    iconSize: [190, 190],
    iconAnchor: [95, 95],
  });

  const sWaveIcon = L.divIcon({
    className: '',
    html: `<div class="seismic-wave s-wave-ring"></div>`,
    iconSize: [270, 270],
    iconAnchor: [135, 135],
  });

  const epicenter =
    currentQuake && currentQuake.earthquake.hypocenter.latitude > 0
      ? {
          lat: currentQuake.earthquake.hypocenter.latitude,
          lng: currentQuake.earthquake.hypocenter.longitude,
          depth: currentQuake.earthquake.hypocenter.depth,
          time: currentQuake.earthquake.time,
        }
      : null;

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
    eewEpicenter && eewEpicenter.lat > 0 && eewEpicenter.lng > 0
      ? eewEpicenter
      : null;

  const pWaveRadius = waveEpicenter
    ? getWaveRadiusKm(waveEpicenter.time, waveEpicenter.depth, P_WAVE_SPEED_KM_PER_SEC, now) * 1000
    : 0;
  const sWaveRadius = waveEpicenter
    ? getWaveRadiusKm(waveEpicenter.time, waveEpicenter.depth, S_WAVE_SPEED_KM_PER_SEC, now) * 1000
    : 0;

  return (
    <MapContainer 
      center={[37.5, 137.5]} 
      zoom={5.5} 
      zoomControl={false} 
      attributionControl={false}
      minZoom={4}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
    >
      <AutoZoomToEpicenter quake={currentQuake} />
      <ZoomControl position="bottomright" />
      
      {geoData && (
        <GeoJSON 
          key={currentQuake?.id || 'default'} 
          data={geoData} 
          style={getStyle} 
        />
      )}

      {waveEpicenter && pWaveRadius > 0 && (
        <Circle
          center={[waveEpicenter.lat, waveEpicenter.lng]}
          radius={pWaveRadius}
          pathOptions={{
            color: '#4cc9f0',
            fillColor: '#4cc9f0',
            fillOpacity: 0.04,
            opacity: 0.78,
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
            opacity: 0.86,
            weight: 3,
          }}
          interactive={false}
        />
      )}

      {waveEpicenter && (
        <Marker
          position={[waveEpicenter.lat, waveEpicenter.lng]}
          icon={sWaveIcon}
          interactive={false}
        />
      )}

      {waveEpicenter && (
        <Marker
          position={[waveEpicenter.lat, waveEpicenter.lng]}
          icon={pWaveIcon}
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

      {currentQuake && geoData && geoData.features.map((feature: any, i: number) => {
        let matchedPref = null;
        for (const pref in prefScales) {
          const prefName = pref.replace(/県|府|都/, '');
          if (JSON.stringify(feature.properties).includes(prefName)) {
            matchedPref = pref;
            break;
          }
        }

        if (matchedPref) {
          // Simple heuristic to place marker in the center of the first polygon ring
          let coords = feature.geometry.coordinates[0];
          if (feature.geometry.type === 'MultiPolygon') coords = coords[0];
          let latSum = 0, lngSum = 0, pts = 0;
          
          // Using a very basic centroid calculation for visual markers
          coords.forEach((pt: number[]) => {
             lngSum += pt[0];
             latSum += pt[1];
             pts++;
          });
          const lat = latSum / pts;
          const lng = lngSum / pts;

          return (
            <Marker 
              key={i} 
              position={[lat, lng]} 
              icon={createIcon(prefScales[matchedPref])}
              interactive={false}
            />
          );
        }
        return null;
      })}
    </MapContainer>
  );
};
