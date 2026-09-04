import { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { LngLatBoundsLike, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import { Alert, Anchor, Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Panel, Stat } from '../components/ui';
import { fmt, fmtInt } from '../lib/format';
import type { AisData, AisZone, DashboardData } from '../types';

// Free dark raster basemap (© OpenStreetMap contributors, © CARTO).
const tile = (s: string) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`;
const CARTO_TILES = ['a', 'b', 'c', 'd'].map(tile);

const COLOR_STOPPED = '#ff4d5e';
const COLOR_SLOW = '#ffb020';
const COLOR_UNDERWAY = '#4cc9f0';
const SENTENCE_END = /[.!?]$/;

const FALLBACK_ZONES = {
  hormuz: {
    name: 'Strait of Hormuz',
    vesselFinderHref: 'https://www.vesselfinder.com/aismap?lat=25.95&lon=56.2&zoom=8&width=100%25&height=430&names=false',
    marineTrafficHref: 'https://www.marinetraffic.com/en/ais/home/centerx:56.2/centery:25.95/zoom:8',
  },
  'bab-mandeb': {
    name: 'Bab el-Mandeb / Southern Red Sea',
    vesselFinderHref: 'https://www.vesselfinder.com/aismap?lat=13.4&lon=43.7&zoom=6&width=100%25&height=430&names=false',
    marineTrafficHref: 'https://www.marinetraffic.com/en/ais/home/centerx:43.7/centery:13.4/zoom:8',
  },
} as const;

type FallbackZoneKey = keyof typeof FALLBACK_ZONES;

function ExternalMapFallback() {
  return (
    <Alert color="blue" title="External live maps" mb="md">
      <Text size="sm" mb={8}>
        The native AIS feed is unavailable. Live VesselFinder maps are shown below while automatic
        retries continue in the background. MarineTraffic links offer a separate view.
      </Text>
      <Group gap="md" wrap="wrap">
        {Object.values(FALLBACK_ZONES).map((item) => (
          <Anchor
            key={item.marineTrafficHref}
            href={item.marineTrafficHref}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            fw={600}
          >
            Open {item.name} on MarineTraffic ↗
          </Anchor>
        ))}
      </Group>
    </Alert>
  );
}

function ExternalLiveMap({ zoneKey }: { zoneKey: FallbackZoneKey }) {
  const zone = FALLBACK_ZONES[zoneKey];
  return (
    <div style={{ height: 430, width: '100%', borderRadius: 12, overflow: 'hidden', background: '#b6cee8' }}>
      <iframe
        title={`Live vessel map — ${zone.name}`}
        src={zone.vesselFinderHref}
        width="100%"
        height="430"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ display: 'block', width: '100%', height: 430, border: 0 }}
      />
    </div>
  );
}

function asSentence(value: string): string {
  const text = value.trim();
  return SENTENCE_END.test(text) ? text : `${text}.`;
}

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

function ZoneCard({
  zoneKey,
  zone,
  asOf,
  external,
}: {
  zoneKey: FallbackZoneKey;
  zone?: AisZone;
  asOf?: string | null;
  external: boolean;
}) {
  return (
    <Panel
      label={zone?.name ?? FALLBACK_ZONES[zoneKey].name}
      sub={external ? '· live via VesselFinder' : (asOf ? `· updated ${asOf.replace('T', ' ').replace('Z', '')} UTC` : undefined)}
    >
      {external ? (
        <>
          <Text size="xs" c="dimmed" mb="sm">
            Live third-party visualization; native dashboard statistics resume when AISStream recovers.
          </Text>
          <ExternalLiveMap zoneKey={zoneKey} />
        </>
      ) : (
        <>
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
        </>
      )}
    </Panel>
  );
}

export function Traffic({ data }: { data: DashboardData }) {
  const ais: AisData = data.ais ?? { zones: {} };
  const hormuz = ais.zones?.hormuz;
  const mandeb = ais.zones?.['bab-mandeb'];
  const total = (hormuz?.count ?? 0) + (mandeb?.count ?? 0);
  const fallbackNeeded = ['no_key', 'pending', 'empty', 'error', 'stale', 'unavailable'].includes(ais.status ?? '');
  const retryBackoffActive = ['empty', 'error', 'stale'].includes(ais.status ?? '');
  const providerNote = ais.note ? asSentence(ais.note) : null;

  return (
    <>
      {ais.status === 'no_key' ? (
        <Alert color="yellow" title="Live AIS disabled — no API key" mb="md">
          {providerNote ||
            'Set AISSTREAM_API_KEY (free account at aisstream.io) and restart the backend to see live vessel traffic.'}
          {' '}Maps below show the monitored zones only.
        </Alert>
      ) : null}
      {ais.status === 'stale' ? (
        <Alert color="yellow" title="AIS feed unavailable — showing last successful snapshot" mb="md">
          {providerNote || 'The latest collection failed.'}{' '}
          Snapshot time: {ais.last_success_at || ais.as_of || 'unknown'}. Last attempt:{' '}
          {ais.last_attempt_at || 'unknown'}. Automatic retries continue with a capped backoff.
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
              ? (providerNote || 'Feed connected but delivered no positions — likely a temporary upstream outage. Retrying automatically.')
              : (providerNote || 'Last AIS collection failed — retrying automatically.')}
        </Alert>
      ) : null}
      {fallbackNeeded ? <ExternalMapFallback /> : null}

      <Group gap={10} mb="md" wrap="wrap">
        <Badge color="amber" variant="light" ff="monospace" size="lg">
          {fallbackNeeded ? 'native vessel counts unavailable' : `${fmtInt(total)} vessels in monitored zones`}
        </Badge>
        {ais.window_s ? (
          <Text size="xs" c="dimmed">
            snapshot window ~{ais.window_s}s · {retryBackoffActive ? 'retrying with capped backoff' : 'refreshes every 5 min'}
          </Text>
        ) : null}
      </Group>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md" mb="md">
        <ZoneCard zoneKey="hormuz" zone={hormuz} asOf={ais.as_of} external={fallbackNeeded} />
        <ZoneCard zoneKey="bab-mandeb" zone={mandeb} asOf={ais.as_of} external={fallbackNeeded} />
      </SimpleGrid>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {fallbackNeeded
            ? 'Fallback maps © VesselFinder and OpenStreetMap contributors; native AISStream statistics are unavailable.'
            : 'Positions from the free AISStream.io websocket feed (server-side, key stays local); basemap © OpenStreetMap contributors © CARTO. Dashed amber outline marks the monitored bounding box.'}
        </Text>
      </Stack>
    </>
  );
}
