# Adapters disponibles

## Resumen

Los adapters son la pieza que conecta los contratos del paquete con implementaciones concretas.

## Auth

### `AuthAbilityAdapter`

Ruta publica:

```ts
import { AuthAbilityAdapter } from "@shardev/common";
```

Uso recomendado:

- apps con roles y permisos
- integraciones basadas en `@casl/ability`
- flujos donde el usuario autenticado vive en Redux

## Data

### `DataRestAdapter`

Ruta publica:

```ts
import { DataRestAdapter } from "@shardev/common";
```

Uso recomendado:

- APIs REST tradicionales
- backends Laravel, Node, Rails o similares
- proyectos que necesiten soporte CRUD general, import/export y auth simple

### `DataSupabaseAdapter`

Ruta publica:

```ts
import { DataSupabaseAdapter } from "@shardev/common";
```

Uso recomendado:

- apps basadas en Supabase
- proyectos que quieran usar Postgres, auth, storage y realtime desde un solo proveedor

## Realtime

### `RealtimeFirebaseAdapter`

Ruta publica:

```ts
import { RealtimeFirebaseAdapter } from "@shardev/common";
```

Uso recomendado:

- proyectos que ya usan Firebase Realtime Database

### `RealtimeReverbAdapter`

Ruta publica:

```ts
import { RealtimeReverbAdapter } from "@shardev/common";
```

Uso recomendado:

- apps con backend Laravel y Reverb
- flujos websocket por canal (publico, privado o presencia)
- proyectos donde el token de autenticacion rota durante la sesion

#### Peer dependencies requeridas

```bash
npm install laravel-echo pusher-js
```

Versiones minimas: `laravel-echo >= 2.2`, `pusher-js >= 8.4`.

#### Uso directo (sin hook)

Solo necesario si montas el adapter fuera del ciclo de React:

```ts
import { RealtimeReverbAdapter } from "@shardev/common";

const adapter = new RealtimeReverbAdapter({
  baseURL: "https://api.example.com",
  token: "bearer-token",
  options: {
    key: "mi-reverb-app-key",
    wsHost: "ws.example.com",
    wsPort: 80,
    wssPort: 443,
    forceTLS: false,
  },
});

adapter.connect();

const subscription = await adapter.subscribe(
  "orders.42",
  { channelType: "private", eventName: ".OrderStatusUpdated" },
  (event) => console.log(event.record)
);

// Mas tarde:
subscription.unsubscribe();
adapter.disconnect();
```

#### Uso recomendado (con hook)

El hook `useReverbAdapter` gestiona el ciclo de vida, el token y la reconexion de forma automatica. Ver [documentacion de Realtime](./Realtime.md#usereverbadapter).

## Criterios para escoger

- Si tu backend principal es HTTP y tus rutas siguen convenciones REST, empieza por `DataRestAdapter`.
- Si toda tu app vive sobre Supabase, `DataSupabaseAdapter` te dara una integracion mas natural.
- Si ya trabajas con permisos tipo acciones y recursos, `AuthAbilityAdapter` es el adapter auth natural.
- Para realtime, elige el adapter segun el proveedor de eventos real de tu backend.

## Patron recomendado

No acoples tus componentes a implementaciones concretas si no hace falta.

Preferible:

- instanciar el adapter en la capa de composicion
- pasarlo al provider
- consumir la capacidad via hooks como `useData`, `usePermissions` o `useRealTime`
