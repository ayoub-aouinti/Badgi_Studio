import { parseRange } from './public.controller';

describe('parseRange', () => {
  it('sends the whole file without a (valid) Range header', () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('items=0-1', 1000)).toBeNull();
  });

  it('reads explicit, open-ended and suffix ranges', () => {
    expect(parseRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('clamps the end and refuses ranges past the file', () => {
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid');
    expect(parseRange('bytes=10-5', 1000)).toBe('invalid');
  });
});
