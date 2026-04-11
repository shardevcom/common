# Adapters disponibles

## Resumen

Los adapters son la pieza que conecta los contratos del paquete con implementaciones concretas.

## Auth

### `AuthAbilityAdapter`

Ruta publica:

```ts
import { AuthAbilityAdapter } from "@shardev/common/adapters/auth/ability";
```

Uso recomendado:

- apps con roles y permisos
- integraciones basadas en `@casl/ability`
- flujos donde el usuario autenticado vive en Redux

## Data

### `DataRestAdapter`

Ruta publica:

```ts
import { DataRestAdapter } from "@shardev/common/adapters/data/rest";
```

Uso recomendado:

- APIs REST tradicionales
- backends Laravel, Node, Rails o similares
- proyectos que necesiten soporte CRUD general, import/export y auth simple

### `DataSupabaseAdapter`

Ruta publica:

```ts
import { DataSupabaseAdapter } from "@shardev/common/adapters/data/supabase";
```

Uso recomendado:

- apps basadas en Supabase
- proyectos que quieran usar Postgres, auth, storage y realtime desde un solo proveedor

## Realtime

### `RealtimeFirebaseAdapter`

Ruta publica:

```ts
import { RealtimeFirebaseAdapter } from "@shardev/common/adapters/realtime/firebase";
```

Uso recomendado:

- proyectos que ya usan Firebase Realtime Database

### `RealtimeReverbAdapter`

Ruta publica:

```ts
import { RealtimeReverbAdapter } from "@shardev/common/adapters/realtime/reverb";
```

Uso recomendado:

- apps con backend Laravel y Reverb
- flujos websocket por canal

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
