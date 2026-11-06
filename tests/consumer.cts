import library = require('@lp-labs/packaging-designer');
const plan = library.createPackagingPlan({
  width: 100,
  height: 80,
  bleed: 0,
  safeInset: 5,
  panels: [{ id: 'front', x: 0, y: 0, width: 100, height: 80 }],
});
const overlay: string = library.renderPackagingOverlay(plan);
void overlay;
