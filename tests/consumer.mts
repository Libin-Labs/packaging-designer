import {
  analyzePackagingPlan,
  createPackagingPlan,
  PackagingError,
  renderPackagingOverlay,
} from '@lp-labs/packaging-designer';
import type {
  Fold,
  PackagingDiagnostic,
  PackagingInput,
  PackagingLimits,
  PackagingPlan,
  Panel,
} from '@lp-labs/packaging-designer';
const panels: Panel[] = [{ id: 'front', x: 0, y: 0, width: 100, height: 80 }];
const fold: Fold = { id: 'seam', orientation: 'vertical', coordinate: 100, start: 0, end: 80 };
const input: PackagingInput = { width: 100, height: 80, bleed: 0, safeInset: 5, panels };
const limits: PackagingLimits = { maxPanels: 10, maxFolds: 20 };
const plan: PackagingPlan = createPackagingPlan({ ...input, folds: [fold] }, limits);
const diagnostics: readonly PackagingDiagnostic[] = analyzePackagingPlan(plan);
const svg: string = renderPackagingOverlay(plan);
const error = new PackagingError('invalid', 'bad layout');
void [diagnostics, svg, error];
