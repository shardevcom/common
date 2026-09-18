# Realtime

## Que ofrece

El modulo `realtime` define una interfaz comun para proveedores de eventos en tiempo real.

Incluye:

- tipos `RealtimeAdapter`, `RealtimeFilter`, `RealtimeEvent`, `RealtimeSubscription`
- `RealTimeProvider`
- `RealtimeContext`
- hooks `useRealTime`, `useRealtimeSubscription` y `useReverbAdapter`
- clase base `BaseRealtimeAdapter`

---

## RealTimeProvider

Envuelve el arbol de componentes y pone el adapter en contexto para que cualquier hijo pueda consumirlo.

```tsx
import { RealTimeProvider } from "@shardev/common";

<RealTimeProvider adapter={realtimeAdapter}>
  <App />
</RealTimeProvider>
```

Si `adapter` es `null`, el provider entrega un adapter seguro sin operacion real para que los hooks no fallen en entornos donde el realtime no aplique.

---

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

---

## Tipos clave

### RealtimeFilter

| Campo        | Tipo                                              | Descripcion                                          |
|--------------|---------------------------------------------------|------------------------------------------------------|
| `eventName`  | `string`                                          | Nombre del evento tal como lo emite Laravel (ej. `.OrderUpdated`). Requerido por Reverb. |
| `channelType`| `"public" \| "private" \| "presence"`             | Tipo de canal. Por defecto `"private"`.              |
| `event`      | `"INSERT" \| "UPDATE" \| "DELETE" \| "MESSAGE" \| "*"` | Filtro de tipo de evento para adapters que lo soportan. |
| `table`      | `string`                                          | Tabla origen del evento (informativo).               |
| `schema`     | `string`                                          | Schema de base de datos (informativo).               |

### RealtimeEvent

Representa el evento normalizado que recibe el callback de la UI:

| Campo        | Tipo                      | Descripcion                                     |
|--------------|---------------------------|-------------------------------------------------|
| `eventType`  | `string`                  | `INSERT`, `UPDATE`, `DELETE` o `MESSAGE`.       |
| `channel`    | `string`                  | Nombre del canal de origen.                     |
| `eventName`  | `string`                  | Nombre del evento tal como llego del servidor.  |
| `record`     | `TRecord`                 | Datos del registro actual.                      |
| `oldRecord`  | `TRecord \| undefined`    | Estado anterior del registro (si esta presente).|
| `table`      | `string \| undefined`     | Tabla de origen.                                |
| `schema`     | `string \| undefined`     | Schema de origen.                               |
| `raw`        | `unknown`                 | Payload crudo sin procesar.                     |
| `receivedAt` | `number`                  | Timestamp Unix del momento de recepcion.        |

### RealtimeAdapterStatus

```ts
interface RealtimeAdapterStatus {
  connected: boolean;
  lastEventAt?: number;
  lastError?: unknown;
}
```

---

## useReverbAdapter

Hook que crea y gestiona el ciclo de vida de un `RealtimeReverbAdapter` enlazado al store de Redux.

### Firma

```ts
function useReverbAdapter(
  config: Omit<RealtimeReverbAdapterConfig, "token" | "onUnauthorized" | "onError">
): RealtimeReverbAdapter | null
```

El hook resuelve automaticamente:

- El token de autenticacion desde `state.auth.authUser.access_token`.
- La reconexion cuando el token cambia (logout y nuevo login incluidos).
- El dispatch de `auth/logout` cuando el servidor responde 401.
- La desconexion limpia al desmontar el componente.

### Configuracion de opciones (ReverbEchoOptions)

| Opcion               | Tipo                      | Requerido | Por defecto                          | Descripcion                                      |
|----------------------|---------------------------|-----------|--------------------------------------|--------------------------------------------------|
| `key`                | `string`                  | Si        | —                                    | App key de Reverb (`REVERB_APP_KEY`).            |
| `wsHost`             | `string`                  | Si        | —                                    | Host del servidor Reverb (`REVERB_HOST`).        |
| `wsPort`             | `number`                  | No        | `80`                                 | Puerto WebSocket sin TLS.                        |
| `wssPort`            | `number`                  | No        | `443`                                | Puerto WebSocket con TLS.                        |
| `forceTLS`           | `boolean`                 | No        | `false`                              | Forzar conexion TLS/WSS.                         |
| `enabledTransports`  | `Array<"ws" \| "wss">`    | No        | `["ws", "wss"]`                      | Transportes habilitados.                         |
| `authEndpoint`       | `string`                  | No        | `{baseURL}/broadcasting/auth`        | Endpoint de autenticacion de canales privados.   |
| `auth.headers`       | `Record<string, string>`  | No        | `{}`                                 | Headers extra para el handshake de autenticacion.|

