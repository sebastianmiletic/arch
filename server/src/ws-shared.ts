let _broadcast: ((data: any) => void) | null = null;

export function setBroadcast(fn: (data: any) => void) {
  _broadcast = fn;
}

export function broadcast(data: any) {
  if (_broadcast) _broadcast(data);
}
