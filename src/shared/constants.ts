export const ALARM_BETTER_SLEEP_TIMER_FADE_START = "better-sleep-timer-fade-start" as const;
export const ALARM_BETTER_SLEEP_TIMER_END = "better-sleep-timer-end" as const;

export const MESSAGE_TYPES = {
  START_FADE: "START_FADE",
  FINISH_TIMER: "FINISH_TIMER",
  TIMER_STATE_CHANGED: "TIMER_STATE_CHANGED",
  SET_TIMER: "SET_TIMER",
  CANCEL_TIMER: "CANCEL_TIMER",
  GET_TIMER: "GET_TIMER",
} as const;
