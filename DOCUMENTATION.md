# @shardev/common - Documentación Completa

> **Versión:** 2.1.40+  
> **Tipo:** Paquete compartido (Core Package) para aplicaciones React + Redux + TypeScript  
> **Arquitectura:** Modular, tree-shakeable, type-safe, resilient

---

## 📦 Instalación

```bash
npm install @shardev/common
# o
yarn add @shardev/common
# o
pnpm add @shardev/common
```

**Peer Dependencies requeridas:**
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

**Opcionales (según adapters usados):**
```json
{
  "@supabase/supabase-js": "^2.39",  // Para DataSupabaseAdapter
  "laravel-echo": "^2.2",            // Para RealtimeReverbAdapter
  "pusher-js": "^8.4",               // Para RealtimeReverbAdapter
  "firebase": "^11 || ^12"           // Para RealtimeFirebaseAdapter
}
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

## 📚 Guías por Módulo

### 1. Data Layer (REST / Supabase)

#### Adapters Disponibles

| Adapter | Uso | Características |
|---------|-----|-----------------|
| `DataRestAdapter` | REST APIs genéricas | Axios-based, interceptors, cancelación |
| `DataSupabaseAdapter` | Supabase/PostgREST | Tipado duck-typed, realtime opcional |

#### Configuración Común

```typescript
import { DataRestAdapter, DataRestAdapterConfig } from '@shardev/common/adapters';

const adapter = new DataRestAdapter({
  baseURL: 'https://api.miempresa.com',
  token: 'opcional-static-token',
  
  // Rate limiting automático
  rateLimit: {
    maxRetries: 3,           // Reintentos totales
    baseDelayMs: 1000,       // Base para backoff exponencial
    maxDelayMs: 30000,       // Cap máximo de delay
    respectRetryAfter: true, // Respeta header Retry-After
    onRateLimit: (info) => console.warn('Rate limited:', info),
    onForbidden: () => router.navigate('/403')
  },
  
  // Circuit breaker
  circuitBreaker: {
    failureThreshold: 5,     // Fallos antes de abrir
    successThreshold: 2,     // Éxitos para cerrar
    timeout: 30000,          // ms antes de half-open
    excludedStatusCodes: [401, 403, 404, 422] // No cuentan como fallos
  },
  
  // SSR / Testing - inyectar proveedores de tokens
  csrfTokenProvider: () => getCsrfTokenFromCookie(),
  apiTokenProvider: () => getApiTokenFromHeader()
} satisfies DataRestAdapterConfig);
```

#### Uso con Hooks Granulares (Recomendado)

```tsx
import { 
  useResourceList,      // Solo listar/paginar/filtrar
  useResourceMutations, // Solo create/update/delete
  useResourceFiles,     // Solo import/export
  useRateLimitStatus    // Estado de rate limit
} from '@shardev/common/data/hooks/service';

function UsersPage() {
  // 1. LISTA con paginación, filtros, ordenamiento
  const { 
    items: users, 
    pagination, 
    isLoading, 
    fetchMany, 
    setPage, 
    setFilter,
    setSort 
  } = useResourceList<User>('users', { 
    perPage: 20, 
    autoFetch: true 
  });

  // 2. MUTACIONES separadas (tree-shakeable)
  const { add, update, remove, isSaving } = useResourceMutations<User>('users');

  // 3. ARCHIVOS
  const { importFromFile, exportToFile } = useResourceFiles<User>('users');

  // 4. RATE LIMIT STATUS
  const { isRateLimited, rateLimitInfo, clearRateLimit } = useRateLimitStatus();

  const handleCreate = async () => {
    const result = await add({ name: 'Nuevo', email: 'nuevo@test.com' });
    if (!result.success) toast.error(result.message);
  };

  return (
    <div>
      {isRateLimited && (
        <Alert>Rate limited. Retry in {rateLimitInfo?.retryAfter}s</Alert>
      )}
      <UserTable 
        users={users} 
        loading={isLoading} 
        pagination={pagination}
        onPageChange={setPage}
        onSort={setSort}
      />
      <Button onClick={handleCreate} loading={isSaving}>Crear</Button>
    </div>
  );
}
```

#### Hook Legacy (Backward Compatible)

```tsx
// ⚠️ Expone TODO el estado + 19 funciones - usar solo si migras
const { 
  items, pagination, isLoading, isSaving, isRateLimited,
  fetchMany, add, update, remove, upsert, deleteMany, 
  importFromFile, exportToFile, setPage, setFilter, clearRateLimit,
  // ... 19 propiedades
} = useResourceService<User>('users', { perPage: 20 });
```

#### Parámetros de Query Avanzados

```typescript
const { fetchMany } = useResourceList<User>('users');

