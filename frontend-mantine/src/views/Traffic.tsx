import { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { LngLatBoundsLike, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import { Alert, Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Panel, Stat } from '../components/ui';
import { fmt, fmtInt } from '../lib/format';
import type { AisData, AisZone, DashboardData } from '../types';

// Free dark raster basemap (© OpenStreetMap contributors, © CARTO).
const tile = (s: string) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`;
const CARTO_TILES = ['a', 'b', 'c', 'd'].map(tile);

const COLOR_STOPPED = '#ff4d5e';
const COLOR_SLOW = '#ffb020';
const COLOR_UNDERWAY = '#4cc9f0';

function styleFor(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      carto: {
        type: 'raster',
        tiles: CARTO_TILES,
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO · AIS via aisstream.io',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#07090f' } },
      { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.92 } },
    ],
  };
}

function vesselsFc(zone: AisZone): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: zone.vessels
      .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon))
      .map((v) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [v.lon, v.lat] },
        properties: {
          mmsi: String(v.mmsi),
          name: v.name || '',
          sog: v.sog ?? -1,
          cog: v.cog ?? -1,
          status: v.nav_status || '',
        },
      })),
  };
}

function bboxPolygon(bbox: [number, number][]): GeoJSON.FeatureCollection {
  const [cornerA, cornerB] = bbox;
  const [latMin, lonMin] = cornerA;
  const [latMax, lonMax] = cornerB;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax], [lonMin, latMin]]],
        },
      },
    ],
  };
}

function ChokeMap({ zone }: { zone: AisZone }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fc = useMemo(() => vesselsFc(zone), [zone.vessels]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = new maplibregl.Map({
      container: el,
      style: styleFor(),
      center: zone.center ?? [56.2, 25.95],
      zoom: zone.zoom ?? 7.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    map.on('load', () => {
      map.addSource('zone-bbox', { type: 'geojson', data: bboxPolygon(zone.bbox) });
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: 'zone-bbox',
        paint: { 'line-color': '#ffb020', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.75 },
      });
      map.addSource('vessels', { type: 'geojson', data: fc });
      map.addLayer({
        id: 'vessel-dots',
        type: 'circle',
        source: 'vessels',
        paint: {
          'circle-radius': 4.5,
          'circle-color': [
            'case',
            ['<', ['get', 'sog'], 0], '#6b7280',
            ['<=', ['get', 'sog'], 0.9], COLOR_STOPPED,
            ['<', ['get', 'sog'], 8], COLOR_SLOW,
            COLOR_UNDERWAY,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(7,9,15,0.85)',
          'circle-opacity': 0.95,
        },
      });
      map.on('mouseenter', 'vessel-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'vessel-dots', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('mousemove', 'vessel-dots', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string | number>;
        const html = `
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5">
            <b>${p.name ? p.name : '(name n/a)'}</b><br/>
            MMSI ${p.mmsi}<br/>
            SOG ${Number(p.sog) >= 0 ? `${fmt(Number(p.sog), 1)} kn` : 'n/a'}
            · COG ${Number(p.cog) >= 0 ? `${fmt(Number(p.cog), 0)}°` : 'n/a'}<br/>
            ${p.status}
          </div>`;
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });
      const bounds: LngLatBoundsLike = [
        [zone.bbox[0][1], zone.bbox[0][0]],
        [zone.bbox[1][1], zone.bbox[1][0]],
      ];
      map.fitBounds(bounds, { padding: 24, duration: 0 });
    });
    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // Zone identity is fixed per mount; only vessel positions stream in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (map.getSource('vessels') as maplibregl.GeoJSONSource | undefined)?.setData(fc);
  }, [fc]);

  return (
    <div>
      <div ref={containerRef} style={{ height: 430, width: '100%', borderRadius: 12, overflow: 'hidden' }} />
      <Group gap={14} mt={8} wrap="wrap">
        <Group gap={6}><span style={{ width: 9, height: 9, borderRadius: 99, background: COLOR_UNDERWAY, display: 'inline-block' }} /><Text size="xs" c="dimmed">underway &gt; 8 kn</Text></Group>
        <Group gap={6}><span style={{ width: 9, height: 9, borderRadius: 99, background: COLOR_SLOW, display: 'inline-block' }} /><Text size="xs" c="dimmed">slow 1–8 kn</Text></Group>
        <Group gap={6}><span style={{ width: 9, height: 9, borderRadius: 99, background: COLOR_STOPPED, display: 'inline-block' }} /><Text size="xs" c="dimmed">stopped / anchored</Text></Group>
      </Group>
    </div>
  );
}

function ZoneCard({ zoneKey, zone, asOf }: { zoneKey: string; zone?: AisZone; asOf?: string | null }) {
  return (
    <Panel
      label={zone?.name ?? zoneKey}
      sub={asOf ? `· updated ${asOf.replace('T', ' ').replace('Z', '')} UTC` : undefined}
    >
      <SimpleGrid cols={4} spacing={10} mb="sm">
        <Stat k="vessels tracked" v={fmtInt(zone?.count ?? 0)} />
        <Stat k="underway" v={fmtInt(zone?.n_moving ?? 0)} />
        <Stat k="anchored / slow-stop" v={fmtInt(zone?.n_anchored ?? 0)} />
        <Stat k="avg SOG (kn)" v={zone?.avg_sog != null ? fmt(zone.avg_sog, 1) : '—'} />
      </SimpleGrid>
      {zone ? (
        <ChokeMap zone={zone} />
      ) : (
        <Text size="xs" c="dimmed">Waiting for the first AIS collection cycle…</Text>
      )}
    </Panel>
  );
}

export function Traffic({ data }: { data: DashboardData }) {
  const ais: AisData = data.ais ?? { zones: {} };
  const hormuz = ais.zones?.hormuz;
  const mandeb = ais.zones?.['bab-mandeb'];
  const total = (hormuz?.count ?? 0) + (mandeb?.count ?? 0);

  return (
    <>
      {ais.status === 'no_key' ? (
        <Alert color="yellow" title="Live AIS disabled — no API key" mb="md">
          {ais.note ||
            'Set AISSTREAM_API_KEY (free account at aisstream.io) and restart the backend to see live vessel traffic.'}
          {' '}Maps below show the monitored zones only.
        </Alert>
      ) : null}
      {(ais.status === 'error' || ais.status === 'pending' || ais.status === 'empty') ? (
        <Alert
          color={ais.status === 'empty' ? 'yellow' : 'orange'}
          title={`AIS feed ${ais.status}`}
          mb="md"
        >
          {ais.status === 'pending'
            ? 'First AIS collection is still running (~45 s window).'
            : ais.status === 'empty'
              ? (ais.note || 'Feed connected but delivered no positions — likely a temporary upstream outage. Retrying every 5 min.')
              : (ais.note || 'Last AIS collection failed — will retry automatically.')}
        </Alert>
      ) : null}

      <Group gap={10} mb="md" wrap="wrap">
        <Badge color="amber" variant="light" ff="monospace" size="lg">
          {fmtInt(total)} vessels in monitored zones
        </Badge>
        {ais.window_s ? (
          <Text size="xs" c="dimmed">snapshot window ~{ais.window_s}s · refreshes every 5 min</Text>
        ) : null}
      </Group>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md" mb="md">
        <ZoneCard zoneKey="hormuz" zone={hormuz} asOf={ais.as_of} />
        <ZoneCard zoneKey="bab-mandeb" zone={mandeb} asOf={ais.as_of} />
      </SimpleGrid>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          Positions from the free AISStream.io websocket feed (server-side, key stays local); basemap
          © OpenStreetMap contributors © CARTO. Dashed amber outline marks the monitored bounding box.
        </Text>
      </Stack>
    </>
  );
}
