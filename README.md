# @lp-labs/packaging-designer

Validates a flat 2D packaging dieline, panel boundaries, shared-edge folds, bleed extents and safe-area insets. It renders a real SVG overlay for review. It does **not** simulate folded material or certify production dimensions, color, trim, substrate, tooling, or vendor compatibility.

## Install and quickstart

```sh
npm install @lp-labs/packaging-designer
```

```js
import assert from 'node:assert/strict';
import {
  createPackagingPlan,
  analyzePackagingPlan,
  renderPackagingOverlay,
} from '@lp-labs/packaging-designer';

const plan = createPackagingPlan({
  width: 220,
  height: 110,
  bleed: 4,
  safeInset: 5,
  panels: [
    { id: 'front', x: 10, y: 10, width: 100, height: 90 },
    { id: 'back', x: 110, y: 10, width: 100, height: 90 },
  ],
  folds: [{ id: 'center', orientation: 'vertical', coordinate: 110, start: 10, end: 100 }],
});
assert.deepEqual(analyzePackagingPlan(plan), []);
const svg = renderPackagingOverlay(plan);
assert.ok(svg.includes('data-role="fold"'));
assert.ok(svg.includes('data-role="bleed"'));
```

## API and types

- `createPackagingPlan(input, limits?): PackagingPlan` validates and detaches the supplied geometry; returned plan, arrays and panel/fold records are frozen.
- `analyzePackagingPlan(plan): readonly PackagingDiagnostic[]` reports bleed outside the declared canvas and safe insets that leave no positive-area safe region.
- `renderPackagingOverlay(plan): string` returns a self-contained SVG overlay with panels, bleed boundaries, viable safe areas, and fold lines.
- `PackagingError` exposes `code: 'invalid' | 'capacity'` and a diagnostic message.
- `Panel`: unique simple `id`, top-left `x`/`y`, positive `width`/`height`.
- `Fold`: unique `id`, `orientation`, axis `coordinate`, and positive `start`/`end` interval. Its segment must lie on a shared edge of two panels.
- `PackagingInput`: canvas `width`/`height`, uniform nonnegative `bleed`, nonnegative `safeInset`, one or more `panels`, optional `folds`.
- `PackagingPlan`: validated input with an always-present `folds` array.
- `PackagingLimits`: optional `maxPanels` and `maxFolds`.
- `PackagingDiagnostic`: `code`, `panelId`, `message`; diagnostics are geometry only.

Panel interiors may touch but must not overlap. Every panel must be within the canvas. Fold dimensions and coordinates must be finite; a fold on an exterior edge is not accepted. The overlay labels `panel`, `bleed`, `safe`, and `fold` geometry using SVG `data-role` attributes. IDs are restricted to ASCII identifiers before XML output.

## Customize, safety, and limits

Describe the actual flat dieline in one consistent unit (for example millimetres); this package does not assign physical units. `bleed` and `safeInset` are absolute values in that same unit. Multiple panels can be arranged as an arbitrary non-overlapping flat layout. A fold may cover a subsegment of a shared edge. Diagnostics are per panel and may include more than one finding.

Defaults and hard ceilings: canvas sides are 1–100,000 units; bleed/safe inset 0–10,000; 100 panels (limit ceiling 1,000); 200 folds (ceiling 2,000); coordinates and extents must be finite. Custom positive integer count limits can lower the defaults but not increase the ceilings. Invalid input throws `PackagingError` with `code: 'invalid'`; exceeding count limits uses `code: 'capacity'`.

The SVG is a **2D visualization aid only**. Bleed calculations are rectangular offsets, not corner joins or printer marks. It does not check grain, glue flaps, cutter rules, seam construction, tolerances, material thickness, color profiles, or whether a real die line will fold correctly. Confirm units, dielines, margins and manufacturing specifications with your packaging supplier.

## Performance

Plan validation checks panel overlap in O(panels²); fold checks and overlay generation scale with folds × panels and output geometry respectively. Defaults cap these counts at 100 panels and 200 folds. Increase caps only for trusted layouts; the renderer builds one SVG string proportional to the number of panels and folds.

## Modules and development

Independent ESM and CommonJS builds with declarations; no runtime or peer dependencies. CommonJS: `const { createPackagingPlan } = require('@lp-labs/packaging-designer')`. TypeScript `^5.9.3` and Prettier `^3.6.2` are development-only.

```sh
npm ci --offline
npm run build
npm run typecheck
npm test
npm run format:check
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
