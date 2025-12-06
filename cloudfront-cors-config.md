# Configuración de CORS para CloudFront

Este documento explica cómo resolver problemas de CORS cuando la aplicación está desplegada en CloudFront.

## Problema

Cuando la aplicación se despliega en CloudFront, las peticiones van directamente desde el navegador a FileMaker, y el navegador bloquea las peticiones cross-origin si no hay headers CORS apropiados.

## Soluciones

### Opción 1: Configurar CloudFront para agregar headers CORS (Recomendado)

1. **En la consola de CloudFront:**
   - Ve a tu distribución de CloudFront
   - Selecciona "Behaviors"
   - Edita el behavior de tu aplicación
   - En "Response Headers Policy", crea o selecciona una política que incluya:
     - `Access-Control-Allow-Origin: *` (o tu dominio específico)
     - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
     - `Access-Control-Allow-Headers: Content-Type, Authorization, X-FM-Data-Session-Token`
     - `Access-Control-Allow-Credentials: false`

2. **Configuración de Response Headers Policy:**
   ```
   CORS Headers:
   - Access-Control-Allow-Origin: *
   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   - Access-Control-Allow-Headers: Content-Type, Authorization, X-FM-Data-Session-Token, X-Requested-With
   - Access-Control-Max-Age: 3600
   ```

### Opción 2: Lambda@Edge para manejar CORS (Más control)

Crea una función Lambda@Edge que agregue headers CORS a las respuestas:

**Función Lambda@Edge (viewer-response):**

```javascript
exports.handler = async (event) => {
    const response = event.Records[0].cf.response;
    const headers = response.headers;

    // Agregar headers CORS
    headers['access-control-allow-origin'] = [{
        key: 'Access-Control-Allow-Origin',
        value: '*'
    }];
    
    headers['access-control-allow-methods'] = [{
        key: 'Access-Control-Allow-Methods',
        value: 'GET, POST, PUT, DELETE, OPTIONS'
    }];
    
    headers['access-control-allow-headers'] = [{
        key: 'Access-Control-Allow-Headers',
        value: 'Content-Type, Authorization, X-FM-Data-Session-Token, X-Requested-With'
    }];
    
    headers['access-control-max-age'] = [{
        key: 'Access-Control-Max-Age',
        value: '3600'
    }];

    // Manejar preflight OPTIONS
    if (event.Records[0].cf.request.method === 'OPTIONS') {
        return {
            status: '200',
            statusDescription: 'OK',
            headers: headers,
            body: ''
        };
    }

    return response;
};
```

**Pasos para implementar Lambda@Edge:**
1. Crea la función Lambda en la región `us-east-1` (requerido para Lambda@Edge)
2. Publica una nueva versión de la función
3. En CloudFront, asocia la función al evento "Viewer Response"
4. Despliega los cambios (puede tomar 5-10 minutos)

### Opción 3: Configurar FileMaker Server para CORS

Si tienes acceso al servidor FileMaker, puedes configurar CORS directamente:

1. En FileMaker Server Admin Console:
   - Ve a "Configuration" > "Web Publishing"
   - En "CORS Settings", agrega tu dominio de CloudFront
   - Permite los métodos: GET, POST, PUT, DELETE, OPTIONS
   - Permite los headers: Content-Type, Authorization, X-FM-Data-Session-Token

### Opción 4: Proxy API Gateway (Alternativa)

Si ninguna de las opciones anteriores funciona, puedes crear un proxy usando AWS API Gateway:

1. Crea una API Gateway REST API
2. Configura un proxy integration hacia FileMaker
3. Habilita CORS en API Gateway
4. Actualiza `VITE_FM_API_BASE_URL` para apuntar a API Gateway en lugar de FileMaker directamente

## Verificación

Para verificar que CORS está funcionando:

1. Abre las herramientas de desarrollador del navegador (F12)
2. Ve a la pestaña "Network"
3. Realiza una petición a FileMaker
4. Verifica que en los headers de respuesta aparezcan:
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`

## Notas Importantes

- Si usas `Access-Control-Allow-Origin: *`, no puedes usar `Access-Control-Allow-Credentials: true`
- Para producción, considera restringir `Access-Control-Allow-Origin` a tu dominio específico en lugar de `*`
- Los cambios en CloudFront pueden tardar varios minutos en propagarse

## Troubleshooting

Si sigues teniendo problemas:

1. Verifica que los headers CORS estén presentes en las respuestas
2. Revisa la consola del navegador para ver el error específico de CORS
3. Asegúrate de que `VITE_FM_API_BASE_URL` esté configurado correctamente
4. Verifica que no haya errores de red en la pestaña Network

