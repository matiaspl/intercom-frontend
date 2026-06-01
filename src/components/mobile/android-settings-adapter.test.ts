import { describe, expect, it, vi } from "vitest";
import { submitAndroidSettings } from "./android-settings-adapter";

describe("submitAndroidSettings", () => {
  it("persists Android backend settings and requests production reload", () => {
    const dispatch = vi.fn();
    const writeToStorage = vi.fn();
    const removeFromStorage = vi.fn();

    submitAndroidSettings(
      {
        username: "Alice",
        audioinput: "mic1",
        audiooutput: "speaker",
        backendUrl: '"https://backend.example"',
        backendApiKey: " token ",
      },
      {
        userSettings: null,
        dispatch,
        writeToStorage,
        removeFromStorage,
      }
    );

    expect(writeToStorage).toHaveBeenCalledWith("username", "Alice");
    expect(writeToStorage).toHaveBeenCalledWith("audioinput", "mic1");
    expect(writeToStorage).toHaveBeenCalledWith("audiooutput", "speaker");
    expect(writeToStorage).toHaveBeenCalledWith(
      "backendUrl",
      "https://backend.example"
    );
    expect(writeToStorage).toHaveBeenCalledWith("backendApiKey", "token");
    expect(removeFromStorage).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "UPDATE_USER_SETTINGS",
      payload: {
        username: "Alice",
        audioinput: "mic1",
        audiooutput: "speaker",
        backendUrl: "https://backend.example",
        backendApiKey: "token",
      },
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "PRODUCTION_UPDATED" });
  });
});
