# @shardev/common

Libreria compartida para aplicaciones React construidas por Shardev. Reune una base comun para estado global, autenticacion, acceso a datos, integracion realtime, ruteo desacoplado y utilidades de frontend.

La documentacion de este repositorio fue reconstruida a partir del codigo fuente actual. Todo lo que se describe aqui corresponde a la API publica expuesta hoy por `src/index.ts`.

## Que resuelve este paquete

- Crear aplicaciones o modulos React con una configuracion base reutilizable.
- Compartir un store Redux Toolkit con persistencia y cifrado en `localStorage`.
- Envolver la logica de permisos con adapters intercambiables.
- Consumir backends mediante un contrato de datos unico.
- Integrar proveedores realtime con una interfaz comun.
- Declarar rutas protegidas sin acoplar la app a una sola implementacion de permisos.
- Reutilizar helpers de formato, GTM, eventos y geolocalizacion.

## Modulos principales

- `store`: store global, hooks tipados, persistencia, slice auth por defecto.
- `auth`: tipos de usuario/roles/permisos, provider y hooks de permisos.
- `data`: contrato de acceso a datos, provider, hooks y servicio CRUD reusable.
- `realtime`: contrato realtime, provider y hook de consumo.
- `router`: configuracion de rutas, proteccion y redireccion con prefijos.
- `factory`: helper `createApp` para crear apps o modulos con store opcional.
- `adapters`: implementaciones listas para auth, data y realtime.
- `utils`: helpers de formato, GTM, eventos, geolocalizacion y soporte interno.

## Instalacion

```bash
npm install @shardev/common
```

## Peer dependencies relevantes

Dependiendo de lo que uses, tu proyecto tambien necesitara algunas dependencias pares:

- `react` y `react-dom`
- `@reduxjs/toolkit`
- `axios` para el adapter REST
- `@supabase/supabase-js` para el adapter Supabase
- `@casl/ability` para el adapter de permisos por habilidades
- `firebase` para el adapter realtime Firebase
- `socket.io-client` para el adapter realtime Reverb
- `uuid` para carga de archivos en Supabase

## Ejemplo rapido

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { createApp } from "@shardev/common";
import App from "./App";
import { uiReducer } from "./store/uiSlice";

const WebApp = createApp({
  name: "admin-app",
  appKey: "admin-app-v1",
  app: App,
  slices: {
    ui: uiReducer,
  },
});

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<WebApp />);
}
```

## Arquitectura de alto nivel

El paquete esta pensado como una base desacoplada:

1. `StoreProvider` crea el store y lo deja disponible via contexto.
2. `AuthProvider`, `DataProvider` y `RealTimeProvider` inyectan adapters concretos.
3. `RouterProvider` construye las rutas y puede aplicar logica de proteccion.
4. Los hooks consumen esos contextos con una API uniforme.

Este enfoque permite cambiar la implementacion concreta sin reescribir la mayor parte de la aplicacion.

## Documentacion

- [Guia de inicio](./docs/GettingStarted.md)
- [Store y estado global](./docs/Store.md)
- [Autenticacion y permisos](./docs/Auth.md)
- [Data provider y servicios CRUD](./docs/Data.md)
- [Realtime](./docs/Realtime.md)
- [Router](./docs/Router.md)
- [Adapters disponibles](./docs/Adapters.md)
- [Utilidades](./docs/Utils.md)

## Superficie publica exportada

La libreria exporta:

- Todo `store`, `auth`, `data`, `realtime`, `router`, `utils` y `factory`.
- Adapters desde subrutas de paquete:
  - `@shardev/common/adapters/auth/ability`
  - `@shardev/common/adapters/data/rest`
  - `@shardev/common/adapters/data/supabase`
  - `@shardev/common/adapters/realtime/firebase`
  - `@shardev/common/adapters/realtime/reverb`

## Notas importantes sobre el estado actual del codigo

- La documentacion describe lo que el paquete hace hoy, no una roadmap futura.
- Hay partes del codigo con mensajes de consola y algunos comentarios heredados del desarrollo interno.
- El paquete no expone hoy un `ThemeProvider`; cualquier referencia antigua a eso debe considerarse obsoleta.
- Algunos textos del repositorio antiguo tienen problemas de encoding, pero la API y la estructura si son identificables.

## Desarrollo local

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Licencia

MIT
