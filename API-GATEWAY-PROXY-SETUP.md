# Configuración de API Gateway como Proxy para FileMaker

Esta solución crea un proxy en API Gateway que maneja CORS automáticamente y redirige las peticiones a FileMaker.

## Pasos:

### 1. Crear API Gateway REST API

1. Ve a AWS API Gateway Console
2. Clic en **Create API**
3. Selecciona **REST API** > **Build**
4. Nombre: `FileMaker-Proxy`
5. Endpoint Type: **Regional**
6. Clic en **Create API**

### 2. Crear Recurso Proxy

1. En tu API, haz clic derecho en el recurso raíz `/`
2. Selecciona **Create Resource**
3. Marca **Configure as proxy resource**
4. Resource Name: `proxy`
5. Resource Path: `{proxy+}`
6. Clic en **Create Resource**

### 3. Crear Método ANY

1. Selecciona el recurso `{proxy+}`
2. Clic en **Actions** > **Create Method**
3. Selecciona **ANY**
4. Clic en el checkmark ✓

### 4. Configurar Integración HTTP

1. Integration type: **HTTP Proxy**
2. Endpoint URL: `https://fms-dev.celerix.com/{proxy}`
3. Marca **Use HTTP Proxy integration**
4. Clic en **Save**

### 5. Habilitar CORS

1. Selecciona el método **ANY**
2. Clic en **Actions** > **Enable CORS**
3. Configuración:
   - Access-Control-Allow-Origin: `https://d6u5lexc7bczg.cloudfront.net`
   - Access-Control-Allow-Headers: `Content-Type,Authorization,X-FM-Data-Session-Token,X-Requested-With,Accept,Origin`
   - Access-Control-Allow-Methods: `GET,POST,PUT,DELETE,OPTIONS,PATCH`
   - Access-Control-Allow-Credentials: (dejar vacío)
4. Clic en **Enable CORS and replace existing CORS headers**

### 6. Desplegar API

1. Clic en **Actions** > **Deploy API**
2. Deployment stage: **New Stage**
3. Stage name: `prod`
4. Clic en **Deploy**

### 7. Obtener URL de API Gateway

Después del despliegue, copia la **Invoke URL**. Será algo como:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

### 8. Actualizar Variables de Entorno

En tu aplicación, actualiza la variable de entorno:
```env
VITE_FM_API_BASE_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

### 9. Configurar Mapping Template (Opcional pero Recomendado)

Para pasar correctamente los headers a FileMaker:

1. Selecciona el método **ANY**
2. En **Integration Request**, expande **HTTP Headers**
3. Agrega headers:
   - Name: `X-FM-Data-Session-Token`, Mapped from: `$input.params('X-FM-Data-Session-Token')`
   - Name: `Authorization`, Mapped from: `$input.params('Authorization')`
   - Name: `Content-Type`, Mapped from: `$input.params('Content-Type')`

### 10. Configurar Request/Response Passthrough

1. En **Integration Request** > **Body Mapping Templates**
2. Content-Type: `application/json`
3. Template: `$input.json('$')`
4. Clic en **Save**

## Ventajas de esta Solución:

- ✅ CORS manejado automáticamente por API Gateway
- ✅ No requiere acceso a FileMaker Server
- ✅ Funciona inmediatamente después del despliegue
- ✅ Puedes agregar autenticación adicional si es necesario
- ✅ Logs y monitoreo en CloudWatch

## Desventajas:

- ⚠️ Agrega latencia adicional (~50-100ms)
- ⚠️ Costos adicionales de API Gateway (pero muy bajos)
- ⚠️ Requiere mantener la configuración de API Gateway

## Verificación:

Después de configurar, prueba haciendo una petición desde tu aplicación CloudFront. Deberías ver que las peticiones van a API Gateway en lugar de directamente a FileMaker, y CORS debería funcionar correctamente.