### Ejemplo minimo

```tsx
// src/providers/RealtimeSetup.tsx
import { useReverbAdapter, RealTimeProvider } from "@shardev/common";

export function RealtimeSetup({ children }: { children: React.ReactNode }) {
  const adapter = useReverbAdapter({
    baseURL: import.meta.env.VITE_API_URL,
    options: {
      key: import.meta.env.VITE_REVERB_APP_KEY,
      wsHost: import.meta.env.VITE_REVERB_HOST,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
      forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
    },
  });

  return <RealTimeProvider adapter={adapter}>{children}</RealTimeProvider>;
}
```

```tsx
// src/main.tsx
import { RealtimeSetup } from "./providers/RealtimeSetup";

createRoot(document.getElementById("root")!).render(
  <StoreProvider config={{ keyName: "app", secretKey: "app-v1" }}>
    <AuthProvider adapter={authAdapter}>
      <DataProvider adapter={dataAdapter}>
        <RealtimeSetup>
          <RouterProvider routes={routes} />
        </RealtimeSetup>
      </DataProvider>
    </AuthProvider>
  </StoreProvider>
);
```

### Variables de entorno (.env)

Las variables de entorno del lado de React deben corresponder a las del backend Laravel:

| Variable Vite                  | Variable Laravel            | Descripcion                          |
|--------------------------------|-----------------------------|--------------------------------------|
| `VITE_REVERB_APP_KEY`          | `REVERB_APP_KEY`            | Clave publica de la app Reverb.      |
| `VITE_REVERB_HOST`             | `REVERB_HOST`               | Hostname del servidor Reverb.        |
| `VITE_REVERB_PORT`             | `REVERB_PORT`               | Puerto del servidor Reverb.          |
| `VITE_REVERB_SCHEME`           | `REVERB_SCHEME`             | `http` o `https`.                    |
| `VITE_API_URL`                 | `APP_URL`                   | URL base del backend Laravel.        |

### Canales soportados

| Tipo        | `channelType`  | Uso tipico                                          |
|-------------|----------------|-----------------------------------------------------|
| Publico     | `"public"`     | Eventos sin autenticacion (ej. anuncios globales).  |
| Privado     | `"private"`    | Eventos de un recurso especifico del usuario.       |
| Presencia   | `"presence"`   | Rastreo de usuarios conectados en un espacio comun. |

Los canales `private` y `presence` realizan un handshake HTTP contra `authEndpoint` antes de conectarse. El header `Authorization: Bearer <token>` se agrega automaticamente.

### Rotacion de token

Cuando el usuario cierra sesion y vuelve a autenticarse, el hook detecta el cambio en `state.auth.authUser.access_token` y llama a `setAuthToken` del adapter. El adapter:

1. Toma un snapshot de todas las suscripciones activas con sus listeners.
2. Desconecta el Echo actual.
3. Crea una nueva instancia de Echo con el nuevo token en el header `Authorization`.
4. Restaura todas las suscripciones en los nuevos canales.
5. Reconecta.

No es necesario hacer nada en el componente para que esto funcione.

### Reconexion automatica

Si la conexion se pierde, el adapter intenta reconectarse con backoff exponencial:

- Hasta 5 intentos.
- Delay inicial de 1 segundo, duplicado en cada intento (`1s, 2s, 4s, 8s, 16s`).

---

## Hook useRealtimeSubscription

Hook de conveniencia que gestiona el ciclo de vida de una suscripcion individual y expone estado para la UI.

### Firma

```ts
function useRealtimeSubscription<TRecord>(options: {
  channel: string | null;
  filter: RealtimeFilter;
  onEvent: (event: RealtimeEvent<TRecord>) => void;
  enabled?: boolean;
  statusIntervalMs?: number;
}): {
  connected: boolean;
  lastEventAt: number | undefined;
  error: unknown;
}
```

| Opcion            | Tipo                 | Por defecto | Descripcion                                              |
|-------------------|----------------------|-------------|----------------------------------------------------------|
| `channel`         | `string \| null`     | —           | Nombre del canal. Si es `null`, no suscribe.             |
| `filter`          | `RealtimeFilter`     | —           | Configuracion del evento a escuchar.                     |
| `onEvent`         | `function`           | —           | Callback con el evento normalizado.                      |
| `enabled`         | `boolean`            | `true`      | Permite desactivar la suscripcion condicionalmente.      |
| `statusIntervalMs`| `number`             | `1000`      | Intervalo en ms para actualizar el estado de conexion.   |

### Ejemplo con canal privado