await fetchMany({
  page: 2,
  perPage: 50,
  search: 'juan',
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: {
    // Filtros simples
    status: 'active',
    role: { operator: 'in', value: ['admin', 'editor'] },
    
    // Filtros complejos con AND/OR
    AND: [
      { department: 'engineering' },
      { OR: [{ seniority: 'senior' }, { lead: true }] }
    ]
  },
  include: ['profile', 'posts.comments'] // Nested includes
});
```

#### Manejo de Errores Tipado

```typescript
const result = await add({ name: 'Test' });

if (!result.success) {
  // result.errors está tipado según tu tipo E
  // result.rateLimit disponible si fue 429
  // result.originalError para debugging
  
  switch (result.originalError?.response?.status) {
    case 422:
      // Validation errors en result.errors
      break;
    case 409:
      // Conflict
      break;
    case 429:
      // Rate limited - result.rateLimit.retryAfter
      break;
  }
}
```

#### Cancelación de Peticiones

```tsx
function SearchComponent() {
  const { fetchMany, cancelRequest } = useResourceList<User>('users');
  const abortRef = useRef<AbortController>();

  const handleSearch = async (query: string) => {
    // Cancelar búsqueda anterior
    cancelRequest('users', { search: query });
    
    // O cancelar TODAS las peticiones pendientes
    // adapter.cancelAll(); // Acceso directo al adapter si necesario
    
    await fetchMany({ search: query });
  };

  return <input onChange={e => handleSearch(e.target.value)} />;
}
```

---

### 2. Store Factory (Redux + Persistencia)

```typescript
import { createStoreFactory, createEncryptor } from '@shardev/common/store/factory';
import { authSlice } from '@shardev/common/store/slices';

const { store, persist, addReducers, purge } = createStoreFactory({
  // Configuración obligatoria
  keyName: 'my-app-storage',
  secretKey: import.meta.env.VITE_ENCRYPTION_KEY, // Para encryptor
  
  // Slices adicionales (se mergean con authSlice por defecto)
  slices: {
    ui: uiReducer,
    cart: cartReducer
  },
  
  // Middleware custom
  middlewares: [logger, analyticsMiddleware],
  
  // Storage custom (default: localStorage via redux-persist)
  storage: customStorage,
  
  // Clave para persistir token en storage separado
  authStorageKey: 'auth_token',
  
  // Claves adicionales a purgar en logout
  purgeKeys: ['custom_key_1', 'custom_key_2'],
  
  // Estado inicial
  initialState: { auth: initialAuthState }
});

// Agregar reducers dinámicamente (code splitting)
addReducers({ lazyFeature: lazyReducer });

// Purga selectiva (GDPR, logout, etc.)
await purge({ 
  prefix: 'user_',           // Todas las keys que empiezan con user_
  // O keys exactas:
  // keys: ['specific_key']
  // O predicado:
  // predicate: (key) => key.includes('temp')
});
```

#### Auth Slice (Incluido por defecto)

```typescript
import { authSlice, authReducer } from '@shardev/common/store/slices';
import { useAppDispatch, useAppSelector } from '@shardev/common/store';

const { initAuth, logout, setAuth } = authSlice.actions;

// En componente
const authUser = useAppSelector(state => state.auth.authUser);
const dispatch = useAppDispatch();

const login = async (credentials) => {
  const result = await dataAdapter.signIn(credentials);
  if (result.success) {
    dispatch(setAuth(result.data)); // Persiste automáticamente via middleware
  }
};
```

#### Middleware de Auth Storage

```typescript
// Automáticamente incluido si pasas `authStorageKey` en createStoreFactory
// Sincroniza access_token en storage externo (cookies, secure storage, etc.)
// Se ejecuta en: setAuth, initAuth, logout, RESET_STATE
```

---

### 3. Autenticación y Permisos (CASL)

```tsx
import { AuthProvider, usePermissions } from '@shardev/common/auth';
import { AuthAbilityAdapter } from '@shardev/common/adapters';

