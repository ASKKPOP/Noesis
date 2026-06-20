/* Noēsis Grid-Viz — sample data (classic script, global vars; runs on file://) */

/* The 6 civic zones (D-V3-32). Order/colors are the single source of truth for the renderer. */
const ZONES = {
  G: { id: 'gov',          name: 'Government Quarter', kr: '정부구역', color: '#fbbf24', baseHeight: 1.7 },
  B: { id: 'business',     name: 'Business',           kr: '비즈니스', color: '#f5a623', baseHeight: 1.5 },
  S: { id: 'shopping',     name: 'Shopping',           kr: '쇼핑',     color: '#ec4899', baseHeight: 1.1 },
  R: { id: 'residential',  name: 'Residential',        kr: '주거',     color: '#34d399', baseHeight: 0.8 },
  I: { id: 'infrastructure',name:'Infrastructure',     kr: '인프라',   color: '#38bdf8', baseHeight: 0.6 },
  M: { id: 'manufacture',  name: 'Manufacture',        kr: '제조',     color: '#ef6c4a', baseHeight: 1.0 },
  '.':{ id: 'road',        name: 'Street',             kr: '도로',     color: '#23232c', baseHeight: 0 },
};

/* Genesis Grid zone layout. One char per tile. '.' = street (no building). */
const GENESIS_LAYOUT = [
  'GGGG.GGGG.GG',
  'GGGG.GGGG.GG',
  '....I....I..',
  'BBBB.GGSS.SS',
  'BBBB.IISS.SS',
  '....I....I..',
  'BBBI.IIIM.MM',
  'RRRI.IIIM.MM',
  '....I....I..',
  'RRRR.RRMM.MM',
  'RRRR.RRMM.MM',
  'RRRR.RRMM.MM',
];

/* Top-level Grid descriptor (what the Portal layer shows). v3.0 ships 1 Grid. */
const GENESIS_GRID = {
  id: 'genesis',
  name: 'Genesis Grid',
  polis: 'Genesis Polis',
  status: 'live',
  layout: GENESIS_LAYOUT,
  zones: ZONES,
};

/* Future Grids — framework holds many (D-V3-04/05/07), dim until founded. */
const FUTURE_GRIDS = [
  { id: 'grid-2', name: 'Grid 02', status: 'planned' },
  { id: 'grid-3', name: 'Grid 03', status: 'planned' },
  { id: 'grid-4', name: 'Grid 04', status: 'planned' },
];
