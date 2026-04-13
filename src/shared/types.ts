import type { MESSAGE_TYPES } from "./constants";
import type { FadeCurveConfig } from "./fade";

export interface PersistedTimerState {
  endTime: number;
  fadeStartTime: number;
  fadeDuration: number;
  originalVolume: number;
  fadeCurvePoints?: number[];
  active: boolean;
}

export interface ContentTimerState {
  panelOpen: boolean;
  timerActive: boolean;
  selectedSeconds: number;
  fadeDuration: number;
  fadeCurveConfig: FadeCurveConfig;
  fadeCurvePoints: number[];
  endTime: number | null;
  fadeStartTime: number | null;
  originalVolume: number;
  isFading: boolean;
}

export interface SetTimerMessage {
  type: (typeof MESSAGE_TYPES)["SET_TIMER"];
  seconds: number;
  fadeDuration: number;
  originalVolume: number;
  fadeCurvePoints: number[];
}

export interface CancelTimerMessage {
  type: (typeof MESSAGE_TYPES)["CANCEL_TIMER"];
}

export interface GetTimerMessage {
  type: (typeof MESSAGE_TYPES)["GET_TIMER"];
}

export interface StartFadeMessage {
  type: (typeof MESSAGE_TYPES)["START_FADE"];
}

export type RuntimeMessage =
  | SetTimerMessage
  | CancelTimerMessage
  | GetTimerMessage
  | StartFadeMessage;