// Provider en root
<AuthProvider adapter={myPermissionAdapter}>
  <App />
</AuthProvider>

// Hook de permisos
function AdminPanel() {
  const permissions = usePermissions();
  
  if (!permissions.can('manage', 'User')) {
    return <Forbidden />;
  }
  
  return <UserManagement />;
}

// Adapter de habilidades tipado
const ability = useAuthAbilityAdapter('api', ['read', 'write', 'delete']);
const canDelete = ability?.can('delete', 'Post');
```

---

### 4. Realtime (WebSockets)

#### Reverb (Laravel Echo / Pusher)

```tsx
import { useReverbAdapter } from '@shardev/common/realtime/hooks/reverb-adapter';

function LiveNotifications() {
  const adapter = useReverbAdapter({
    broadcaster: 'reverb',
    host: import.meta.env.VITE_REVERB_HOST,
    key: import.meta.env.VITE_REVERB_KEY,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    // token, onUnauthorized, onError se inyectan automáticamente
  });

  useEffect(() => {
    if (!adapter) return;
    
    const channel = adapter.subscribe('notifications', (notification) => {
      toast.info(notification.message);
    });
    
    return () => adapter.unsubscribe('notifications');
  }, [adapter]);

  return null; // O indicador de conexión
}
```

#### Firebase

```tsx
import { useFirebaseAdapter } from '@shardev/common/realtime/hooks/firebase-adapter';

function ChatRoom({ roomId }) {
  const adapter = useFirebaseAdapter({
    config: firebaseConfig,
    roomId
  });
  
  // Similar API: subscribe, unsubscribe, send
}
```

---

### 5. Router Protegido

```tsx
import { ProtectedRoute, Redirect } from '@shardev/common/router';

<Routes>
  <Route 
    path="/admin/*" 
    element={
      <ProtectedRoute 
        permissions={['manage', 'User']}
        fallback={<Navigate to="/login" />}
      >
        <AdminLayout />
      </ProtectedRoute>
    } 
  />
  <Route path="/login" element={<Login />} />
  <Route path="/unauthorized" element={<Unauthorized />} />
</Routes>
```

---

### 6. Utilidades

#### Storage Seguro (CASA/GDPR)

```typescript
import { 
  createStoragePurger, 
  createMemoryStorage,
  purgeStorage,
  PurgeTarget 
} from '@shardev/common/utils/storage';

// En tests
const memoryStorage = createMemoryStorage();

// En producción - purga selectiva
const purger = createStoragePurger(localStorage);

await purger.purge({ 
  keys: ['user_session', 'auth_token'],
  prefix: 'temp_',
  predicate: (key) => key.startsWith('cache_')
});

// Resultado tipado
interface PurgeResult {
  purged: string[];      // Keys eliminadas
  remaining: number;     // Keys restantes
}
```

#### Filtros y Queries (Supabase)

```typescript
import { buildQuery, normalizeFilterValue, applyFilters } from '@shardev/common/utils/filter';

const query = buildQuery(supabaseClient, 'posts', {
  fields: ['id', 'title', 'author.name'],
  include: ['author', 'tags'],
  filter: {
    status: 'published',
    OR: [
      { category: 'tech' },
      { author_id: { operator: 'eq', value: currentUserId } }
    ],
    created_at: { operator: 'gte', value: '2024-01-01' }
  },
  sort: [{ field: 'created_at', order: 'desc' }],
  pagination: { page: 1, perPage: 20 }
});

// Retorna PostgrestQueryBuilder tipado para encadenar .then()
```

#### Formatos

```typescript
import { formatCurrency, formatDate, formatNumber } from '@shardev/common/utils/formats';

formatCurrency(1234.56, 'USD', 'es-AR'); // "$1,234.56"
formatDate(new Date(), 'short', 'es-AR'); // "15/10/2024"
formatNumber(1000000, 'es-AR'); // "1.000.000"
```

#### GTM (Google Tag Manager)

```tsx
import { useGTM, initGTM } from '@shardev/common/utils/gtm';

