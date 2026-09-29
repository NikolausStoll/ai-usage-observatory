import { describe, expect, it } from "vitest";
import { formatDurationMs, formatDurationPrecise } from "../../src/lib/format-duration.js";

describe("formatDurationMs", () => {
  it("formats sub-second durations as milliseconds", () => {
    expect(formatDurationMs(0)).toBe("0 ms");
    expect(formatDurationMs(184)).toBe("184 ms");
    expect(formatDurationMs(999)).toBe("999 ms");
  });

  it("formats under 10s with two decimal places", () => {
    expect(formatDurationMs(1840)).toBe("1.84 s");
    expect(formatDurationMs(1000)).toBe("1.00 s");
    expect(formatDurationMs(9999)).toBe("10.00 s");
  });

  it("formats under 60s with one decimal place", () => {
    expect(formatDurationMs(12300)).toBe("12.3 s");
    expect(formatDurationMs(10_000)).toBe("10.0 s");
    expect(formatDurationMs(59_900)).toBe("59.9 s");
  });

  it("formats minutes with zero-padded seconds", () => {
    expect(formatDurationMs(68_000)).toBe("1m 08s");
    expect(formatDurationMs(60_000)).toBe("1m 00s");
    expect(formatDurationMs(125_000)).toBe("2m 05s");
  });

  it("returns em dash for missing or invalid values", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(undefined)).toBe("—");
    expect(formatDurationMs(Number.NaN)).toBe("—");
    expect(formatDurationMs(-1)).toBe("—");
  });
});

describe("formatDurationPrecise", () => {
  it("returns exact millisecond tooltip text", () => {
    expect(formatDurationPrecise(1843)).toBe("1843 ms");
    expect(formatDurationPrecise(null)).toBe("");
  });
});
