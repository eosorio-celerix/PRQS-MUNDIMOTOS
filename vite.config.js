import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración base para GitHub Pages
// Si el repositorio está en la raíz (username.github.io), usar '/'
// Si está en un subdirectorio (username.github.io/repo-name), usar '/repo-name/'
// Puedes configurarlo mediante la variable de entorno VITE_BASE_PATH
const base = process.env.VITE_BASE_PATH || '/PQRS-MundiMotos-REPO/';

export default defineConfig({
  base: base,
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      '/fmi': {
        target: 'https://fms-dev.celerix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Copiar TODOS los headers de la petición original
            // Esto asegura que headers personalizados como X-FM-Data-Session-Token se pasen
            Object.keys(req.headers).forEach((key) => {
              const value = req.headers[key];
              if (value && typeof value === 'string') {
                // Preservar el case original del header si es importante
                const headerKey =
                  key.toLowerCase() === 'x-fm-data-session-token'
                    ? 'X-FM-Data-Session-Token'
                    : key.toLowerCase() === 'authorization'
                    ? 'Authorization'
                    : key;
                proxyReq.setHeader(headerKey, value);
              } else if (Array.isArray(value)) {
                // Si el header es un array, tomar el primer valor
                const headerKey =
                  key.toLowerCase() === 'x-fm-data-session-token'
                    ? 'X-FM-Data-Session-Token'
                    : key.toLowerCase() === 'authorization'
                    ? 'Authorization'
                    : key;
                proxyReq.setHeader(headerKey, value[0]);
              }
            });

            // Log para depuración - estos aparecen en la consola del SERVIDOR, no del navegador
            console.log(
              '🔍 [PROXY] Headers originales recibidos:',
              Object.keys(req.headers)
            );
            console.log(
              '🔍 [PROXY] Headers siendo enviados:',
              Object.keys(proxyReq.getHeaders())
            );

            // Verificar si el header está presente (case insensitive)
            const hasToken =
              req.headers['x-fm-data-session-token'] ||
              req.headers['X-FM-Data-Session-Token'] ||
              Object.keys(req.headers).find(
                (k) => k.toLowerCase() === 'x-fm-data-session-token'
              );

            if (hasToken) {
              const tokenValue =
                req.headers['x-fm-data-session-token'] ||
                req.headers['X-FM-Data-Session-Token'] ||
                req.headers[
                  Object.keys(req.headers).find(
                    (k) => k.toLowerCase() === 'x-fm-data-session-token'
                  )
                ];
              console.log(
                '✅ [PROXY] X-FM-Data-Session-Token encontrado:',
                tokenValue?.substring(0, 20) + '...'
              );
              console.log(
                '✅ [PROXY] Header será enviado como: X-FM-Data-Session-Token'
              );
            } else {
              console.log(
                '❌ [PROXY] X-FM-Data-Session-Token NO encontrado en headers'
              );
              console.log(
                '❌ [PROXY] Todos los headers recibidos:',
                JSON.stringify(req.headers, null, 2)
              );
            }
          });
        },
      },
    },
  },
});
