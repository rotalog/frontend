import type { RealtimeConnectionOptions, RealtimeEvent } from '../types/realtime';

const WS_URL = (import.meta.env.VITE_WS_URL ?? '').trim();
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 2000;

function logDev(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log('[realtime]', ...args);
  }
}

function warnDev(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.warn('[realtime]', ...args);
  }
}

function parseRealtimeMessage(rawMessage: string): RealtimeEvent {
  try {
    const parsed = JSON.parse(rawMessage) as unknown;

    if (parsed && typeof parsed === 'object') {
      const event = parsed as RealtimeEvent;
      return {
        ...event,
        type: typeof event.type === 'string' ? event.type : 'MESSAGE',
      };
    }

    return {
      type: 'MESSAGE',
      payload: parsed,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      type: 'MESSAGE',
      payload: rawMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

export function connectRealtime(options: RealtimeConnectionOptions = {}): () => void {
  if (!WS_URL) {
    warnDev('VITE_WS_URL não definido. Conexão realtime desativada.');
    return () => undefined;
  }

  let socket: WebSocket | null = null;
  let reconnectTimeoutId: number | null = null;
  let isCleanupRequested = false;
  let reconnectAttempts = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimeoutId !== null) {
      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  };

  const scheduleReconnect = () => {
    if (isCleanupRequested || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * (2 ** reconnectAttempts);
    reconnectAttempts += 1;

    logDev(`Tentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) em ${delay}ms.`);

    reconnectTimeoutId = window.setTimeout(() => {
      reconnectTimeoutId = null;
      openConnection();
    }, delay);
  };

  const openConnection = () => {
    if (isCleanupRequested) {
      return;
    }

    try {
      // If backend requires auth by query param or subprotocol, configure here.
      // Example: new WebSocket(`${WS_URL}?token=...`) or new WebSocket(WS_URL, ['protocol']).
      socket = new WebSocket(WS_URL);
    } catch (error) {
      warnDev('Falha ao inicializar WebSocket.', error);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      reconnectAttempts = 0;
      logDev('Conexão estabelecida.');
      options.onOpen?.();
    };

    socket.onmessage = (messageEvent: MessageEvent<string>) => {
      const event = parseRealtimeMessage(messageEvent.data);
      options.onEvent?.(event);
    };

    socket.onerror = (event: Event) => {
      warnDev('Erro na conexão WebSocket.', event);
      options.onError?.(event);
    };

    socket.onclose = () => {
      options.onClose?.();
      socket = null;

      if (isCleanupRequested) {
        logDev('Conexão encerrada por cleanup.');
        return;
      }

      warnDev('Conexão encerrada inesperadamente.');
      scheduleReconnect();
    };
  };

  openConnection();

  return () => {
    isCleanupRequested = true;
    clearReconnectTimer();

    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }

    socket = null;
  };
}
