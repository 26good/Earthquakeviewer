import React from 'react';
import { MapContainer, GeoJSON, Marker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { EarthquakeHistoryItem, getIntensityColor, getScaleText } from '../lib/utils-earthquake';
import { useEffect, useState } from 'react';

type Props = {
  currentQuake: EarthquakeHistoryItem | null;
};

export const EarthquakeMap = ({ currentQuake }: Props) => {
  const [geoData, setGeoData] = useState<any>(null);

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

  return (
    <MapContainer 
      center={[37.5, 137.5]} 
      zoom={5.5} 
      zoomControl={false} 
      attributionControl={false}
      minZoom={4}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
    >
      <ZoomControl position="bottomright" />
      
      {geoData && (
        <GeoJSON 
          key={currentQuake?.id || 'default'} 
          data={geoData} 
          style={getStyle} 
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