function App() {
  useGTM(import.meta.env.VITE_GTM_ID);
  
  return <Router>...</Router>;
}

// Eventos
import { trackEvent, trackPageView } from '@shardev/common/utils/gtm/events';

trackEvent('purchase', { value: 100, currency: 'USD' });
trackPageView('/checkout');
```

---

## ⚙️ Configuración Avanzada

### Rate Limiting - Comportamiento Detallado

```
┌─────────────────────────────────────────────────────────────┐
│ REQUEST                                                     │
│    │                                                        │
│    ▼                                                        │
│ ┌─────────┐    429/5xx/Network    ┌─────────────────────┐  │
│ │ Circuit │──────────────────────▶│ Retry con backoff   │  │
│ │ Breaker │                       │ + jitter (0-30%)    │  │
│ └────┬────┘                       └──────────┬──────────┘  │
│      │                                       │             │
│      │ Success                               │ Max retries │
│      ▼                                       ▼             │
│ ┌─────────┐                          ┌─────────────────┐  │
│ │ Return  │                          │ Throw with      │  │
│ │ data    │                          │ rateLimit info  │  │
│ └─────────┘                          └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Headers soportados (auto-detectados):**
- `X-RateLimit-Limit` / `X-Rate-Limit-Limit` / `RateLimit-Limit`
- `X-RateLimit-Remaining` / `X-Rate-Limit-Remaining` / `RateLimit-Remaining`
- `X-RateLimit-Reset` / `X-Rate-Limit-Reset` / `RateLimit-Reset`
- `Retry-After` (segundos o HTTP-date)

**RateLimitInfo devuelto:**
```typescript
interface RateLimitInfo {
  limit: number;      // Límite total (ej: 100 req/min)
  remaining: number;  // Requests restantes
  reset: number;      // Unix timestamp de reset
  retryAfter?: number // Segundos para reintentar (si header presente)
}
```

### Circuit Breaker - Estados

```
CLOSED (normal) ──5 fallos──▶ OPEN (fail fast) ──30s──▶ HALF_OPEN ──2 éxitos──▶ CLOSED
     │                           │                      │
     │                    Rechaza requests          Prueba 1 request
     │                    instantáneamente          si ok → CLOSED
     │                                              si falla → OPEN
     ▼
Registra éxitos/fallos
(excluye 401,403,404,422 por defecto)
```

### SSR / Testing - Token Providers

```typescript
// En servidor (Node) - no hay document
const adapter = new DataRestAdapter({
  baseURL: 'https://api.com',
  csrfTokenProvider: () => requestHeaders['x-csrf-token'],
  apiTokenProvider: () => requestHeaders['x-api-token']
});

// En tests - control total
const adapter = new DataRestAdapter({
  baseURL: 'https://api.com',
  csrfTokenProvider: () => 'test-csrf-token',
  apiTokenProvider: () => 'test-api-token'
});
```

---

## 🧪 Testing

### Mocks Recomendados

```typescript
// tests/setup.ts
import { vi } from 'vitest';
import { DataRestAdapter } from '@shardev/common/adapters';

// Mock axios con isAxiosError
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

### Test de Rate Limiting

```typescript
it('should retry on 429 with exponential backoff', async () => {
  const adapter = new DataRestAdapter({ baseURL: 'https://api.com', rateLimit: { maxRetries: 2, baseDelayMs: 100 } });
  
  mockClient.request
    .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '1' } }, isAxiosError: true })
    .mockResolvedValueOnce({ data: { success: true, data: [] } });
  
  const result = await adapter.fetch('users');
  expect(result.success).toBe(true);
  expect(mockClient.request).toHaveBeenCalledTimes(2);
});
```

### Test de Circuit Breaker

```typescript
it('should open circuit after threshold', async () => {
  const adapter = new DataRestAdapter({ 
    baseURL: 'https://api.com', 
    rateLimit: { maxRetries: 0 }, // Sin retries para test puro
    circuitBreaker: { failureThreshold: 2, timeout: 1000 }
  });
  
  mockClient.request.mockRejectedValue({ response: { status: 500 }, isAxiosError: true });
  
  await adapter.fetch('users'); // fallo 1
  await adapter.fetch('users'); // fallo 2 → circuit OPEN
  
  await expect(adapter.fetch('users')).rejects.toMatchObject({
    message: expect.stringContaining('Circuit breaker is OPEN')
  });
});
```

---

## 📋 API Reference Completa

### DataRestAdapterConfig

```typescript
interface DataRestAdapterConfig extends DataAdapterConfig {
  csrfTokenProvider?: () => string | undefined;
  apiTokenProvider?: () => string | undefined;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
}
```

### RateLimitConfig

```typescript
interface RateLimitConfig {
  maxRetries: number;           // Default: 3
  baseDelayMs: number;          // Default: 1000
  maxDelayMs: number;           // Default: 30000
  respectRetryAfter: boolean;   // Default: true
  onRateLimit?: (info: RateLimitInfo) => void;
  onForbidden?: () => void;
}
```

### CircuitBreakerConfig

```typescript
interface CircuitBreakerConfig {
  failureThreshold?: number;    // Default: 5
  successThreshold?: number;    // Default: 2
  timeout?: number;             // Default: 30000 (ms)
  excludedStatusCodes?: number[]; // Default: [401,403,404,422]
  onStateChange?: (state: CircuitState) => void;
}

