# Data provider y servicios CRUD

## Que ofrece

El modulo `data` define una capa uniforme para acceso a datos.

Incluye:

- tipos como `DataAdapter`, `DataProviderResponse`, `PaginatedData`, `QueryFilter`, `SortCondition`
- `DataProvider`
- `DataContext`
- hooks `useData`, `useRestApiAdapter`, `useResourceService`
- clase base `BaseDataAdapter`

## DataProvider

`DataProvider` inyecta un adapter concreto.

```tsx
import { DataProvider } from "@shardev/common";

<DataProvider adapter={dataAdapter}>
  <App />
</DataProvider>;
```

## Contrato DataAdapter

El paquete espera que un adapter implemente operaciones como:

- `fetch`
- `fetchMany`
- `fetchOne`
- `fetchById`
- `insert`
- `modify`
- `upsert`
- `remove`

De forma opcional puede implementar:

- `upload`
- `uploadFile`
- `downloadFile`
- `removeMany`
- `modifyMany`
- `count`
- `subscribe`
- `unsubscribe`
- `signIn`
- `signUp`
- `signOut`
- otros metodos de auth avanzados

## Respuesta estandar

Todas las operaciones retornan o normalizan a:

```ts
interface DataProviderResponse<T = any, E = Record<string, unknown>> {
  success: boolean;
  message: string;
  errors?: E;
  data: T | null;
  status: "success" | "error" | "pending" | string;
  originalError?: unknown;
}
```

Esto facilita que la UI no dependa del formato bruto del backend.

## Hook useData

Retorna el adapter actual desde contexto.

```tsx
const data = useData();
const response = await data.fetchMany("users");
```

## Hook useRestApiAdapter

Construye un `DataRestAdapter` conectado al store actual para que pueda leer token y reaccionar a expiracion de sesion.

```tsx
const restAdapter = useRestApiAdapter({
  baseURL: "https://api.example.com",
  headers: {
    "X-App": "portal",
  },
});
```

## Hook useResourceService

Es el helper de mas alto nivel del modulo `data`. Encapsula un recurso CRUD y maneja estado local de lista, paginacion, busqueda y errores.

### Estado expuesto

- `items`
- `pagination`
- `filter`
- `sort`
- `include`
- `search`
- `isLoading`
- `error`

### Acciones expuestas

- `fetchMany`
- `add`
- `update`
- `remove`
- `importFromFile`
- `exportToFile`
- `deleteMany`
- `updateMany`
- `setPage`
- `setPerPage`
- `setSearch`
- `setFilter`
- `setSort`
- `execute`

### Ejemplo

```tsx
import { useResourceService } from "@shardev/common";

type User = {
  id: string;
  name: string;
  email: string;
};

export function UsersTable() {
  const {
    items,
    pagination,
    isLoading,
    fetchMany,
    add,
    update,
    remove,
    setPage,
    setSearch,
  } = useResourceService<User>("users", {
    perPage: 20,
    autoFetch: true,
  });

  return null;
}
```

## Filtros y ordenamiento

El contrato soporta:

- `sort` simple o multiple
- `filter` estructurado
- `search`
- `fields`
- `include`

En adapters compatibles, `filter` permite operadores como `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, y agrupaciones `AND` y `OR`.

## Adapter REST

`DataRestAdapter` usa `axios` y ofrece:

- CRUD por endpoints REST
- subida de archivos
- descarga/importacion/exportacion
- autenticacion basica (`signIn`, `signUp`, `signOut`)
- lectura de token desde `state.auth.authUser`
- lectura de `csrf-token` y `api-token` desde el DOM
- `RESET_STATE` cuando el backend responde `401`

### Comportamientos esperados del backend

- `GET /resource`
- `GET /resource/:id`
- `POST /resource`
- `PATCH /resource/:id`
- `DELETE /resource/:id`
- `POST /resource/upload`
- `POST /resource/import`
- `GET /resource/export`
- `PATCH /resource/bulk-update`
- `DELETE /resource/bulk-delete`
- `GET /resource/count`

## Adapter Supabase

`DataSupabaseAdapter` implementa el mismo contrato sobre `@supabase/supabase-js`.

Incluye:

- operaciones CRUD
- filtros y ordenamiento via query builder
- `upsert`
- conteo
- subida de archivos a storage
- `signIn` y `signOut`
- `subscribe` y `unsubscribe` sobre cambios Postgres

### Requisitos minimos

- `baseURL`: URL del proyecto Supabase
- `token`: anon key

## Recomendaciones practicas

- Usa `useResourceService` para vistas CRUD convencionales.
- Usa `useData` si necesitas operaciones mas libres o avanzadas.
- Si el adapter depende del store, monta `StoreProvider` antes de `DataProvider`.
