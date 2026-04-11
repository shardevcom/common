# Router

## Que ofrece

El modulo `router` envuelve `react-router-dom` para construir rutas declarativas y aplicar proteccion con logica de permisos.

Incluye:

- `RouterProvider`
- `RouteConfig`
- `parseRoutes`
- `RouteContext`
- `useRouteContext`
- componente `Redirect`

Tambien reexporta elementos desde `router-dom-export`.

## RouteConfig

```ts
interface RouteConfig<T extends AuthUser = AuthUser> {
  redirectLogic?: (adapter: PermissionAdapter<T>) => string | false;
  children?: RouteConfig<T>[];
  path?: string;
  protected?: boolean;
  element: () => React.ReactElement;
  id?: string;
  index?: boolean;
}
```

## RouterProvider

`RouterProvider` puede trabajar de dos formas:

- como router raiz, creando internamente `BrowserRouter`
- como router anidado, agregando rutas a un contexto padre

### Props

- `routes`: arreglo de `RouteConfig`
- `children`: nodos hijos opcionales
- `prefix`: prefijo base para las rutas

## Prefijos de rutas

Si pasas `prefix`, el provider lo antepone a cada ruta registrada.

Esto es util para:

- microfrontends
- modulos montados bajo una subruta
- apps multitenant con base path comun

## Proteccion de rutas

La proteccion se resuelve con `redirectLogic(adapter)`.

La funcion recibe el `PermissionAdapter` actual y debe retornar:

- `false` si la ruta puede renderizarse
- una ruta destino si debe redirigir

### Ejemplo

```tsx
const routes = [
  {
    path: "/dashboard",
    element: () => <DashboardPage />,
    redirectLogic: (permissions) =>
      permissions.isAuthenticated("api") ? false : "/login",
  },
  {
    path: "/users",
    element: () => <UsersPage />,
    redirectLogic: (permissions) =>
      permissions.can("view", "users") ? false : "/403",
  },
];
```

## Redirect

`Redirect` funciona como `Navigate`, pero si existe un `prefix` en el contexto del router lo antepone automaticamente sin duplicarlo.

```tsx
import { Redirect } from "@shardev/common";

return <Redirect to="/login" replace />;
```

## parseRoutes

`parseRoutes` transforma `RouteConfig[]` en `RouteObject[]` para `useRoutes`.

Durante ese proceso:

- ejecuta `element()`
- envuelve la ruta en `ProtectedRoute` si existe `redirectLogic`
- procesa recursivamente los `children`

## Consideracion actual

La propiedad `protected` existe en `RouteConfig`, pero la logica real de proteccion hoy depende de `redirectLogic`. La documentacion recomienda usar esa propiedad funcional porque es la que el codigo usa efectivamente.
