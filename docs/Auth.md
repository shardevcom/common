# Autenticacion y permisos

## Que ofrece

El modulo `auth` define contratos y helpers para manejar autorizacion desacoplada.

Incluye:

- tipos `AuthUser`, `Role`, `Permission`, `Rules`
- interfaz `PermissionAdapter`
- clase base `BasePermissionAdapter`
- `AuthProvider`
- `AuthContext`
- hooks `usePermissions` y `useAuthAbilityAdapter`

## Modelo de datos

### AuthUser

Representa al usuario autenticado junto con metadatos comunes:

- `id`
- `name`
- `email`
- `roles`
- `permissions`
- `refresh_token`
- `access_token`
- `token_type`
- `expires_at`

### Role y Permission

El modelo asume un esquema de roles y permisos con `guard_name`, util para separar contextos como `web`, `api` o modulos internos.

## PermissionAdapter

Es el contrato central de autorizacion.

```ts
interface PermissionAdapter<T extends AuthUser = AuthUser> {
  can(action: string, subject: any): boolean;
  canAny?(actions: string[], subject: any): boolean;
  canAll?(actions: string[], subject: any): boolean;
  update(roles: Role[], permissions: Permission[]): void;
  getUser(): T;
  setUser(authUser: T): void;
  isAuthenticated(guards?: string | string[]): boolean;
}
```

Esto permite desacoplar la UI de una libreria concreta de permisos.

## AuthProvider

`AuthProvider` recibe un adapter y lo inyecta por contexto.

```tsx
import { AuthProvider } from "@shardev/common";

<AuthProvider adapter={permissionAdapter}>
  <App />
</AuthProvider>;
```

## Hooks

### usePermissions

Obtiene el adapter actual desde contexto.

- Si existe `AuthProvider`, retorna ese adapter.
- Si no existe, retorna un adapter mock que responde `false` para permisos y `false` para autenticacion salvo que se le asigne usuario manualmente.

Esto hace que ciertos componentes fallen menos cuando se renderizan fuera del contexto real.

### useAuthAbilityAdapter

Crea un `AuthAbilityAdapter` a partir de `state.auth.authUser`.

```tsx
import { useAuthAbilityAdapter } from "@shardev/common";

const adapter = useAuthAbilityAdapter("api", ["approve", "publish"]);
```

Parametros:

- `guard`: guard logico a evaluar. Por defecto `api`.
- `availableActions`: acciones adicionales conocidas por la app.

## Adapter incluido: AuthAbilityAdapter

Este adapter usa `@casl/ability` para construir permisos.

### Reglas que aplica

- Usa acciones por defecto: `view`, `create`, `update`, `remove`, `manage`, `delete`, `edit`.
- Puede recibir acciones extra desde `availableActions`.
- Tambien toma `auth.availableActions` si el backend las envia.
- Si el usuario tiene un rol `Super Admin` o `admin` con el `guard_name` correcto, concede `manage` sobre `all`.
- Si un permiso tiene formato `accion:recurso`, `accion.recurso`, `accion recurso` o `accion-recurso`, interpreta la primera parte como accion y la segunda como subject.
- Si no puede inferir una accion conocida, registra el permiso como `view`.

## Ejemplo completo

```tsx
import {
  AuthProvider,
  useAuthAbilityAdapter,
  usePermissions,
} from "@shardev/common";

function FeatureGate() {
  const permissions = usePermissions();

  if (!permissions.can("view", "users")) {
    return <div>Sin acceso</div>;
  }

  return <div>Listado de usuarios</div>;
}

function AuthLayer({ children }: { children: React.ReactNode }) {
  const adapter = useAuthAbilityAdapter("api");

  if (!adapter) return null;

  return <AuthProvider adapter={adapter}>{children}</AuthProvider>;
}
```

## Relacion con el router

El router puede recibir una funcion `redirectLogic(adapter)` para decidir si una ruta se debe redirigir. Eso permite reutilizar este mismo adapter dentro de la proteccion de rutas.