enum CircuitState { CLOSED, OPEN, HALF_OPEN }
```

### DataProviderResponse

```typescript
interface DataProviderResponse<T = any, E = Record<string, unknown>> {
  success: boolean;
  message: string;
  errors?: E;
  data: T | null;
  status: 'success' | 'error' | 'pending' | string;
  originalError?: unknown;
  rateLimit?: RateLimitInfo;    // ← Nuevo en v2.1.40+
}
```

---

## 🔧 Migración desde v2.0.x

### Breaking Changes

| Antes | Ahora | Acción |
|-------|-------|--------|
| `useResourceService` retorna todo | Usa hooks granulares | Migra a `useResourceList`, `useResourceMutations`, etc. |
| Sin cancelación | `cancelRequest()`, `cancelAll()` | Opcional: usa para UX de búsqueda |
| Sin circuit breaker | Automático en adapters | Configura `circuitBreaker` si necesitas tuning |
| `any` en error handling | Type guards | Actualiza `catch (error: any)` → `catch (error: unknown)` |
| `console.log` en constructor | Removido | Elimina logs custom si los tenías |

### Migración Paso a Paso

```tsx
// ANTES (v2.0)
const { 
  items, pagination, isLoading, isSaving, 
  fetchMany, add, update, remove, 
  importFromFile, exportToFile,
  setPage, setFilter, setSort
} = useResourceService<User>('users', { perPage: 20 });

// DESPUÉS (v2.1+) - Granular
const { 
  items, pagination, isLoading, fetchMany, setPage, setFilter, setSort 
} = useResourceList<User>('users', { perPage: 20 });

const { add, update, remove, isSaving } = useResourceMutations<User>('users');

const { importFromFile, exportToFile } = useResourceFiles<User>('users');

// Rate limit (nuevo)
const { isRateLimited, rateLimitInfo, clearRateLimit } = useRateLimitStatus();
```

---

## 🐛 Troubleshooting

### "Circuit breaker is OPEN" frecuente
```typescript
// Aumenta threshold o excluye más códigos
circuitBreaker: {
  failureThreshold: 10,
  excludedStatusCodes: [401, 403, 404, 422, 429, 503]
}
```

### Rate limit no detectado
- Verifica headers: `X-RateLimit-*` o `Retry-After`
- Algunos proxies/CDN stripean headers → configura en backend

### Memory leak en SPA larga duración
- Usa `adapter.cancelAll()` en `useEffect` cleanup
- Verifica `useReverbAdapter` cleanup (ya fixado en v2.1.40+)

### TypeScript errors en buildQuery
- Usa `buildQuery` del paquete, no reimplementes
- Para Supabase tipado completo, genera types: `supabase gen types typescript`

---

## 📄 Licencia

MIT © Elbert Tous

---

## 🤝 Contribuir

1. Fork → Branch `feature/nueva-funcionalidad`
2. Tests obligatorios (`npm run test:run`)
3. Types strict (`npm run types`)
4. Lint (`npm run lint` si configurado)
5. PR con descripción clara

---

**Última actualización:** v2.1.40 - Octubre 2026  
**Mantenido por:** @shardev team