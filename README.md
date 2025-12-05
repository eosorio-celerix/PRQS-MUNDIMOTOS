# PQRS Mundimotos

Sistema de gestión de Peticiones, Quejas, Reclamos y Sugerencias (PQRS) desarrollado en React.

## Características

- ✅ Consultar PQRS existentes
- ✅ Crear nuevas PQRS
- ✅ Calificar servicio (redirección a URL externa)
- ✅ Interfaz moderna y responsive
- ✅ Integración con API REST

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales de FileMaker
```

3. Variables de entorno requeridas en `.env`:
```env
VITE_FM_API_BASE_URL=https://fms-dev.celerix.com
VITE_FM_DATABASE=PQRS-MM-QA
VITE_FM_LAYOUT=PQRS
VITE_FM_AUTH_USER=tu_usuario
VITE_FM_AUTH_PASSWORD=tu_contraseña
```

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

5. Abrir en el navegador: `http://localhost:3000`

## Estructura del Proyecto

```
src/
├── components/
│   ├── Header.jsx          # Componente de encabezado
│   ├── ConsultarPQRS.jsx   # Componente para consultar PQRS
│   └── CrearPQRS.jsx       # Componente para crear PQRS
├── services/
│   └── api.js              # Servicio para consumir la API
├── App.jsx                  # Componente principal
├── App.css                  # Estilos principales
├── main.jsx                 # Punto de entrada
└── index.css                # Estilos globales
```

## API

El proyecto consume endpoints de FileMaker Data API: `https://fms-dev.celerix.com`

### Endpoints utilizados:

- `POST /fmi/data/v1/databases/{database}/sessions` - Obtener token de sesión (autenticación básica)
- `GET /fmi/data/v1/databases/{database}/layouts/{layout}/records?_limit=500` - Obtener todas las PQRS
- `GET /fmi/data/v1/databases/{database}/layouts/{layout}/records/{id}` - Obtener una PQRS por ID
- `POST /fmi/data/v1/databases/{database}/layouts/{layout}/records` - Crear una nueva PQRS

### Configuración de Seguridad

⚠️ **Importante**: El archivo `.env` contiene credenciales sensibles y NO debe subirse al repositorio. Está incluido en `.gitignore` por seguridad.

## Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción

## Tecnologías Utilizadas

- React 18
- Vite
- Axios
- CSS3