```tsx
import { useRealtimeSubscription } from "@shardev/common";

interface OrderRecord {
  id: number;
  status: string;
  total: number;
}

export function OrderStatusWatcher({ orderId }: { orderId: number }) {
  const { connected, lastEventAt } = useRealtimeSubscription<OrderRecord>({
    channel: `orders.${orderId}`,
    filter: {
      channelType: "private",
      eventName: ".OrderStatusUpdated",
    },
    onEvent: (event) => {
      console.log("Nuevo estado:", event.record.status);
    },
  });

  return (
    <span>{connected ? "En vivo" : "Desconectado"}</span>
  );
}
```

### Ejemplo con canal de presencia

```tsx
import { useRealtimeSubscription } from "@shardev/common";

export function RoomPresence({ roomId }: { roomId: string }) {
  const { connected } = useRealtimeSubscription({
    channel: `room.${roomId}`,
    filter: {
      channelType: "presence",
      eventName: ".UserJoined",
    },
    onEvent: (event) => {
      console.log("Usuario entro:", event.record);
    },
  });

  return null;
}
```

### Ejemplo con canal publico

```tsx
import { useRealtimeSubscription } from "@shardev/common";

export function AnnouncementBanner() {
  const [message, setMessage] = React.useState<string | null>(null);

  useRealtimeSubscription({
    channel: "announcements",
    filter: {
      channelType: "public",
      eventName: ".NewAnnouncement",
    },
    onEvent: (event) => {
      setMessage((event.record as any).text);
    },
  });

  if (!message) return null;
  return <div className="banner">{message}</div>;
}
```

### Suscripcion condicional

Pasa `channel: null` o `enabled: false` para desactivar la suscripcion sin desmontar el componente:

```tsx
useRealtimeSubscription({
  channel: isAuthenticated ? `user.${userId}` : null,
  filter: {
    channelType: "private",
    eventName: ".NotificationReceived",
  },
  onEvent: (event) => handleNotification(event.record),
});
```

---

## Hook useRealTime

Retorna el adapter configurado en el contexto. Util cuando necesitas acceso directo al adapter fuera de `useRealtimeSubscription`.

```tsx
import { useRealTime } from "@shardev/common";

const adapter = useRealTime();
const status = adapter.getStatus?.();
```

Lanza si se usa fuera de `RealTimeProvider`.

---

## Integracion completa con Laravel

### Backend (Laravel 11+)

En `config/broadcasting.php` el canal privado debe tener su ruta de autenticacion:

```php
// routes/channels.php
Broadcast::channel('orders.{orderId}', function ($user, $orderId) {
    return $user->can('view', Order::find($orderId));
});
```

El evento de Laravel debe implementar `ShouldBroadcast`:

```php
class OrderStatusUpdated implements ShouldBroadcast
{
    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("orders.{$this->order->id}")];
    }

    public function broadcastAs(): string
    {
        return 'OrderStatusUpdated'; // Laravel Echo recibe ".OrderStatusUpdated"
    }
}
```

### Frontend (React)

```tsx
// src/providers/RealtimeSetup.tsx
import { useReverbAdapter, RealTimeProvider } from "@shardev/common";

export function RealtimeSetup({ children }: { children: React.ReactNode }) {
  const adapter = useReverbAdapter({
    baseURL: import.meta.env.VITE_API_URL,
    options: {
      key: import.meta.env.VITE_REVERB_APP_KEY,
      wsHost: import.meta.env.VITE_REVERB_HOST,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
      forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
    },
  });

  return <RealTimeProvider adapter={adapter}>{children}</RealTimeProvider>;
}

// src/features/orders/OrderCard.tsx
import { useRealtimeSubscription } from "@shardev/common";

export function OrderCard({ order }: { order: Order }) {
  const [currentOrder, setCurrentOrder] = React.useState(order);

  useRealtimeSubscription<Order>({
    channel: `orders.${order.id}`,
    filter: {
      channelType: "private",
      eventName: ".OrderStatusUpdated",
    },
    onEvent: (event) => {
      setCurrentOrder(event.record);
    },
  });

  return <div>{currentOrder.status}</div>;
}
```

---

## Adapter Firebase

`RealtimeFirebaseAdapter` usa Firebase Realtime Database.

### Caracteristicas

- inicializa Firebase con `config.options` (el objeto de configuracion de Firebase)
- se suscribe con `onValue` de la SDK de Firebase
- normaliza los eventos hacia la forma `RealtimeEvent`
- puede emitir `INSERT`, `UPDATE` y `DELETE` dependiendo del filtro

### Requisito

`options` debe contener el objeto de configuracion de Firebase:

```ts
import { RealtimeFirebaseAdapter } from "@shardev/common";

const adapter = new RealtimeFirebaseAdapter({
  options: {
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
  },
});
```
