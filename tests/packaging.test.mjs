import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePackagingPlan,
  createPackagingPlan,
  PackagingError,
  renderPackagingOverlay,
} from '../dist/esm/index.js';

const carton = {
  width: 220,
  height: 110,
  bleed: 4,
  safeInset: 5,
  panels: [
    { id: 'front', x: 10, y: 10, width: 100, height: 90 },
    { id: 'back', x: 110, y: 10, width: 100, height: 90 },
  ],
  folds: [{ id: 'center', orientation: 'vertical', coordinate: 110, start: 10, end: 100 }],
};

test('creates a frozen panel plan and renders actual fold/bleed/safe geometry', () => {
  const plan = createPackagingPlan(carton);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.panels));
  assert.deepEqual(analyzePackagingPlan(plan), []);
  const svg = renderPackagingOverlay(plan);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.match(svg, /data-role="panel" data-panel="front" x="10" y="10" width="100" height="90"/u);
  assert.match(svg, /data-role="bleed" data-panel="front" x="6" y="6" width="108" height="98"/u);
  assert.match(svg, /data-role="safe" data-panel="back" x="115" y="15" width="90" height="80"/u);
  assert.match(svg, /data-role="fold" data-fold="center" x1="110" y1="10" x2="110" y2="100"/u);
});

test('reports bleed beyond the canvas and collapsed safe inset per panel', () => {
  const diagnostics = analyzePackagingPlan({
    width: 100,
    height: 100,
    bleed: 10,
    safeInset: 20,
    panels: [{ id: 'edge', x: 0, y: 0, width: 30, height: 50 }],
  });
  assert.deepEqual(
    diagnostics.map(({ code, panelId }) => [code, panelId]),
    [
      ['bleed-outside-canvas', 'edge'],
      ['safe-area-collapsed', 'edge'],
    ],
  );
});

test('rejects overlap, out-of-bounds panels, duplicate IDs and invalid folds', () => {
  const invalid = [
    {
      ...carton,
      panels: [carton.panels[0], { id: 'overlap', x: 109, y: 10, width: 40, height: 40 }],
    },
    { ...carton, panels: [{ id: 'outside', x: 210, y: 0, width: 20, height: 20 }] },
    { ...carton, panels: [carton.panels[0], { ...carton.panels[1], id: 'front' }] },
    {
      ...carton,
      folds: [{ id: 'bad', orientation: 'horizontal', coordinate: 1, start: 1, end: 2 }],
    },
    { ...carton, bleed: -1 },
    { ...carton, panels: [{ id: 'bad id', x: 0, y: 0, width: 20, height: 20 }] },
  ];
  for (const input of invalid) assert.throws(() => createPackagingPlan(input), PackagingError);
});

test('checks resource limits and fold length endpoints', () => {
  assert.throws(() => createPackagingPlan(carton, null), { code: 'invalid' });
  assert.throws(() => createPackagingPlan(carton, { maxPanels: 1 }), { code: 'capacity' });
  assert.throws(
    () => createPackagingPlan({ ...carton, folds: [{ ...carton.folds[0], end: 10 }] }),
    { code: 'invalid' },
  );
  assert.throws(() => createPackagingPlan({ ...carton, width: Infinity }), { code: 'invalid' });
  assert.throws(() => createPackagingPlan({ ...carton, panels: new Array(1) }), {
    code: 'invalid',
  });
  assert.throws(
    () => createPackagingPlan({ ...carton, folds: [{ ...carton.folds[0], start: 0 }] }),
    { code: 'invalid' },
  );
  assert.throws(() => createPackagingPlan(carton, { maxFolds: 0 }), { code: 'invalid' });
});

test('overlay escapes identifiers and omits impossible safe-area rectangles', () => {
  const plan = createPackagingPlan({
    width: 50,
    height: 50,
    bleed: 0,
    safeInset: 25,
    panels: [{ id: 'panel-1', x: 0, y: 0, width: 30, height: 30 }],
  });
  const svg = renderPackagingOverlay(plan);
  assert.ok(!svg.includes('data-role="safe"'));
  assert.match(svg, /role="img" aria-label="Two-dimensional packaging dieline overlay"/u);
});
