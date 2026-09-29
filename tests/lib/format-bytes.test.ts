import { describe, expect, it } from "vitest";
import { formatByteSize } from "../../src/lib/format-bytes.js";

describe("formatByteSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1536)).toBe("1.5 KB");
    expect(formatByteSize(12_288)).toBe("12 KB");
    expect(formatByteSize(1_572_864)).toBe("1.50 MB");
  });

  it("handles invalid values", () => {
    expect(formatByteSize(null)).toBe("—");
    expect(formatByteSize(undefined)).toBe("—");
    expect(formatByteSize(Number.NaN)).toBe("—");
  });
});
