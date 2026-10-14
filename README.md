# @shardev/common

**Versión:** 2.1.40+  
**Tipo:** Paquete compartido (Core Package) para aplicaciones React + Redux + TypeScript  
**Arquitectura:** Modular, tree-shakeable, type-safe, resilient

> Librería compartida para aplicaciones React construidas por Shardev. Reúne una base común para estado global, autenticación, acceso a datos, integración realtime, ruteo desacoplado y utilidades de frontend.

---

## 📦 Instalación

```bash
npm install @shardev/common
# o
yarn add @shardev/common
# o
pnpm add @shardev/common
```

### Peer Dependencies Requeridas

```json
{
  "react": "^18 || ^19",
  "react-dom": "^18 || ^19",
  "react-redux": "^9",
  "@reduxjs/toolkit": "^2",
  "redux": "^5",
  "axios": "^1.15",
  "react-router": "^7 || ^8"
}
```

### Opcionales (según adapters usados)

```json
{
  "@supabase/supabase-js": "^2.39",  // Para DataSupabaseAdapter
  "laravel-echo": "^2.2",            // Para RealtimeReverbAdapter
  "pusher-js": "^8.4",               // Para RealtimeReverbAdapter
  "firebase": "^11 || ^12",          // Para RealtimeFirebaseAdapter
  "@casl/ability": "^6.7"            // Para AuthAbilityAdapter
}
```

---

## 🚀 Quick Start

```tsx
// main.tsx
import { createApp } from '@shardev/common/factory';
import { DataRestAdapter } from '@shardev/common/adapters';
import { createStoreFactory } from '@shardev/common/store';

const dataAdapter = new DataRestAdapter({
  baseURL: import.meta.env.VITE_API_URL,
  rateLimit: { maxRetries: 3, baseDelayMs: 1000 },
  circuitBreaker: { failureThreshold: 5, timeout: 30000 }
});

const { store, persist } = createStoreFactory({
  keyName: 'my-app',
  secretKey: import.meta.env.VITE_ENCRYPTION_KEY,
  authStorageKey: 'auth_token'
});

const App = createApp({
  store,
  dataAdapter,
  routes: [/* tus rutas */]
});

render(<App />, document.getElementById('root'));
```

---

## 🏗️ Arquitectura General

```
@shardev/common
├── 📁 adapters/          # Capa de datos (REST, Supabase, Realtime, Auth)
├── 📁 data/              # Data layer: hooks, provider, context, types
├── 📁 store/             # Redux store factory, slices, middleware
├── 📁 auth/              # Autenticación y permisos (CASL)
├── 📁 realtime/          # WebSockets / Realtime (Reverb, Firebase)
├── 📁 router/            # Router protegido, parser de rutas
├── 📁 utils/             # Utilidades: storage, filter, GTM, formats
└── 📁 factory/           # Factory de app + store
```

**Principios de diseño:**
- ✅ **Type-first**: TypeScript strict, cero `any` en API pública
- ✅ **Tree-shakeable**: Imports granulares, sin side effects
- ✅ **Resilient**: Circuit breaker, retry exponencial, rate-limit handling
- ✅ **SSR-ready**: Sin dependencias de `window`/`document` en core
- ✅ **Testable**: Interfaces inyectables, mocks sencillos

---

## ✨ Novedades v2.1.40+

### 🔄 Rate Limiting Automático (HTTP 429)
- **Headers soportados**: `X-RateLimit-*`, `X-Rate-Limit-*`, `RateLimit-*`, `Retry-After`
- **Backoff exponencial** con jitter (0-30%)
- **Retry-After** en segundos o HTTP-date
- Callback `onRateLimit(info)` para observabilidad

### ⚡ Circuit Breaker
- Estados: `CLOSED` → `OPEN` → `HALF_OPEN` → `CLOSED`
- Configurable: `failureThreshold`, `successThreshold`, `timeout`, `excludedStatusCodes`
- Callback `onStateChange(state)` para métricas

### 🔁 Retry Inteligente
- **429** (Rate Limited) - Respeta `Retry-After`
- **5xx** (500, 502, 503) - Backoff exponencial
- **Network Errors** - Reintento automático
- Configurable: `maxRetries`, `baseDelayMs`, `maxDelayMs`

### 🛑 Cancelación de Peticiones
- `AbortController` por request
- `cancelRequest(resource, params)` y `cancelAll()`
- Limpieza automática en `finally`

### 🎣 Hooks Granulares (Tree-shakeable)
```tsx
import { 
  useResourceList,      // Solo listar/paginar/filtrar
  useResourceMutations, // Solo create/update/delete
  useResourceFiles,     // Solo import/export
  useRateLimitStatus    // Estado reactivo de rate limit
} from '@shardev/common/data/hooks/service';
```

### 🔐 SSR / Testing Ready
- `csrfTokenProvider`, `apiTokenProvider` inyectables
- Sin dependencias de `window`/`document` en core

---

## 📚 Documentación Completa

📖 **[DOCUMENTATION.md](./DOCUMENTATION.md)** - Guía completa con:
- Instalación y peer dependencies
- Data Layer (REST/Supabase, hooks granulares, query params, cancelación)
- Store Factory (Redux, persistencia, auth slice, middleware)
- Auth/Permisos (CASL integration)
- Realtime (Reverb + Firebase)
- Router protegido
- Utilidades (Storage CASA/GDPR, filtros Supabase, formatos, GTM)
- Configuración avanzada (Rate limiting, Circuit Breaker, SSR)
- Testing (Mocks, tests de rate limit, circuit breaker)
- API Reference completa
- Migración v2.0 → v2.1
- Troubleshooting

---

## 🧩 Módulos Principales

| Módulo | Descripción |
|--------|-------------|
| `adapters` | REST, Supabase, Realtime (Reverb/Firebase), Auth (CASL) |
| `data` | Contrato de datos, provider, hooks, servicio CRUD |
| `store` | Store factory, slices, middleware, persistencia cifrada |
| `auth` | Tipos usuario/roles/permisos, provider, hooks CASL |
| `realtime` | WebSockets (Reverb/Pusher, Firebase) |
| `router` | Rutas protegidas, parser, redirección |
| `factory` | `createApp` para apps/modulos con store |
| `utils` | Storage, filtros, GTM, formatos, eventos |

---

## 🧪 Testing

```bash
npm run test:run        # Ejecutar tests
npm run test:coverage   # Con coverage
npm run types           # TypeScript strict check
npm run lint            # ESLint
npm run build           # Build production
```

### Mocks Recomendados (vitest)

```typescript
// tests/setup.ts
vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  return {
    ...actual,
    create: vi.fn(() => ({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
      request: vi.fn(), defaults: { baseURL: 'https://test.com' }
    })),
    isAxiosError: actual.isAxiosError
  };
});
```

---

## 📋 Superficie Pública Exportada

```typescript
// Entrada principal
export * from "./data";
export * from "./store";
export * from "./realtime";
export * from "./auth";
export * from "./utils";
export * from "./router";
export * from "./factory";
export * from "./adapters";

// Adapters listos para usar
// AuthAbilityAdapter, DataRestAdapter, DataSupabaseAdapter,
// RealtimeFirebaseAdapter, RealtimeReverbAdapter
```

---

## 📄 Licencia

MIT © Elbert Tous / Shardev Team

---

## 🔗 Enlaces

- **Documentación completa:** [DOCUMENTATION.md](./DOCUMENTATION.md)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md) (si existe)
- **Issues:** [GitHub Issues](https://github.com/shardev/common/issues)