# Utilidades

## Que ofrece

El modulo `utils` expone helpers orientados a frontend.

## GTM

### `initGTM(gtmId)`

Inicializa Google Tag Manager usando `react-gtm-module`.

Tambien intenta leer un `nonce` desde:

```html
<meta name="csp-nonce" content="...">
```

### `useGTM(gtmId)`

Hook que inicializa GTM al montar.

```tsx
import { useGTM } from "@shardev/common";

function Layout() {
  useGTM("GTM-XXXXXXX");
  return null;
}
```

### `gtmEvent(payload)`

Envia eventos personalizados al `dataLayer`.

```ts
gtmEvent({
  event: "cta_click",
  category: "marketing",
  action: "click",
  label: "hero_button",
});
```

## Formatos

El modulo `formats` permite configurar locale/currency y formatear valores comunes.

### Configuracion

- `setFormatConfig`
- `getFormatConfig`
- `clearFormatCache`

### Helpers disponibles

- `formatMoney`
- `formatMoneyCode`
- `formatNumber`
- `formatPercent`
- `formatCompactNumber`
- `formatDate`
- `formatDateTime`
- `formatRelativeTime`
- `formatFileSize`

## Geolocalizacion

### `useGeolocation`

Obtiene la ubicacion actual del navegador y expone:

- `location`
- `error`

## Storage

El modulo `storage` expone utilidades puras, tipadas y agnosticas del dominio de la app para purgar claves de almacenamiento de forma dirigida y deterministica.

Es agnostic del backend (funciona con `localStorage`, `sessionStorage` o mocks) y de los nombres de las claves: cada app declara que claves limpiar.

### Backend de storage

```ts
interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
  clear?(): void;
}
```

### Funciones

- `purgeStorageKeys(storage, keys)` - elimina claves exactas, ordenadas y deduplicadas.
- `purgeStorageByPrefix(storage, prefix)` - elimina todas las claves que empiecen con un prefijo.
- `purgeStorageByPredicate(storage, predicate)` - elimina claves que cumplan un predicado.
- `purgeStorage(storage, target)` - despacha segun el objetivo `{ keys | prefix | predicate }`.
- `createStoragePurger(storage)` - crea un helper atado a un storage concreto.
- `createMemoryStorage(initial?)` - backend en memoria, util para pruebas y SSR.
- `countStorageKeys(storage)` / `listStorageKeys(storage)` - introspectores.

### Ejemplo

```ts
import { purgeStorageKeys } from "@shardev/common";

// CASA session cleanup: la app declara sus claves sensibles
purgeStorageKeys(localStorage, ["access_token", "refresh_token", "persist:admin"]);
```

```ts
import { createStoragePurger } from "@shardev/common";

const purger = createStoragePurger(sessionStorage);
purger.purgeByPrefix("persist:");
```

## Utilidades internas relevantes

Aunque no todas son helpers de uso cotidiano, hay utilidades internas que sostienen otras capas:

- `useSafeContext` para consumir contextos sin romper en ausencia de provider
- helpers de filtro para construir consultas de Supabase
- un helper interno de pageview para GTM presente en el repositorio, pero no documentado como API publica estable

## Recomendacion

Usa estas utilidades como soporte de la app, pero evita depender de helpers internos no documentados como contrato estable si no estan exportados claramente para tu caso de uso.
