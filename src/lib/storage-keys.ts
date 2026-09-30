/** Where a widget's saved settings live in this browser. The editor and the account store must agree on it. */
export const widgetStorageKey = (widgetId: string) => `tally:${widgetId}:v1`;
