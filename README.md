## 📝 Lista de Tareas Pendientes

- [ ] Pantalla de create tareas
- [ ] Pantalla de crear plantilla
- [ ] Pantalla de crear categoria
- [ ] Live icon search with font awesome
- [*] Overhaul theme color and sidebar


# Whagons V5 - Cliente React

Una aplicación de gestión de tareas moderna construida con TypeScript, que incluye dashboard de tareas, planificación de trabajo y autenticación de usuarios.

## 📋 Comandos Principales

### Desarrollo
```bash
npm install          # Instalar dependencias
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Construir para producción
npm run preview      # Previsualizar construcción de producción
```

### Gestión de Dependencias
```bash
# Usando npm
npm install [paquete]

# Usando pnpm (recomendado)
pnpm install [paquete]
```

## 🚀 Configuración Inicial

### 1. Instalación
```bash
git clone <url-del-repositorio>
cd whagons5-client
npm install
```

### 2. Variables de Entorno
Copia el archivo de ejemplo y configúralo:
```bash
cp example.env .env
```

Actualiza el archivo `.env`:
```env
VITE_API_URL=localhost:8000
VITE_DEVELOPMENT=true
VITE_DOMAIN=localhost
```

### 3. Iniciar Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`

## 🏗️ Estructura del Proyecto

```
src/
├── api/                    # Servicios de API y llamadas HTTP
├── assets/                 # Recursos estáticos (imágenes, iconos)
├── components/             # Componentes reutilizables
│   ├── ui/                # Componentes base de shadcn/ui
│   ├── Header.tsx         # Cabecera de la aplicación
│   ├── AppSidebar.tsx     # Barra lateral de navegación
│   └── ModeToggle.tsx     # Alternador de tema claro/oscuro
├── firebase/              # Configuración de Firebase
├── layouts/               # Componentes de diseño
├── lib/                   # Utilidades y configuraciones
├── pages/                 # Páginas de la aplicación
│   ├── authentication/    # Páginas de login/registro
│   ├── dashboard/         # Dashboard de tareas
│   ├── workplan/          # Funciones de planificación
│   ├── profile/           # Gestión de perfil
│   ├── stripe/            # Integración de pagos
│   └── onboarding/        # Flujo de incorporación
├── providers/             # Proveedores de contexto
├── router/                # Configuración de rutas
├── store/                 # Configuración de Redux
├── types/                 # Definiciones de tipos TypeScript
├── App.tsx                # Componente raíz
└── main.tsx               # Punto de entrada
```

## 🗂️ Cómo Crear una Nueva Página

### 1. Estructura de Carpetas
```bash
src/pages/mi-nueva-pagina/
├── MiNuevaPagina.tsx          # Componente principal
└── components/                 # Componentes específicos (opcional)
    ├── ComponenteA.tsx
    └── ComponenteB.tsx
```

### 2. Crear el Componente Principal
```typescript
// src/pages/mi-nueva-pagina/MiNuevaPagina.tsx

const MiNuevaPagina = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mi Nueva Página</h1>
      <p>Contenido de la página...</p>
    </div>
  );
};

export default MiNuevaPagina;
```

### 3. Agregar la Ruta
```typescript
// src/router/HomeRouter.tsx
import MiNuevaPagina from '@/pages/mi-nueva-pagina/MiNuevaPagina';

const pages = [
  // ... páginas existentes
  { path: '/mi-nueva-pagina', component: <MiNuevaPagina /> },
];
```

### 4. Agregar al Sidebar (Opcional)
```typescript
// src/components/AppSidebar.tsx
const menuItems = [
  // ... items existentes
  {
    title: "Mi Nueva Página",
    url: "/mi-nueva-pagina",
    icon: IconoElegido,
  }
];
```

## 🏪 Cómo Crear un Nuevo Store (Redux)

### 1. Crear el Slice
```typescript
// src/store/slices/miNuevoSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MiNuevoState {
  data: any[];
  loading: boolean;
  error: string | null;
}

const initialState: MiNuevoState = {
  data: [],
  loading: false,
  error: null,
};

const miNuevoSlice = createSlice({
  name: 'miNuevo',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setData: (state, action: PayloadAction<any[]>) => {
      state.data = action.payload;
      state.loading = false;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setLoading, setData, setError, clearError } = miNuevoSlice.actions;
export default miNuevoSlice.reducer;
```

### 2. Crear Thunks Asíncronos
```typescript
// src/store/thunks/miNuevoThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { miNuevoAPI } from '@/api/miNuevoAPI';

export const fetchMiNuevoData = createAsyncThunk(
  'miNuevo/fetchData',
  async (params: any, { rejectWithValue }) => {
    try {
      const response = await miNuevoAPI.getData(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);
```

