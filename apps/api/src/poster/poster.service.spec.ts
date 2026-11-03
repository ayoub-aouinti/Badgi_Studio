import { gridLayout } from './poster.service';

describe('poster grid layout', () => {
  it('fits a single portrait as large as the area allows', () => {
    expect(gridLayout(1, 1000, 1500, 10)).toEqual({ columns: 1, rows: 1, tile: 1000 });
  });

  it('picks the column count giving the largest square tiles', () => {
    // 12 tiles in a portrait area: 3 x 4 beats 2 x 6 and 4 x 3.
    const layout = gridLayout(12, 900, 1200, 0);
    expect(layout).toEqual({ columns: 3, rows: 4, tile: 300 });
  });

  it('always fits every tile inside the area, gaps included', () => {
    for (const count of [5, 37, 200]) {
      const { columns, rows, tile } = gridLayout(count, 3000, 4200, 20);
      expect(columns * rows).toBeGreaterThanOrEqual(count);
      expect(columns * tile + (columns - 1) * 20).toBeLessThanOrEqual(3000);
      expect(rows * tile + (rows - 1) * 20).toBeLessThanOrEqual(4200);
    }
  });
});
