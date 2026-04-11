# Utilidades

## Que ofrece

El modulo `utils` expone helpers orientados a frontend.

## GTM

### `initGTM(gtmId)`

Inicializa Google Tag Manager usando `react-gtm-module`.

Tambien intenta leer un `nonce` desde:

```html
<meta name="csp-nonce" content="...">
```

### `useGTM(gtmId)`

Hook que inicializa GTM al montar.

```tsx
import { useGTM } from "@shardev/common";

function Layout() {
  useGTM("GTM-XXXXXXX");
  return null;
}
```

### `gtmEvent(payload)`

Envia eventos personalizados al `dataLayer`.

```ts
gtmEvent({
  event: "cta_click",
  category: "marketing",
  action: "click",
  label: "hero_button",
});
```

## Formatos

El modulo `formats` permite configurar locale/currency y formatear valores comunes.

### Configuracion

- `setFormatConfig`
- `getFormatConfig`
- `clearFormatCache`

### Helpers disponibles

- `formatMoney`
- `formatMoneyCode`
- `formatNumber`
- `formatPercent`
- `formatCompactNumber`
- `formatDate`
- `formatDateTime`
- `formatRelativeTime`
- `formatFileSize`

## Geolocalizacion

### `useGeolocation`

Obtiene la ubicacion actual del navegador y expone:

- `location`
- `error`

## Utilidades internas relevantes

Aunque no todas son helpers de uso cotidiano, hay utilidades internas que sostienen otras capas:

- `useSafeContext` para consumir contextos sin romper en ausencia de provider
- helpers de filtro para construir consultas de Supabase
- un helper interno de pageview para GTM presente en el repositorio, pero no documentado como API publica estable

## Recomendacion

Usa estas utilidades como soporte de la app, pero evita depender de helpers internos no documentados como contrato estable si no estan exportados claramente para tu caso de uso.
