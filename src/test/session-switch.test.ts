import { describe, expect, it } from "vitest";
import { autoSessionIndex } from "@/lib/session-switch";

const s = ["2026-10-08T18:00:00Z", "2026-10-08T20:00:00Z"];
const t = (h: string) => new Date(`2026-10-08T${h}:00Z`).getTime();

describe("auto session switch", () => {
  it("stays on first session before the offset (1h)", () => expect(autoSessionIndex(s, t("18:59"), 60)).toBe(0));
  it("switches to second session 1h after first starts", () => expect(autoSessionIndex(s, t("19:00"), 60)).toBe(1));
  it("with 90 minutes switches at 19:30", () => {
    expect(autoSessionIndex(s, t("19:29"), 90)).toBe(0);
    expect(autoSessionIndex(s, t("19:30"), 90)).toBe(1);
  });
});
