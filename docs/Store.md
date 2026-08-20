# Store y estado global

## Que ofrece

El modulo `store` aporta:

- `StoreProvider`
- `useAppDispatch`
- `useAppSelector`
- `useStoreContext`
- `createStoreFactory`
- `authSlice`, `authReducer`, `setAuth`, `initAuth`
- tipos como `StoreConfig`, `StoreInstance` y `StateFromReducersMapObject`

## StoreProvider

`StoreProvider` crea una instancia Redux Toolkit con:

- persistencia mediante `redux-persist`
- cifrado del estado persistido
- soporte para reducers dinamicos
- un slice `auth` incluido por defecto

### Props

```ts
interface StoreConfig<TSlices> {
  initialState?: Partial<StateFromReducersMapObject<ReducersMapObject<TSlices>>>;
  keyName: string;
  secretKey: string;
  slices?: ReducersMapObject<TSlices>;
  middlewares?: Middleware[];
  storage?: StorageBackend;   // backend inyectable (por defecto localStorage)
  purgeKeys?: string[];       // claves adicionales a purgar al cambiar de version
  authStorageKey?: string;    // clave donde reflejar access_token (opcional; sin ella no se escribe nada externo)
}
```

### Ejemplo

```tsx
import { StoreProvider } from "@shardev/common";
import { uiReducer } from "./uiSlice";

export function RootStoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider
      config={{
        keyName: "dashboard",
        secretKey: "dashboard-v1",
        slices: {
          ui: uiReducer,
        },
      }}
    >
      {children}
    </StoreProvider>
  );
}
```

## Persistencia y versionado

`StoreProvider` compara `secretKey` contra una clave almacenada en el storage (`version${keyName}`):

- si cambia, purga SOLO las claves propias de la app: `version${keyName}`, la clave de persistencia `persist:${keyName}` y las declaradas en `purgeKeys`
- luego vuelve a guardar la version nueva

Esto permite invalidar estado persistido cuando cambias la estructura esperada o la clave de cifrado, sin borrar sesiones de otras apps del mismo origen (cumplimiento tipo CASA).

> Antes se usaba `localStorage.clear()`. Ahora la purga es dirigida y deterministica, gracias al modulo `utils/storage`.

## Reducers dinamicos

La fabrica del store permite registrar reducers despues de haber creado la app.

### Uso desde el contexto

```tsx
import { useStoreContext } from "@shardev/common";

function FeatureBootstrap() {
  const { addReducers } = useStoreContext();

  React.useEffect(() => {
    addReducers({
      feature: featureReducer,
    });
  }, [addReducers]);

  return null;
}
```

## Hooks disponibles

### useAppDispatch

Retorna `dispatch` tipado a partir de la instancia actual del store.

### useAppSelector

Wrapper tipado sobre `useSelector`. Debe usarse dentro de `StoreProvider`.

### useStoreContext

Expone:

- `store`
- `persist`
- `addReducers`
- `registeredReducers`

## Slice auth incluido

El store incluye por defecto un slice `auth`.

### Estado

```ts
interface AuthState {
  authUser: AuthUser;
}
```

### Acciones

- `setAuth(payload)`: fusiona datos del usuario autenticado en el estado. Si `authStorageKey` está declarado en la config, un middleware refleja `access_token` en el storage inyectable bajo esa clave.
- `logout()`: reinicia el usuario y (si `authStorageKey` está declarado) elimina la clave reflejada. Alinea con el dispatch `auth/logout` de los adapters de Realtime.
- `initAuth()`: reinicia el usuario y (si `authStorageKey` está declarado) elimina la clave reflejada.

> El slice NO toca `localStorage` directamente: los reducers son puros y todo efecto de storage vive en middleware con clave configurable. Si no se declara `authStorageKey`, el token solo existe en el estado persistido y cifrado.

## createStoreFactory

Si no quieres usar directamente el provider, puedes crear una instancia con `createStoreFactory(config)`.

La fabrica retorna:

- `store`
- `persist`
- `addReducers`
- `registeredReducers`
- `purge(target?)` - purga dirigida de storage (por defecto elimina `persist:${keyName}` y las claves de `purgeKeys`)

### Purga dirigida desde la instancia

```ts
const { purge } = createStoreFactory({
  keyName: "dashboard",
  secretKey: "dashboard-v1",
  purgeKeys: ["access_token"],
});

// al cerrar sesion: limpia la persistencia + claves declaradas
purge();
```

Tambien puedes pasar un objetivo personalizado:

```ts
purge({ prefix: "dashboard:" });
```

## Consideraciones operativas

- La purga de version usa `utils/storage`: jamas se invoca `clear()` global, para no borrar claves de otras apps del mismo origen.
- El slice `auth` siempre se agrega aunque no declares reducers personalizados.
- El cifrado protege el estado persistido, pero la clave vive en frontend; no debe considerarse un mecanismo de seguridad absoluta.