### 3. Configurar el Store
```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import miNuevoReducer from './slices/miNuevoSlice';

export const store = configureStore({
  reducer: {
    // ... otros reducers
    miNuevo: miNuevoReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 4. Crear Hooks Personalizados
```typescript
// src/hooks/useMiNuevo.ts
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { fetchMiNuevoData } from '@/store/thunks/miNuevoThunks';

export const useMiNuevo = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.miNuevo);

  const fetchData = (params: any) => {
    dispatch(fetchMiNuevoData(params));
  };

  return {
    data,
    loading,
    error,
    fetchData,
  };
};
```

### 5. Usar en Componentes
```typescript
// En tu componente
import { useMiNuevo } from '@/hooks/useMiNuevo';
import { useEffect } from 'react';

const MiComponente = () => {
  const { data, loading, error, fetchData } = useMiNuevo();

  useEffect(() => {
    fetchData({ /* parámetros */ });
  }, []);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};

export default MiComponente;
```

## 🚀 Generic Slice Factory

### Overview
The **Generic Slice Factory** has revolutionized our Redux architecture! We've eliminated massive amounts of boilerplate code by converting 25+ individual slice files into a single, automated system.

### Massive Impact Achieved
- ✅ **95% reduction in boilerplate code** (4,000+ → ~300 lines)
- ✅ **25+ tables** now handled by 1 generic factory
- ✅ **Automatic cache registration** for all tables
- ✅ **Real-time updates included** for all generic slices
- ✅ **Type-safe and consistent** across all implementations
- ✅ **Single source of truth** for CRUD operations

### Current Architecture
- **1 Custom Slice**: Complex features (tasks with advanced local query engine)
- **31+ Generic Slices**: Simple CRUD operations (all handled automatically)
- **1 Factory**: Manages all generic slice creation and registration

### How to Add a New Table (4 Steps)

```typescript
// 1. Add interface to types.ts
export interface YourEntity {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

// 2. Add to genericSlices.ts
const genericSliceConfigs = [
    { name: 'yourEntities', table: 'wh_your_entities', endpoint: '/your-entities', store: 'your_entities' },
];

// 3. Add IndexedDB store to DB.ts
if (!db.objectStoreNames.contains("your_entities")) {
    db.createObjectStore("your_entities", { keyPath: "id" });
}

// 4. Increment DB version
const CURRENT_DB_VERSION = "1.5.0";
```

**That's it!** The factory automatically creates:
- Redux slice with `getFromIndexedDB` and `fetchFromAPI` actions
- GenericCache instance
- Cache registry entry for real-time updates
- Store reducer registration
- AuthProvider initialization

### Usage in Components

```typescript
import { genericActions } from '@/store/genericSlices';

const MyComponent = () => {
    const dispatch = useDispatch();
    const data = useSelector(state => state.yourEntities);

    // Load from IndexedDB (fast)
    dispatch(genericActions.yourEntities.getFromIndexedDB());

    // Refresh from API
    dispatch(genericActions.yourEntities.fetchFromAPI());
};
```

### Current Implementation Status

**✅ Generic Slices (31+ tables):**
- All simple CRUD operations
- Categories, teams, workspaces, templates
- Forms, users, roles, permissions, teams
- Statuses, priorities, tags, spots
- SLAs, invitations, logs, attachments
- Custom fields, category assignments
- And many more...

**✅ Custom Slices (1 table):**
- Tasks (advanced local query engine, real-time updates, integrity validation)

## 🎨 Componentes shadcn/ui

### Instalación
```bash
# Instalar componente específico
npx shadcn@latest add [nombre-del-componente]
```

### Documentación Completa
Para ver todos los componentes disponibles, ejemplos de uso y personalización:
**https://ui.shadcn.com/docs/components**

Los componentes se instalan automáticamente en `src/components/ui/` y están listos para usar.

## 🛠️ Stack Tecnológico

- **React 18** + **TypeScript**
- **Vite** - Herramienta de construcción
- **Tailwind CSS v4** - Framework CSS
- **Radix UI** - Componentes accesibles
- **Redux Toolkit** - Gestión de estado
- **React Router v6** - Enrutamiento
- **Firebase Auth** - Autenticación
- **Stripe** - Procesamiento de pagos
- **AG Grid** - Grillas de datos avanzadas

## 🔐 Autenticación

El sistema de autenticación usa Firebase y tiene tres tipos de rutas:

- **Rutas Públicas**: `/auth/signin`, `/auth/signup`
- **Rutas de Autenticación**: `/onboarding` (solo usuarios autenticados)
- **Rutas Privadas**: Todas las demás (usuarios autenticados y con onboarding completo)






