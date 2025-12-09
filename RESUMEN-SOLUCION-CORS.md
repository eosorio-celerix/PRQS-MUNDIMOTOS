# Resumen: Solución CORS para CloudFront

## ❌ Lo que NO funciona:

1. **Lambda@Edge** - No funciona porque las peticiones van directamente del navegador a FileMaker, no pasan por CloudFront
2. **Response Headers Policy en CloudFront** - No funciona por la misma razón
3. **Quitar Lambda@Edge** - No resuelve el problema (pero tampoco lo empeora)

## ✅ Soluciones que SÍ funcionan:

### Opción 1: Configurar FileMaker Server (MEJOR OPCIÓN)

**Pasos rápidos:**
1. Accede a: `https://fms-dev.celerix.com:16000`
2. Ve a: **Configuration** > **Web Publishing** > **CORS Settings**
3. Habilita CORS
4. Agrega origen: `https://d6u5lexc7bczg.cloudfront.net`
5. Métodos: GET, POST, PUT, DELETE, OPTIONS
6. Headers: `Content-Type, Authorization, X-FM-Data-Session-Token, X-Requested-With, Accept, Origin`
7. Guarda y reinicia Web Publishing

**Ventajas:**
- ✅ Solución directa y permanente
- ✅ Sin latencia adicional
- ✅ Sin costos adicionales
- ✅ Funciona inmediatamente

### Opción 2: API Gateway como Proxy

Si NO tienes acceso a FileMaker Server:

1. Crea API Gateway REST API
2. Crea recurso `{proxy+}` con método ANY
3. Configura integración HTTP hacia `https://fms-dev.celerix.com`
4. Habilita CORS en API Gateway
5. Actualiza `VITE_FM_API_BASE_URL` para apuntar a API Gateway

**Ventajas:**
- ✅ Funciona sin acceso a FileMaker Server
- ✅ CORS manejado automáticamente

**Desventajas:**
- ⚠️ Agrega latencia (~50-100ms)
- ⚠️ Costos adicionales (mínimos)

## 🔍 Verificación:

Después de aplicar la solución, verifica en las herramientas de desarrollador (F12 > Network):
- Debe aparecer `Access-Control-Allow-Origin` en los headers de respuesta
- Las peticiones deben completarse sin errores de CORS

## 📝 Nota sobre Lambda@Edge:

Si tienes Lambda@Edge configurado en CloudFront, puedes quitarlo porque:
- No está haciendo nada útil (las peticiones no pasan por CloudFront)
- No está causando el problema
- Quitarlo no resolverá CORS, pero tampoco lo empeorará

**Conclusión:** Quitar Lambda@Edge no resolverá el problema. Necesitas configurar FileMaker Server para CORS o usar API Gateway como proxy.

