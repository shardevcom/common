# Realtime

## Que ofrece

El modulo `realtime` define una interfaz comun para proveedores de eventos en tiempo real.

Incluye:

- tipos `RealtimeAdapter`, `RealtimeFilter`, `RealtimeEvent`, `RealtimeSubscription`
- `RealTimeProvider`
- `RealtimeContext`
- hooks `useRealTime` y `useRealtimeSubscription`
- clase base `BaseRealtimeAdapter`

## RealTimeProvider

```tsx
import { RealTimeProvider } from "@shardev/common";

<RealTimeProvider adapter={realtimeAdapter}>
  <App />
</RealTimeProvider>;
```

## Contrato RealtimeAdapter

```ts
interface RealtimeAdapter {
  subscribe(
    channel: string,
    filter: RealtimeFilter,
    callback: (event: RealtimeEvent) => void
  ): Promise<RealtimeSubscription>;
  connect(): void;
  disconnect(): void;
  unsubscribe(channel: string): void;
  getStatus?(): RealtimeAdapterStatus;
  setAuthToken?(token?: string): void;
}
```

## Tipos clave

### RealtimeFilter

Define:

- `table`
- `schema`
- `filter`
- `event`
- `eventName`
- `channelType`

`event` puede ser `INSERT`, `UPDATE`, `DELETE`, `MESSAGE` o `*`.

### RealtimeEvent

Representa el evento normalizado que recibe la UI:

- `eventType`
- `channel`
- `table`
- `schema`
- `eventName`
- `record`
- `oldRecord`
- `raw`
- `receivedAt`

## Hook useRealTime

Retorna el adapter configurado en contexto.

```tsx
const realtime = useRealTime();
```

## Hook useRealtimeSubscription

Es un hook de conveniencia para consumir suscripciones y exponer estado listo para UI:

- `connected`
- `lastEventAt`
- `error`

```tsx
const { connected, lastEventAt, error } = useRealtimeSubscription({
  channel: "account.1",
  filter: {
    channelType: "private",
    eventName: ".TokenWalletChange",
  },
  onEvent: (event) => {
    console.log(event.record);
  },
});
```

## Adapter Firebase

`RealtimeFirebaseAdapter` usa Firebase Realtime Database.

### Caracteristicas

- inicializa Firebase con `config.options`
- se suscribe con `onValue`
- normaliza los eventos hacia la forma `RealtimeEvent`
- puede emitir una o varias notificaciones dependiendo del filtro solicitado

### Requisito

- `options` debe contener la configuracion de Firebase

## Adapter Reverb

`RealtimeReverbAdapter` usa `laravel-echo` y `pusher-js` para integrarse con Laravel Reverb.

### Caracteristicas

- conexion y reconexion sobre Echo/Reverb
- soporte para canales `public`, `private` y `presence`
- actualizacion de token via `setAuthToken`
- reporte de estado via `getStatus`
- manejo de callback `onUnauthorized`
- parseo defensivo del payload recibido

## Ejemplo

```tsx
import React from "react";
import { useRealtimeSubscription } from "@shardev/common";

export function OrdersWatcher() {
  const { connected, lastEventAt } = useRealtimeSubscription({
    channel: "orders",
    filter: {
      channelType: "private",
      eventName: ".OrderUpdated",
    },
    onEvent: (event) => {
      console.log(event.eventType, event.record);
    },
  });

  return null;
}
```
