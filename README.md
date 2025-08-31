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
import React from "react";
import { createRoot } from "react-dom/client";
import { createApp } from "@shardev/common";
import WebPage from "./pages";
import slices from "./store/slices";

// Creamos la app (pero no la montamos aún)
const element = createApp({
    name: "my-app",
    app: WebPage,
    slices
});

// Revisamos si existe root en el DOM
const el = document.getElementById("root");

if (el) {
    createRoot(el).render(element);
} else {
    console.log("⚡ App registrada pero no montada (sin root)");
}

// Opcional: exportar el elemento para integraciones externas
export default element;
```

---

```tsx
// WebApp.tsx
import React, {useEffect, useMemo} from "react";
import {useMemo} from 'react'
import {
    useGTM,
    AuthProvider,
    DataProvider,
    AuthUser,
    RouterProvider,
    useAuthAbilityAdapter,
    useDataRestApi,
    ModuleStoreProvider
} from "@shardev/common";
import {AuthAbilityAdapter} from "../adapters/auth/casl-ability";
import routes from "../routes";
import { uiSlice } from "../slices";

const baseUrl: string = import.meta.env.VITE_APP_URL

const WebApp = () => {

    useGTM('GTM-XXXXXXX')

    const adapterRestAPI = useDataRestApi();
    const authAdapter = useAuthAbilityAdapter<AuthUser>('api')

    return (
        <ModuleStoreProvider store={{ ui: uiSlice }}>
            <AuthProvider adapter={authAdapter}>
                <DataProvider adapter={adapterRestAPI}>
                    <RouterProvider routes={routes}/>
                </DataProvider>
            </AuthProvider>
        </ModuleStoreProvider>
    );
}

export default WebApp;
```

---
## 🧾 Créditos

**`@shardev/common`** — Mantenido por [Shardev](https://shardev.com) 🚀