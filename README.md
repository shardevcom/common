# 📦 @shardev/common

Utilidades comunes para aplicaciones hechas en **React**, diseñadas para proyectos mantenidos por [Shardev](https://github.com/shardevcom). Ofrece una base sólida y desacoplada para construir aplicaciones modernas administrando estados, temas, proveedores de datos, control de accesos, enrutamientos desacoplados y más.

---

## 📦 Características principales

- **Persistencia y cifrado de estado global** con [`StoreProvider`](./docs/StoreProvider.md)
- **Control de acceso** con [`AuthProvider`](./docs/AuthProvider.md) y adaptadores configurables:
- **Integración de APIs con adaptadores customizables** con [`DataProvider`](./docs/DataProvider.md)
- **Integración de Real Time con adaptadores customizables** con [`RealTimeProvider`](./docs/RealTimeProvider.md)
- **Sistema de enrutamiento desacoplado** con [`RouterProvider`](./docs/RouterProvider.md)

---

## 🚀 Instalación

```bash 
  npm install @shardev/common
```

## 🛠️ Ejemplo de uso general

```tsx
// index.tsx
import React, { Suspense } from "react";
import { createRoot } from 'react-dom/client';
import { rootSlices } from "./store";
import { theme } from "./theme";
import { StoreConfig, StoreProvider, ThemeProvider } from "@shardev/common";
import WebApp from "./pages";

export const appKey: string = (import.meta.env?.APP_KEY ?? 'my-secret-key');

const storeConfig: StoreConfig<typeof rootSlices> = {
    keyName: 'my-app-name',
    secretKey: appKey,
    slices: rootSlices
};

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider initialTheme={theme}>
            <StoreProvider config={storeConfig}>
                <WebApp />
            </StoreProvider>
        </ThemeProvider>
    </React.StrictMode>
);
```

---

```tsx
// WebApp.tsx
import React, { useEffect, useMemo } from "react";
import {useMemo} from 'react'
import {
    useGTM,
    AuthProvider,
    DataProvider,
    AuthUser,
    useStoreContext,
    useAppSelector,
    RouterProvider
} from "@shardev/common";
import {AuthAbilityAdapter} from "../adapters/auth/casl-ability";
import {DataRestAdapter} from "../adapters/data";
import routes from "../routes";

const baseUrl: string = import.meta.env.VITE_APP_URL

const WebApp = () => {

    useGTM('GTM-NQJRB7H8')

    const storeContext = useStoreContext();

    const authUser = useAppSelector((state) => state.auth.authUser);

    const adapterRestAPI = useMemo(() => new DataRestAdapter({
        baseURL: baseUrl,
        store: storeContext.store
    }), [baseUrl, storeContext.store]);

    const authAdapter = useMemo(() => new AuthAbilityAdapter<AuthUser>(authUser, 'api'), [authUser]);

    return (
        <AuthProvider adapter={authAdapter}>
            <DataProvider adapter={adapterRestAPI}>
                <RouterProvider routes={routes} />
            </DataProvider>
        </AuthProvider>
    );
}

export default WebApp;
```

---
## 🧾 Créditos

**`@shardev/common`** — Mantenido por [Shardev](https://shardev.com) 🚀