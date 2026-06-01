export const formatMediaDeviceLabel = (
  device: Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">,
  index: number
): string => {
  const explicitLabel = device.label?.trim();
  if (explicitLabel) {
    if (device.kind === "audioinput") {
      const normalized = explicitLabel.toLowerCase();
      if (normalized === "speakerphone") return "Phone microphone";
      if (normalized === "headset earpiece") return "Earpiece microphone";
    }
    if (device.kind === "audiooutput") {
      const normalized = explicitLabel.toLowerCase();
      if (normalized === "speakerphone") return "Phone speaker";
      if (normalized === "headset earpiece") return "Phone earpiece";
    }
    return explicitLabel;
  }

  if (device.deviceId === "default" && device.kind === "audioinput") {
    return "System default microphone";
  }
  if (device.deviceId === "default" && device.kind === "audiooutput") {
    return "System default speaker";
  }
  if (device.kind === "audioinput") return `Microphone ${index + 1}`;
  if (device.kind === "audiooutput") return `Speaker ${index + 1}`;
  return `Device ${index + 1}`;
};
