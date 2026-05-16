import { Client, type IMessage } from '@stomp/stompjs';
import { getAccessToken } from './api';
import type {
  OrderNotificationPayload,
  RouteLocationPayload,
  TrackingLocationPayload,
} from '../types/realtime';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

type RealtimeClientOptions = {
  onConnect?: () => void;
  onDisconnect?: () => void;
};

function logDevError(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
}

function safeParseMessage<T>(message: IMessage): T | null {
  if (!message.body) {
    return null;
  }

  try {
    return JSON.parse(message.body) as T;
  } catch {
    logDevError('WebSocket payload invalido:', message.body);
    return null;
  }
}

export function createRealtimeClient(options: RealtimeClientOptions = {}): Client {
  const token = getAccessToken();
  const connectHeaders: Record<string, string> = {};

  if (token) {
    connectHeaders.Authorization = `Bearer ${token}`;
  }

  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    connectHeaders,
    debug: import.meta.env.DEV ? message => console.debug('[STOMP]', message) : () => undefined,
    onConnect: () => {
      options.onConnect?.();
    },
    onDisconnect: () => {
      options.onDisconnect?.();
    },
    onStompError: frame => {
      logDevError('STOMP error:', frame.headers['message'], frame.body);
    },
    onWebSocketError: event => {
      logDevError('WebSocket error:', event);
    },
  });

  return client;
}

export function subscribeToSupplierOrders(
  supplierId: string,
  callback: (payload: OrderNotificationPayload) => void,
) {
  const client = createRealtimeClient();

  client.onConnect = () => {
    client.subscribe(`/topic/orders/${supplierId}`, message => {
      const payload = safeParseMessage<OrderNotificationPayload>(message);
      if (payload) {
        callback(payload);
      }
    });
  };

  client.activate();

  return () => {
    void client.deactivate();
  };
}

export function subscribeToOrderTracking(
  orderId: string,
  callback: (payload: TrackingLocationPayload) => void,
) {
  const client = createRealtimeClient();

  client.onConnect = () => {
    client.subscribe(`/topic/tracking/${orderId}`, message => {
      const payload = safeParseMessage<TrackingLocationPayload>(message);
      if (payload) {
        callback(payload);
      }
    });
  };

  client.activate();

  return () => {
    void client.deactivate();
  };
}

export function subscribeToRouteLocation(
  routeId: string,
  callback: (payload: RouteLocationPayload) => void,
) {
  const client = createRealtimeClient();

  client.onConnect = () => {
    client.subscribe(`/topic/routes/${routeId}/location`, message => {
      const payload = safeParseMessage<RouteLocationPayload>(message);
      if (payload) {
        callback(payload);
      }
    });
  };

  client.activate();

  return () => {
    void client.deactivate();
  };
}

export async function publishTrackingLocation(payload: TrackingLocationPayload): Promise<void> {
  await new Promise<void>(resolve => {
    const client = createRealtimeClient();

    client.onConnect = () => {
      try {
        client.publish({
          destination: '/app/tracking/location',
          body: JSON.stringify(payload),
        });
      } catch (error) {
        logDevError('Falha ao publicar tracking location:', error);
      } finally {
        void client.deactivate();
        resolve();
      }
    };

    client.activate();
  });
}
