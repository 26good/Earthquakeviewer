#!/usr/bin/env python3
import json, urllib.request, os
from collections import defaultdict

url = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
print("Downloading Japan GeoJSON...")
with urllib.request.urlopen(url) as f:
    geojson = json.load(f)
print("Parsing...")

edge_counts = {}
edge_to_pref = {}

for feature in geojson["features"]:
    pref = feature["properties"].get("nam_ja", feature["properties"].get("name", "unknown"))
    geom = feature.get("geometry")
    if not geom:
        continue

    rings = []
    gt = geom["type"]
    if gt == "Polygon":
        rings.extend(geom["coordinates"])
    elif gt == "MultiPolygon":
        for poly in geom["coordinates"]:
            rings.extend(poly)

    for ring in rings:
        for i in range(len(ring) - 1):
            a = (round(ring[i][0], 6), round(ring[i][1], 6))
            b = (round(ring[i+1][0], 6), round(ring[i+1][1], 6))
            if a > b:
                a, b = b, a
            k = (a, b)
            edge_counts[k] = edge_counts.get(k, 0) + 1
            edge_to_pref[k] = pref

# Collect coast edges (count == 1)
coast_edges_by_pref = defaultdict(list)
for feature in geojson["features"]:
    pref = feature["properties"].get("nam_ja", feature["properties"].get("name", "unknown"))
    geom = feature.get("geometry")
    if not geom:
        continue

    rings = []
    gt = geom["type"]
    if gt == "Polygon":
        rings.extend(geom["coordinates"])
    elif gt == "MultiPolygon":
        for poly in geom["coordinates"]:
            rings.extend(poly)

    for ring in rings:
        for i in range(len(ring) - 1):
            a = (round(ring[i][0], 6), round(ring[i][1], 6))
            b = (round(ring[i+1][0], 6), round(ring[i+1][1], 6))
            if a > b:
                a, b = b, a
            k = (a, b)
            if edge_counts.get(k, 0) == 1:
                coast_edges_by_pref[pref].append((a, b))

# Merge into chains
chains_by_pref = {}
for pref, edges in coast_edges_by_pref.items():
    if not edges:
        continue

    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)

    used = set()
    chains = []

    # Start from endpoints (degree 1)
    for start in list(adj.keys()):
        if start in used:
            continue
        if len(adj[start]) != 1 and len(adj) > 1:
            continue

        chain = []
        current = start
        prev = None

        while True:
            used.add(current)
            chain.append(current)
            neighbors = [n for n in adj[current] if n != prev and n not in used]
            if not neighbors:
                break
            prev = current
            current = neighbors[0]

        if len(chain) >= 2:
            chains.append(chain)

    # Handle closed loops
    for start in list(adj.keys()):
        if start in used:
            continue

        chain = []
        current = start
        prev = None

        while True:
            used.add(current)
            chain.append(current)
            neighbors = [n for n in adj[current] if n != prev]
            if not neighbors:
                break
            next_pt = neighbors[0]
            if next_pt in used and next_pt != start:
                break
            if next_pt == start:
                chain.append(next_pt)
                break
            prev = current
            current = next_pt

        if len(chain) >= 2:
            chains.append(chain)

    if chains:
        chains_by_pref[pref] = chains

# Build GeoJSON
features = []
for pref, chains in chains_by_pref.items():
    for chain in chains:
        coords = [[p[0], p[1]] for p in chain]
        features.append({
            "type": "Feature",
            "properties": {"pref": pref},
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        })

output = {"type": "FeatureCollection", "features": features}

out_dir = "artifacts/earthquake-monitor/public"
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "japan-coastline.json")
with open(out_path, "w") as f:
    json.dump(output, f)

print(f"Extracted {len(features)} coastline segments across {len(chains_by_pref)} prefectures")
print(f"Saved to {out_path}")
prefs = sorted(chains_by_pref.keys())
print(f"Coastal prefectures: {', '.join(prefs)}")
