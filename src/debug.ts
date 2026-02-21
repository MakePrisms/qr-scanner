let enabled = false;

export function setDebug(on: boolean): void {
  enabled = on;
}

export function debug(...args: unknown[]): void {
  if (enabled) console.debug(...args);
}
