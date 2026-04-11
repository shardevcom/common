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

`StoreProvider` compara `secretKey` contra una clave almacenada en `localStorage`:

- si cambia, limpia el almacenamiento local
- luego vuelve a guardar la version nueva

Esto permite invalidar estado persistido cuando cambias la estructura esperada o la clave de cifrado.

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

- `setAuth(payload)`: fusiona datos del usuario autenticado y persiste `access_token` en `localStorage`.
- `initAuth()`: reinicia el usuario y elimina `access_token`.

## createStoreFactory

Si no quieres usar directamente el provider, puedes crear una instancia con `createStoreFactory(config)`.

La fabrica retorna:

- `store`
- `persist`
- `addReducers`
- `registeredReducers`

## Consideraciones operativas

- `localStorage.clear()` se ejecuta cuando cambia la version asociada a `secretKey`.
- El slice `auth` siempre se agrega aunque no declares reducers personalizados.
- El cifrado protege el estado persistido, pero la clave vive en frontend; no debe considerarse un mecanismo de seguridad absoluta.
