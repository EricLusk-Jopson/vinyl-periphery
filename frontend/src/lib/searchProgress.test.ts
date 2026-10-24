import {
  formatTimeLeft,
  plural,
  progressDetail,
  secondsLeft,
  stageFraction,
  stageStatus,
} from "./searchProgress";
import { SearchStage } from "@/api/types";

const stage = (
  id: SearchStage["id"],
  current: number,
  total: number,
): SearchStage => ({ id, label: id, current, total });

describe("stageStatus", () => {
  it("marks earlier stages done and later ones pending", () => {
    expect(stageStatus("initial", "contributors")).toBe("done");
    expect(stageStatus("contributors", "contributors")).toBe("active");
    expect(stageStatus("releases", "contributors")).toBe("pending");
  });

  it("treats the first stage as active before any progress arrives", () => {
    expect(stageStatus("initial", null)).toBe("active");
    expect(stageStatus("releases", null)).toBe("pending");
  });
});

describe("stageFraction", () => {
  it("is current over total, clamped", () => {
    expect(stageFraction(stage("releases", 21, 48))).toBeCloseTo(0.4375);
    expect(stageFraction(stage("releases", 60, 48))).toBe(1);
  });

  it("is 0 without a stage or a total", () => {
    expect(stageFraction(null)).toBe(0);
    expect(stageFraction(stage("releases", 0, 0))).toBe(0);
  });
});

describe("secondsLeft", () => {
  it("counts the call under way and the ones after it", () => {
    // 48 - 21 + 1 = 28 calls at 2.5s
    expect(secondsLeft(stage("releases", 21, 48), 2500)).toBe(70);
    expect(secondsLeft(stage("releases", 48, 48), 2500)).toBe(2.5);
  });

  it("has no estimate before the discography stage", () => {
    expect(secondsLeft(stage("initial", 0, 1), 2500)).toBeNull();
    expect(secondsLeft(stage("contributors", 2, 5), 2500)).toBeNull();
    expect(secondsLeft(null, 2500)).toBeNull();
  });
});

describe("formatTimeLeft", () => {
  it("rounds to minutes", () => {
    expect(formatTimeLeft(30)).toBe("under a minute left");
    expect(formatTimeLeft(70)).toBe("about 1 min left");
    expect(formatTimeLeft(100)).toBe("about 2 min left");
  });
});

describe("progressDetail", () => {
  it("matches the reference copy", () => {
    expect(progressDetail(stage("releases", 21, 48), 2500)).toBe(
      "21 of 48 · about 1 min left",
    );
  });

  it("shows a count without an estimate for the credits stage", () => {
    expect(progressDetail(stage("contributors", 2, 5), 2500)).toBe("2 of 5");
  });

  it("is empty for the first stage", () => {
    expect(progressDetail(stage("initial", 0, 1), 2500)).toBe("");
    expect(progressDetail(null, 2500)).toBe("");
  });
});

describe("plural", () => {
  it("picks the form and groups thousands", () => {
    expect(plural(1, "release")).toBe("1 release");
    expect(plural(1204, "release")).toBe("1,204 releases");
  });
});
