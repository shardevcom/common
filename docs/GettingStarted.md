# Guia de inicio

## Enfoque del paquete

`@shardev/common` esta pensado para centralizar piezas repetidas en varias aplicaciones React:

- store global
- autenticacion y permisos
- acceso a datos
- integracion realtime
- ruteo desacoplado
- helpers de frontend

Puedes usarlo completo como base de una app o por partes.

## Formas comunes de integracion

### 1. Crear una app con store incluido

Usa `createApp` cuando quieras montar una aplicacion o microfrontend y registrar reducers desde el inicio.

```tsx
import { createApp } from "@shardev/common";
import App from "./App";
import { uiReducer } from "./store/uiSlice";

export const WebApp = createApp({
  name: "portal",
  appKey: "portal-v1",
  app: App,
  slices: {
    ui: uiReducer,
  },
});
```

### 2. Usar solo providers

Si tu app ya controla su bootstrap, puedes componer los providers manualmente.

```tsx
import {
  StoreProvider,
  AuthProvider,
  DataProvider,
  RouterProvider,
  useAuthAbilityAdapter,
  useRestApiAdapter,
} from "@shardev/common";

const routes = [
  {
    path: "/",
    element: () => <div>Home</div>,
  },
];

export function AppShell() {
  const authAdapter = useAuthAbilityAdapter("api");
  const dataAdapter = useRestApiAdapter({
    baseURL: "https://api.example.com",
  });

  return (
    <StoreProvider
      config={{
        keyName: "portal",
        secretKey: "portal-v1",
      }}
    >
      <AuthProvider adapter={authAdapter!}>
        <DataProvider adapter={dataAdapter}>
          <RouterProvider routes={routes} />
        </DataProvider>
      </AuthProvider>
    </StoreProvider>
  );
}
```

## Orden recomendado de providers

Cuando uses varios modulos juntos, este orden suele ser el mas seguro:

1. `StoreProvider`
2. `AuthProvider`
3. `DataProvider`
4. `RealTimeProvider`
5. `RouterProvider`

## Criterios para elegir adapters

- REST API tradicional: `DataRestAdapter`
- Supabase como backend principal: `DataSupabaseAdapter`
- Permisos basados en roles/permisos tipo ability: `AuthAbilityAdapter`
- Firebase Realtime Database: `RealtimeFirebaseAdapter`
- Laravel Reverb por WebSocket: `RealtimeReverbAdapter`

## Recomendacion de adopcion

Si el proyecto es nuevo, empieza por:

1. `StoreProvider`
2. `DataProvider` con un adapter
3. `AuthProvider` si tu UI necesita permisos
4. `RouterProvider` cuando ya tengas flujos protegidos

## Convenciones que asume el paquete

- Las apps usan React.
- El estado global se maneja con Redux Toolkit.
- La autenticacion suele vivir en `state.auth.authUser`.
- El store persistido se guarda en `localStorage`.
- Los adapters pueden apoyarse en el store para leer token y reaccionar a expiracion de sesion.
