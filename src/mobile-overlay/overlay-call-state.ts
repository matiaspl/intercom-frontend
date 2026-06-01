import { getCallState, getCallOverlayLabel } from "./action-handlers";

/** Stable row order for overlay indices (Object.keys order is not guaranteed). */
export const getSortedCallIds = (
  calls: Record<string, unknown> | null | undefined
): string[] => Object.keys(calls || {}).sort();

export const resolveCallIdAtIndex = (
  calls: Record<string, unknown> | null | undefined,
  index: number | undefined
): string | undefined => {
  const ids = getSortedCallIds(calls);
  if (typeof index !== "number" || index < 0 || index >= ids.length) {
    return undefined;
  }
  return ids[index];
};

export type OverlayRowState = {
  ids: string[];
  latch: boolean[];
  listen: boolean[];
  micAllowed: boolean[];
  listenAllowed: boolean[];
  labels: string[];
  activity: boolean[];
};

export const buildOverlayRowState = (
  calls: Record<string, any>
): OverlayRowState => {
  const ids = getSortedCallIds(calls);
  const latch = ids.map((id) => {
    const s = getCallState(id);
    if (s) return !s.isInputMuted;
    const ms: MediaStream | null = calls[id]?.mediaStreamInput || null;
    return !!(ms && ms.getAudioTracks().some((t) => t.enabled));
  });
  const listen = ids.map((id) => {
    const s = getCallState(id);
    if (s) return !s.isOutputMuted;
    const els: HTMLAudioElement[] | null = calls[id]?.audioElements || null;
    if (!els || els.length === 0) return true;
    return els.some((el) => !el.muted);
  });
  const micAllowed = ids.map((id) => {
    const jp = calls[id]?.joinProductionOptions || {};
    const isPgm = !!jp?.lineUsedForProgramOutput;
    const isProgramUser = !!jp?.isProgramUser;
    return !(isPgm && !isProgramUser);
  });
  const listenAllowed = ids.map(() => true);
  const labels = ids.map((id, index) => {
    const named = getCallOverlayLabel(id);
    if (named) return named;
    const jp = calls[id]?.joinProductionOptions || {};
    if (jp.lineName) return jp.lineName;
    if (jp.lineId) return `Line ${jp.lineId}`;
    return `Call ${index + 1}`;
  });
  const activity = ids.map((id) => !!calls[id]?.audioLevelAboveThreshold);
  return { ids, latch, listen, micAllowed, listenAllowed, labels, activity };
};
