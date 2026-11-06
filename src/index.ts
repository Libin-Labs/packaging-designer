export interface Panel {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Fold {
  readonly id: string;
  readonly orientation: 'vertical' | 'horizontal';
  readonly coordinate: number;
  readonly start: number;
  readonly end: number;
}

export interface PackagingInput {
  readonly width: number;
  readonly height: number;
  readonly bleed: number;
  readonly safeInset: number;
  readonly panels: readonly Panel[];
  readonly folds?: readonly Fold[];
}

export interface PackagingPlan extends PackagingInput {
  readonly folds: readonly Fold[];
}

export interface PackagingLimits {
  readonly maxPanels?: number;
  readonly maxFolds?: number;
}

export interface PackagingDiagnostic {
  readonly code: 'bleed-outside-canvas' | 'safe-area-collapsed';
  readonly panelId: string;
  readonly message: string;
}

export class PackagingError extends Error {
  constructor(
    readonly code: 'invalid' | 'capacity',
    message: string,
  ) {
    super(message);
    this.name = 'PackagingError';
  }
}

function number(value: number, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new PackagingError('invalid', `${name} must be finite in ${min}..${max}.`);
  return value;
}

function identifier(value: string, name: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/u.test(value))
    throw new PackagingError('invalid', `${name} must be a simple identifier.`);
  return value;
}

function count(value: number | undefined, fallback: number, ceiling: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > ceiling)
    throw new PackagingError('invalid', `${name} must be an integer in 1..${ceiling}.`);
  return resolved;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

function rectsOverlap(a: Panel, b: Panel): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function foldTouchesSharedEdge(fold: Fold, panels: readonly Panel[]): boolean {
  const vertical = fold.orientation === 'vertical';
  const starts = panels.filter((panel) =>
    vertical ? panel.x === fold.coordinate : panel.y === fold.coordinate,
  );
  const ends = panels.filter((panel) =>
    vertical
      ? panel.x + panel.width === fold.coordinate
      : panel.y + panel.height === fold.coordinate,
  );
  const contains = (panel: Panel): boolean => {
    const start = vertical ? panel.y : panel.x;
    const end = start + (vertical ? panel.height : panel.width);
    return fold.start >= start && fold.end <= end;
  };
  return starts.some(contains) && ends.some(contains);
}

/** Validates flat 2D panels, non-overlap, and folds on shared panel edges. */
export function createPackagingPlan(
  input: PackagingInput,
  limits: PackagingLimits = {},
): PackagingPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new PackagingError('invalid', 'A packaging layout is required.');
  if (!limits || typeof limits !== 'object' || Array.isArray(limits))
    throw new PackagingError('invalid', 'Limits must be an object.');
  const width = number(input.width, 'Canvas width', 1, 100_000);
  const height = number(input.height, 'Canvas height', 1, 100_000);
  const bleed = number(input.bleed, 'Bleed', 0, 10_000);
  const safeInset = number(input.safeInset, 'Safe inset', 0, 10_000);
  const maxPanels = count(limits.maxPanels, 100, 1000, 'maxPanels');
  const maxFolds = count(limits.maxFolds, 200, 2000, 'maxFolds');
  if (!Array.isArray(input.panels) || input.panels.length === 0)
    throw new PackagingError('invalid', 'At least one panel is required.');
  for (let index = 0; index < input.panels.length; index += 1)
    if (!Object.hasOwn(input.panels, index))
      throw new PackagingError('invalid', 'Panel arrays cannot contain empty slots.');
  if (input.panels.length > maxPanels)
    throw new PackagingError('capacity', 'Panel capacity exceeded.');
  const ids = new Set<string>();
  const panels = input.panels.map((source) => {
    if (!source || typeof source !== 'object')
      throw new PackagingError('invalid', 'Each panel must be an object.');
    const id = identifier(source.id, 'Panel ID');
    if (ids.has(id)) throw new PackagingError('invalid', `Duplicate panel ID: ${id}.`);
    ids.add(id);
    const x = number(source.x, `${id}.x`, 0, width);
    const y = number(source.y, `${id}.y`, 0, height);
    const panelWidth = number(source.width, `${id}.width`, 1, width);
    const panelHeight = number(source.height, `${id}.height`, 1, height);
    if (x + panelWidth > width || y + panelHeight > height)
      throw new PackagingError('invalid', `Panel ${id} is outside the canvas.`);
    return Object.freeze({ id, x, y, width: panelWidth, height: panelHeight });
  });
  for (let first = 0; first < panels.length; first += 1) {
    for (let second = first + 1; second < panels.length; second += 1) {
      if (rectsOverlap(panels[first]!, panels[second]!))
        throw new PackagingError(
          'invalid',
          `Panels ${panels[first]!.id} and ${panels[second]!.id} overlap.`,
        );
    }
  }
  const sourceFolds = input.folds ?? [];
  if (!Array.isArray(sourceFolds)) throw new PackagingError('invalid', 'Folds must be an array.');
  for (let index = 0; index < sourceFolds.length; index += 1)
    if (!Object.hasOwn(sourceFolds, index))
      throw new PackagingError('invalid', 'Fold arrays cannot contain empty slots.');
  if (sourceFolds.length > maxFolds)
    throw new PackagingError('capacity', 'Fold capacity exceeded.');
  const foldIds = new Set<string>();
  const folds = sourceFolds.map((source) => {
    if (!source || typeof source !== 'object')
      throw new PackagingError('invalid', 'Each fold must be an object.');
    const id = identifier(source.id, 'Fold ID');
    if (foldIds.has(id)) throw new PackagingError('invalid', `Duplicate fold ID: ${id}.`);
    foldIds.add(id);
    if (source.orientation !== 'vertical' && source.orientation !== 'horizontal')
      throw new PackagingError('invalid', `Fold ${id} has an invalid orientation.`);
    const coordinate = number(
      source.coordinate,
      `${id}.coordinate`,
      0,
      source.orientation === 'vertical' ? width : height,
    );
    const start = number(
      source.start,
      `${id}.start`,
      0,
      source.orientation === 'vertical' ? height : width,
    );
    const end = number(
      source.end,
      `${id}.end`,
      0,
      source.orientation === 'vertical' ? height : width,
    );
    if (start >= end)
      throw new PackagingError('invalid', `Fold ${id} must have a positive length.`);
    const fold = Object.freeze({ id, orientation: source.orientation, coordinate, start, end });
    if (!foldTouchesSharedEdge(fold, panels))
      throw new PackagingError('invalid', `Fold ${id} must follow a shared panel edge.`);
    return fold;
  });
  return Object.freeze({
    width,
    height,
    bleed,
    safeInset,
    panels: Object.freeze(panels),
    folds: Object.freeze(folds),
  });
}

