// Extract coastline segments from Japan prefecture GeoJSON.
// A coastline segment is an edge that appears in exactly one prefecture (not shared).
// Output: GeoJSON FeatureCollection of LineString features, keyed by prefecture name.

import fs from 'fs';

interface Point {
  lng: number;
  lat: number;
}

function edgeKey(a: Point, b: Point): string {
  // Normalize: smaller coordinate first to handle both directions
  const aStr = `${a.lng.toFixed(6)},${a.lat.toFixed(6)}`;
  const bStr = `${b.lng.toFixed(6)},${b.lat.toFixed(6)}`;
  return aStr < bStr ? `${aStr}|${bStr}` : `${bStr}|${aStr}`;
}

async function main() {
  const url = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson';
  console.log('Downloading Japan GeoJSON...');
  const res = await fetch(url);
  const geojson = await res.json() as any;

  const edgeCounts = new Map<string, number>();
  const edgeToPref = new Map<string, string>();

  // First pass: count all edges
  for (const feature of geojson.features) {
    const prefName = feature.properties?.nam_ja || feature.properties?.name || 'unknown';
    const geom = feature.geometry;
    if (!geom) continue;

    const rings: Point[][] = [];
    if (geom.type === 'Polygon') {
      rings.push(...geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        rings.push(...poly);
      }
    }

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a: Point = { lng: ring[i][0], lat: ring[i][1] };
        const b: Point = { lng: ring[i + 1][0], lat: ring[i + 1][1] };
        const k = edgeKey(a, b);
        edgeCounts.set(k, (edgeCounts.get(k) || 0) + 1);
        edgeToPref.set(k, prefName);
      }
    }
  }

  // Second pass: collect coast edges (count === 1) per prefecture
  const coastEdgesByPref = new Map<string, Array<[Point, Point]>>();

  for (const feature of geojson.features) {
    const prefName = feature.properties?.nam_ja || feature.properties?.name || 'unknown';
    const geom = feature.geometry;
    if (!geom) continue;

    const rings: Point[][] = [];
    if (geom.type === 'Polygon') {
      rings.push(...geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        rings.push(...poly);
      }
    }

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a: Point = { lng: ring[i][0], lat: ring[i][1] };
        const b: Point = { lng: ring[i + 1][0], lat: ring[i + 1][1] };
        const k = edgeKey(a, b);
        if (edgeCounts.get(k) === 1) {
          if (!coastEdgesByPref.has(prefName)) coastEdgesByPref.set(prefName, []);
          coastEdgesByPref.get(prefName)!.push([a, b]);
        }
      }
    }
  }

  // Merge adjacent coast edges into continuous chains per prefecture
  const chainsByPref = new Map<string, Point[][]>();

  for (const [prefName, edges] of coastEdgesByPref) {
    if (edges.length === 0) continue;

    // Build adjacency map
    const adj = new Map<string, Point[]>();
    for (const [a, b] of edges) {
      const ak = `${a.lng.toFixed(6)},${a.lat.toFixed(6)}`;
      const bk = `${b.lng.toFixed(6)},${b.lat.toFixed(6)}`;
      if (!adj.has(ak)) adj.set(ak, []);
      if (!adj.has(bk)) adj.set(bk, []);
      adj.get(ak)!.push(b);
      adj.get(bk)!.push(a);
    }

    const used = new Set<string>();
    const chains: Point[][] = [];

    for (const [startKey] of adj) {
      if (used.has(startKey)) continue;

      // Find an endpoint (degree 1) to start from
      const startNeighbors = adj.get(startKey) || [];
      if (startNeighbors.length !== 1 && adj.size > 1) {
        // Only start from true endpoints; skip junction points
        continue;
      }

      const chain: Point[] = [];
      let currentKey = startKey;
      let prevKey: string | null = null;

      while (true) {
        used.add(currentKey);
        const [lng, lat] = currentKey.split(',').map(Number);
        chain.push({ lng, lat });

        const neighbors = adj.get(currentKey) || [];
        const next = neighbors.find(n => {
          const nk = `${n.lng.toFixed(6)},${n.lat.toFixed(6)}`;
          return nk !== prevKey && !used.has(nk);
        });

        if (!next) break;
        prevKey = currentKey;
        currentKey = `${next.lng.toFixed(6)},${next.lat.toFixed(6)}`;
      }

      if (chain.length >= 2) chains.push(chain);
    }

    // Handle any remaining closed loops (all points degree 2)
    for (const [startKey] of adj) {
      if (used.has(startKey)) continue;

      const chain: Point[] = [];
      let currentKey = startKey;
      let prevKey: string | null = null;

      while (true) {
        used.add(currentKey);
        const [lng, lat] = currentKey.split(',').map(Number);
        chain.push({ lng, lat });

        const neighbors = adj.get(currentKey) || [];
        const next = neighbors.find(n => {
          const nk = `${n.lng.toFixed(6)},${n.lat.toFixed(6)}`;
          return nk !== prevKey;
        });

        if (!next) break;
        const nextKey = `${next.lng.toFixed(6)},${next.lat.toFixed(6)}`;
        if (nextKey === startKey) {
          // Close the loop
          chain.push({ lng: next.lng, lat: next.lat });
          break;
        }
        prevKey = currentKey;
        currentKey = nextKey;
      }

      if (chain.length >= 2) chains.push(chain);
    }

    if (chains.length > 0) chainsByPref.set(prefName, chains);
  }

  // Build GeoJSON FeatureCollection
  const features: any[] = [];
  for (const [prefName, chains] of chainsByPref) {
    for (const chain of chains) {
      const coords = chain.map(p => [p.lng, p.lat]);
      features.push({
        type: 'Feature',
        properties: { pref: prefName },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      });
    }
  }

  const output = {
    type: 'FeatureCollection',
    features,
  };

  const outPath = 'artifacts/earthquake-monitor/public/japan-coastline.json';
  fs.mkdirSync('artifacts/earthquake-monitor/public', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output));

  console.log(`Extracted ${features.length} coastline segments across ${chainsByPref.size} prefectures`);
  console.log(`Saved to ${outPath}`);
  console.log('Prefectures with coastline:', [...chainsByPref.keys()].sort().join(', '));
}

main().catch(console.error);
