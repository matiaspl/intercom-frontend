import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GetRoutesResult } from "../mobile-overlay/audio-route";
import { applyStoredAudioRoute } from "./android-audio-route";

const mocks = vi.hoisted(() => ({
  getAvailableRoutes: vi.fn(),
  isMobileApp: vi.fn(),
  isPluginAvailable: vi.fn(),
  setRoute: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isPluginAvailable: mocks.isPluginAvailable,
  },
}));

vi.mock("../mobile-overlay/audio-route", () => ({
  AudioRoute: {
    getAvailableRoutes: mocks.getAvailableRoutes,
    setRoute: mocks.setRoute,
  },
}));

vi.mock("../platform", () => ({
  isMobileApp: mocks.isMobileApp,
}));

const routes: GetRoutesResult["routes"] = [
  {
    id: "speaker",
    label: "Phone speaker",
    available: true,
    type: "speaker",
  },
  {
    id: "earpiece",
    label: "Phone earpiece",
    available: true,
    type: "earpiece",
  },
];

describe("applyStoredAudioRoute", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getAvailableRoutes.mockReset();
    mocks.isMobileApp.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.setRoute.mockReset();
  });

  it("does not set the route again when the desired route is already active", async () => {
    window.localStorage.setItem("id.audioRoute", JSON.stringify("speaker"));
    mocks.getAvailableRoutes.mockResolvedValue({
      routes,
      active: "speaker",
    });

    await expect(applyStoredAudioRoute()).resolves.toBe("speaker");

    expect(mocks.setRoute).not.toHaveBeenCalled();
  });

  it("coalesces concurrent route applies", async () => {
    window.localStorage.setItem("id.audioRoute", JSON.stringify("speaker"));
    let resolveRoutes: (result: GetRoutesResult) => void = () => {};
    const routesPromise = new Promise<GetRoutesResult>((resolve) => {
      resolveRoutes = resolve;
    });
    mocks.getAvailableRoutes.mockReturnValue(routesPromise);
    mocks.setRoute.mockResolvedValue({ active: "speaker" });

    const first = applyStoredAudioRoute();
    const second = applyStoredAudioRoute();

    expect(mocks.getAvailableRoutes).toHaveBeenCalledTimes(1);

    resolveRoutes({
      routes,
      active: "earpiece",
    });

    await expect(first).resolves.toBe("speaker");
    await expect(second).resolves.toBe("speaker");
    expect(mocks.setRoute).toHaveBeenCalledTimes(1);
    expect(mocks.setRoute).toHaveBeenCalledWith({ route: "speaker" });
  });
});