/** Diagnostics are geometric checks, not print-vendor or material guarantees. */
export function analyzePackagingPlan(plan: PackagingPlan): readonly PackagingDiagnostic[] {
  const snapshot = createPackagingPlan(plan);
  const diagnostics: PackagingDiagnostic[] = [];
  for (const panel of snapshot.panels) {
    if (
      panel.x - snapshot.bleed < 0 ||
      panel.y - snapshot.bleed < 0 ||
      panel.x + panel.width + snapshot.bleed > snapshot.width ||
      panel.y + panel.height + snapshot.bleed > snapshot.height
    )
      diagnostics.push(
        Object.freeze({
          code: 'bleed-outside-canvas',
          panelId: panel.id,
          message: `Panel ${panel.id} bleed extends beyond the declared canvas.`,
        }),
      );
    if (snapshot.safeInset * 2 >= panel.width || snapshot.safeInset * 2 >= panel.height)
      diagnostics.push(
        Object.freeze({
          code: 'safe-area-collapsed',
          panelId: panel.id,
          message: `Panel ${panel.id} safe inset leaves no positive-area safe region.`,
        }),
      );
  }
  return Object.freeze(diagnostics);
}

/** Emits a 2D SVG overlay. It is not a fold simulation or manufacturing proof. */
export function renderPackagingOverlay(input: PackagingPlan): string {
  const plan = createPackagingPlan(input);
  const body: string[] = [];
  for (const panel of plan.panels) {
    body.push(
      `<rect data-role="panel" data-panel="${escapeXml(panel.id)}" x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="#ffffff" stroke="#1f2937"/>`,
      `<rect data-role="bleed" data-panel="${escapeXml(panel.id)}" x="${panel.x - plan.bleed}" y="${panel.y - plan.bleed}" width="${panel.width + plan.bleed * 2}" height="${panel.height + plan.bleed * 2}" fill="none" stroke="#dc2626" stroke-dasharray="4 3"/>`,
    );
    const safeWidth = panel.width - plan.safeInset * 2;
    const safeHeight = panel.height - plan.safeInset * 2;
    if (safeWidth > 0 && safeHeight > 0)
      body.push(
        `<rect data-role="safe" data-panel="${escapeXml(panel.id)}" x="${panel.x + plan.safeInset}" y="${panel.y + plan.safeInset}" width="${safeWidth}" height="${safeHeight}" fill="none" stroke="#15803d" stroke-dasharray="2 2"/>`,
      );
  }
  for (const fold of plan.folds) {
    const x1 = fold.orientation === 'vertical' ? fold.coordinate : fold.start;
    const y1 = fold.orientation === 'vertical' ? fold.start : fold.coordinate;
    const x2 = fold.orientation === 'vertical' ? fold.coordinate : fold.end;
    const y2 = fold.orientation === 'vertical' ? fold.end : fold.coordinate;
    body.push(
      `<line data-role="fold" data-fold="${escapeXml(fold.id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-dasharray="6 3"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-dimensional packaging dieline overlay" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}">${body.join('')}</svg>`;
}
