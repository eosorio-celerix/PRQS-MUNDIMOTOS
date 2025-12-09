# Solución CORS para CloudFront - Pasos Específicos

## Problema Actual
Las peticiones desde `https://d6u5lexc7bczg.cloudfront.net` a `https://fms-dev.celerix.com` están siendo bloqueadas por CORS porque FileMaker no envía los headers CORS necesarios.

## Solución Recomendada: Configurar FileMaker Server para CORS

**Esta es la solución más directa y eficiente.**

### Pasos:

1. **Acceder a FileMaker Server Admin Console:**
   - Abre el navegador y ve a: `https://fms-dev.celerix.com:16000` (o la URL de tu servidor FileMaker)
   - Inicia sesión con credenciales de administrador

2. **Configurar CORS:**
   - Ve a **Configuration** > **Web Publishing** > **CORS Settings**
   - Habilita CORS
   - En **Allowed Origins**, agrega:
     ```
     https://d6u5lexc7bczg.cloudfront.net
     ```
   - En **Allowed Methods**, selecciona:
     - GET
     - POST
     - PUT
     - DELETE
     - OPTIONS
   - En **Allowed Headers**, agrega:
     ```
     Content-Type
     Authorization
     X-FM-Data-Session-Token
     X-Requested-With
     Accept
     Origin
     ```
   - En **Exposed Headers**, puedes dejar vacío o agregar headers que FileMaker expone
   - **Max Age**: 3600
   - **Allow Credentials**: Desmarcado (false)

3. **Guardar y reiniciar:**
   - Guarda los cambios
   - Reinicia el servicio Web Publishing si es necesario

## Solución Alternativa: Lambda@Edge (Si no tienes acceso a FileMaker Server)

Si no tienes acceso a FileMaker Server, puedes usar Lambda@Edge para interceptar las respuestas y agregar headers CORS.

### Pasos para Lambda@Edge:

1. **Crear función Lambda:**
   - Ve a AWS Lambda Console
   - Selecciona región: **us-east-1** (requerido para Lambda@Edge)
   - Crea una nueva función
   - Nombre: `cloudfront-cors-handler`
   - Runtime: Node.js 18.x o superior
   - Permisos: Crear un rol básico de Lambda

2. **Código de la función:**
   ```javascript
   exports.handler = async (event) => {
       const response = event.Records[0].cf.response;
       const request = event.Records[0].cf.request;
       const headers = response.headers || {};

       // Obtener el origen de la petición
       const origin = request.headers['origin'] 
           ? request.headers['origin'][0].value 
           : '*';

       // Agregar headers CORS
       headers['access-control-allow-origin'] = [{
           key: 'Access-Control-Allow-Origin',
           value: origin === 'https://d6u5lexc7bczg.cloudfront.net' ? origin : '*'
       }];
       
       headers['access-control-allow-methods'] = [{
           key: 'Access-Control-Allow-Methods',
           value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
       }];
       
       headers['access-control-allow-headers'] = [{
           key: 'Access-Control-Allow-Headers',
           value: 'Content-Type, Authorization, X-FM-Data-Session-Token, X-Requested-With, Accept, Origin'
       }];
       
       headers['access-control-max-age'] = [{
           key: 'Access-Control-Max-Age',
           value: '3600'
       }];

       headers['access-control-allow-credentials'] = [{
           key: 'Access-Control-Allow-Credentials',
           value: 'false'
       }];

       // Manejar preflight OPTIONS
       if (request.method === 'OPTIONS') {
           return {
               status: '200',
               statusDescription: 'OK',
               headers: headers,
               body: '',
               bodyEncoding: 'text'
           };
       }

       return response;
   };
   ```

3. **Publicar versión:**
   - En la función Lambda, haz clic en **Actions** > **Publish new version**
   - Agrega una descripción: "Versión para CloudFront CORS"
   - Copia el ARN de la versión (ej: `arn:aws:lambda:us-east-1:123456789012:function:cloudfront-cors-handler:1`)

4. **Asociar a CloudFront:**
   - Ve a CloudFront Console
   - Selecciona tu distribución
   - Ve a **Behaviors**
   - Edita el behavior que maneja las peticiones a FileMaker (o crea uno nuevo)
   - En **Function associations**, en **Viewer Response**, selecciona:
     - Function type: Lambda@Edge
     - Function ARN: Pega el ARN de la versión de Lambda
   - Guarda los cambios

5. **Invalidar caché (opcional pero recomendado):**
   - En CloudFront, ve a **Invalidations**
   - Crea una invalidación con el patrón: `/*`
   - Espera a que se complete

6. **Esperar propagación:**
   - Los cambios en CloudFront pueden tardar 5-15 minutos en propagarse

## Nota Importante sobre Lambda@Edge

**Lambda@Edge solo funciona si las peticiones pasan por CloudFront.** Si las peticiones van directamente del navegador a FileMaker (como parece ser el caso), Lambda@Edge NO funcionará porque CloudFront no intercepta esas peticiones.

## Verificación

Después de aplicar la solución:

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña **Network**
3. Realiza una petición (por ejemplo, intenta iniciar sesión)
4. Verifica que en los headers de respuesta aparezcan:
   - `Access-Control-Allow-Origin: https://d6u5lexc7bczg.cloudfront.net`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
   - `Access-Control-Allow-Headers: ...`

## Si Nada Funciona: Proxy API Gateway

Si ninguna de las soluciones anteriores funciona, la última opción es crear un proxy usando AWS API Gateway que maneje CORS automáticamente.

1. Crea una API Gateway REST API
2. Crea un recurso proxy: `{proxy+}`
3. Configura el método ANY para ese recurso
4. Configura la integración HTTP hacia `https://fms-dev.celerix.com`
5. Habilita CORS en API Gateway
6. Actualiza `VITE_FM_API_BASE_URL` para apuntar a tu API Gateway

Esto agregará latencia adicional pero garantiza que CORS funcione.

