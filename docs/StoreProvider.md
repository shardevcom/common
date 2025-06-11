## 🔌 StoreProvider

El componente `StoreProvider` del paquete `@shardev/common` permite inyectar el store global de Redux Toolkit en una aplicación React.  
Soporta **persistencia automática del estado** y **cifrado del almacenamiento local**.

### 📦 Importación

```ts
import { StoreProvider, StoreConfig } from '@shardev/common';
```

### ⚙️ Configuración

El componente recibe una prop `config` con la siguiente estructura:

```ts
interface StoreConfig<Slices> {
  initialState?: Partial<StateFromReducersMapObject<Slices>>;
  keyName: string;    // Clave de persistencia local
  secretKey: string;  // Clave de cifrado AES
  slices: Slices;     // Slices de Redux Toolkit
}
```

### 🚀 Uso básico

```tsx
import { StoreProvider } from '@shardev/common';
import { rootSlices } from './store';

const storeConfig = {
  keyName: 'my-app-key',
  secretKey: 'my-secret',
  slices: rootSlices,
};

<StoreProvider config={storeConfig}>
  <App />
</StoreProvider>
```

> **Nota:** El valor de `secretKey` debe mantenerse seguro. Evita exponerlo en código público.

---

### 🧰 Hooks personalizados

Este paquete extiende los hooks típicos de Redux para trabajar con tipos inferidos:

- `useAppDispatch()` → Equivalente a `useDispatch`, pero tipado.
- `useAppSelector(selector)` → Equivalente a `useSelector`, pero con soporte de tipado automático.

### 🚀 Ejemplo de uso

```tsx
const authUser = useAppSelector(state => state.auth.authUser);
const dispatch = useAppDispatch();
const storeContext = useStoreContext();

storeContext.store

storeContext.persist

dispatch(setAuth({ name: 'Juan' }));
```

---