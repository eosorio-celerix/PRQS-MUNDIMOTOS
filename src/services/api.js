import axios from 'axios'

// Variables de entorno (Vite requiere el prefijo VITE_)
const API_BASE_URL = import.meta.env.VITE_FM_API_BASE_URL || 'https://fms-dev.celerix.com'
const DATABASE = import.meta.env.VITE_FM_DATABASE || 'PQRS-MM-QA'
const LAYOUT = import.meta.env.VITE_FM_LAYOUT || 'PQRS'

const URL_DEPLOY = import.meta.env.VITE_URL_DEPLOY || 'https://mundimotos.com/pqrs'
// En desarrollo, usar el proxy de Vite para evitar CORS
// El proxy redirige /fmi/* a https://fms-dev.celerix.com/fmi/*
// En producción, usar la URL completa
const isDevelopment = import.meta.env.DEV
// En desarrollo, usar ruta relativa que será manejada por el proxy
// En producción, usar la URL completa
const BASE_URL = isDevelopment ? '' : API_BASE_URL

// Credenciales para autenticación básica desde variables de entorno
const BASIC_AUTH_USER = import.meta.env.VITE_FM_AUTH_USER || ''
const BASIC_AUTH_PASSWORD = import.meta.env.VITE_FM_AUTH_PASSWORD || ''

// API Key para webhook de email
const API_KEY_WEBHOOK_EMAIL = import.meta.env.VITE_API_KEY_WEBHOOK_EMAIL || ''
const WEBHOOK_EMAIL_URL = import.meta.env.VITE_WEBHOOK_EMAIL_URL || 'https://celerix.app.n8n.cloud/webhook-test/mundimotos/send-pqrs-email'

// Variable para almacenar el token de sesión
let sessionToken = null

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Configuración para CORS en producción
  withCredentials: false,
  // Timeout para evitar que las peticiones se queden colgadas
  timeout: 30000,
})

// Interceptor para manejar errores y logging
api.interceptors.request.use(
  (config) => {
    // Log de petición (temporal para depuración)
    if (!isDevelopment) {
      console.log('🚀 [AXIOS Request]', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        headers: Object.keys(config.headers || {}),
        fullUrl: `${config.baseURL}${config.url}`
      })
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    // Log de respuesta exitosa (temporal para depuración)
    if (!isDevelopment) {
      console.log('✅ [AXIOS Response]', {
        status: response.status,
        url: response.config.url,
        headers: Object.keys(response.headers || {}),
        corsHeaders: {
          'access-control-allow-origin': response.headers['access-control-allow-origin'],
          'access-control-allow-methods': response.headers['access-control-allow-methods'],
          'access-control-allow-headers': response.headers['access-control-allow-headers']
        }
      })
    }
    return response
  },
  (error) => {
    // Log de error (temporal para depuración)
    if (!isDevelopment) {
      console.error('❌ [AXIOS Error]', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        headers: error.response?.headers,
        corsError: error.message?.includes('CORS') || error.message?.includes('cors'),
        isNetworkError: !error.response
      })
      
      // Si es un error de CORS, mostrar información adicional
      if (error.message?.includes('CORS') || error.message?.includes('cors')) {
        console.error('🚨 ERROR DE CORS DETECTADO')
        console.error('La petición fue bloqueada por el navegador debido a CORS')
        console.error('Verifica que API Gateway tenga configurado CORS correctamente')
        console.error('URL de la petición:', error.config?.url)
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Obtiene un token de sesión de FileMaker usando autenticación básica
 */
const getSessionToken = async () => {
  try {
    // Validar que las credenciales estén configuradas
    if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
      throw new Error('Las credenciales de FileMaker no están configuradas. Por favor, verifica tu archivo .env')
    }

    // Si ya tenemos un token válido, lo retornamos
    if (sessionToken) {
      return sessionToken
    }

    // Crear credenciales de autenticación básica
    const credentials = btoa(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`)
    
    // Construir la URL - en desarrollo usa ruta relativa para el proxy
    // El proxy de Vite redirige /fmi/* a https://fms-dev.celerix.com/fmi/*
    const url = isDevelopment 
      ? `/fmi/data/v1/databases/${DATABASE}/sessions`
      : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/sessions`
    
    // Usar axios.request para tener control total sobre la petición
    const authHeader = `Basic ${credentials}`
    
    const response = await axios.request({
      method: 'POST',
      url: url,
      data: {},
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      // Configuración para CORS
      withCredentials: false,
      // Asegurar que axios no modifique la petición
      transformRequest: [(data) => JSON.stringify(data)],
      // Asegurar que los headers se envíen
      validateStatus: function (status) {
        return status < 500; // Resolver para cualquier código menor que 500
      }
    })
    
    // FileMaker retorna el token en response.data.response.token
    if (response.data?.response?.token) {
      sessionToken = response.data.response.token
      return sessionToken
    } else {
      throw new Error('No se pudo obtener el token de sesión')
    }
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response?.data?.messages?.[0]?.message || 
                          error.response?.data?.message || 
                          `Error ${error.response.status}: ${error.response.statusText}`
      throw new Error(errorMessage)
    }
    throw new Error(error.message || 'Error al autenticar con FileMaker')
  }
}

/**
 * Obtiene registros de FileMaker usando el token de sesión
 */
const getRecords = async (limit = 2000) => {
  try {
    const token = await getSessionToken()
    
    if (!token) {
      throw new Error('No se pudo obtener el token de sesión')
    }
    
    // Construir la URL correcta según el entorno
    const url = isDevelopment 
      ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
      : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
    
    // FileMaker puede requerir Authorization en lugar de X-FM-Data-Session-Token
    // Probemos con ambos headers para asegurarnos
    const headers = {
      'X-FM-Data-Session-Token': token,
      'Authorization': `Bearer ${token}`, // También enviar como Authorization por si acaso
      'Content-Type': 'application/json',
    }
    
    const response = await axios.get(
      url,
      {
        params: {
          _limit: limit,
        },
        headers: headers,
      }
    )
    
    // FileMaker retorna los registros en response.data.response.data
    if (response.data?.response?.data) {
      return response.data.response.data
    } else {
      return []
    }
  } catch (error) {
    if (error.response) {
      // Si el token expiró, intentar obtener uno nuevo
      if (error.response?.status === 401 || error.response?.status === 952) {
        sessionToken = null // Limpiar token inválido
        const token = await getSessionToken()
        
        // Reintentar la petición
        const retryUrl = isDevelopment 
          ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
          : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
        
        const retryResponse = await axios.get(
          retryUrl,
          {
            params: {
              _limit: limit,
            },
            headers: {
              'X-FM-Data-Session-Token': token,
              'Content-Type': 'application/json',
            },
          }
        )
        
        if (retryResponse.data?.response?.data) {
          return retryResponse.data.response.data
        }
      }
      
      const errorMessage = error.response?.data?.messages?.[0]?.message || 
                          error.response?.data?.message || 
                          error.message || 
                          'Error al consultar registros'
      throw new Error(errorMessage)
    }

    throw new Error(error.message || 'Error al consultar registros')
  }
}

/**
 * Obtiene un registro específico por ID
 */
const getRecordById = async (recordId) => {
  try {
    const token = await getSessionToken()
    
    if (!token) {
      throw new Error('No se pudo obtener el token de sesión')
    }
    
    const url = isDevelopment 
      ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
      : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
    
    const headers = {
      'X-FM-Data-Session-Token': token,
      'Authorization': `Bearer ${token}`, // También enviar como Authorization
      'Content-Type': 'application/json',
    }
    
    // Log para depuración (temporal)
    console.log('🔍 [GET Record] URL:', url)
    console.log('🔍 [GET Record] Headers enviados:', headers)
    console.log('🔍 [GET Record] API_BASE_URL:', API_BASE_URL)
    
    // Usar axios.request para tener el mismo comportamiento que POST sessions
    const response = await axios.request({
      method: 'GET',
      url: url,
      headers: headers,
      // Configuración para CORS
      withCredentials: false,
      // Asegurar que los headers se envíen
      validateStatus: function (status) {
        return status < 500; // Resolver para cualquier código menor que 500
      }
    })
    
    // Log de respuesta (temporal)
    console.log('✅ [GET Record] Respuesta recibida:', {
      status: response.status,
      headers: response.headers,
      data: response.data?.response ? 'Datos recibidos' : 'Sin datos'
    })
    
    if (response.data?.response?.data?.[0]) {
      return response.data.response.data[0]
    } else {
      throw new Error('Registro no encontrado')
    }
  } catch (error) {
    if (error.response) {
      // Si el token expiró, intentar obtener uno nuevo
      if (error.response?.status === 401 || error.response?.status === 952) {
        sessionToken = null
        const token = await getSessionToken()
        
        const retryUrl = isDevelopment 
          ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
          : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
        
        const retryHeaders = {
          'X-FM-Data-Session-Token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
        
        const retryResponse = await axios.request({
          method: 'GET',
          url: retryUrl,
          headers: retryHeaders,
          withCredentials: false,
          validateStatus: function (status) {
            return status < 500;
          }
        })
        
        if (retryResponse.data?.response?.data?.[0]) {
          return retryResponse.data.response.data[0]
        }
      }
      
      // Verificar si el error es que el registro no se encontró
      const errorMessage = error.response?.data?.messages?.[0]?.message || 
                          error.response?.data?.message || 
                          `Error ${error.response.status}: ${error.response.statusText}`
      
      // Si el error indica que el registro no existe, lanzar mensaje personalizado
      if (error.response?.status === 404 || 
          errorMessage?.toLowerCase().includes('record is missing') ||
          errorMessage?.toLowerCase().includes('no encontrado') ||
          errorMessage?.toLowerCase().includes('not found')) {
        throw new Error('No se encontró información relacionada')
      }
      
      throw new Error(errorMessage)
    }
    
    throw new Error(error.message || 'Error al consultar el registro')
  }
}

/**
 * Subir archivos adjuntos a un campo contenedor de FileMaker
 * El campo Adjuntos está en la tabla tblPQRSBitacora
 */
const subirArchivosAdjuntos = async (pqrsRecordId, archivos, token) => {
  try {
    const layoutBitacora = 'tblPQRSBitacora'
    const campoContenedor = 'Adjuntos'
    const resultados = []
    
    for (const archivo of archivos) {
      try {
        // Primero crear un registro en tblPQRSBitacora con la relación a la PQRS
        const urlCrearRegistro = isDevelopment
          ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
          : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
        
        const headers = {
          'X-FM-Data-Session-Token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
        
        // Crear registro en bitácora con la relación a la PQRS
        const registroResponse = await axios.request({
          method: 'POST',
          url: urlCrearRegistro,
          data: {
            fieldData: {
              fk_PQRS: String(pqrsRecordId),
              Accion: 'Adjunto',
              Comentario: `Archivo adjunto: ${archivo.name}`,
            },
          },
          headers: headers,
          transformRequest: [(data) => JSON.stringify(data)],
          validateStatus: function (status) {
            return status < 500
          }
        })
        
        if (!registroResponse.data?.response?.recordId) {
          throw new Error('No se pudo crear el registro en bitácora para el adjunto')
        }
        
        const bitacoraRecordId = registroResponse.data.response.recordId
        
        // Ahora subir el archivo al campo contenedor en el registro de bitácora
        const formData = new FormData()
        formData.append('upload', archivo, archivo.name)
        
        const urlSubirArchivo = isDevelopment
          ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${bitacoraRecordId}/containers/${campoContenedor}`
          : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${bitacoraRecordId}/containers/${campoContenedor}`
        
        const headersArchivo = {
          'X-FM-Data-Session-Token': token,
          'Authorization': `Bearer ${token}`,
          // No establecer Content-Type, dejar que el navegador lo haga para multipart/form-data
        }
        
        const archivoResponse = await axios.post(urlSubirArchivo, formData, {
          headers: headersArchivo,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        })
        
        if (archivoResponse.data?.response?.modId) {
          resultados.push({
            success: true,
            nombre: archivo.name,
            modId: archivoResponse.data.response.modId,
            bitacoraRecordId: bitacoraRecordId,
          })
        } else {
          throw new Error('No se pudo subir el archivo al contenedor')
        }
      } catch (error) {
        console.error(`Error al subir archivo ${archivo.name}:`, error.response?.data?.messages?.[0]?.message || error.message)
        resultados.push({
          success: false,
          nombre: archivo.name,
          error: error.response?.data?.messages?.[0]?.message || error.message || 'Error al subir el archivo',
        })
      }
    }
    
    return resultados
  } catch (error) {
    throw new Error(error.message || 'Error al subir archivos adjuntos')
  }
}

/**
 * Ejecutar un script de FileMaker
 * En FileMaker Data API, los scripts se ejecutan como parte de una operación GET en un layout
 */
const ejecutarScript = async (scriptName, layout, scriptParam, token) => {
  try {
    // En FileMaker Data API, los scripts se ejecutan usando GET con el parámetro script en la query string
    const url = isDevelopment 
      ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layout}/script/${scriptName}`
      : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layout}/script/${scriptName}`
    
    const headers = {
      'X-FM-Data-Session-Token': token,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    
    // Construir los parámetros de la query string
    const params = {}
    if (scriptParam) {
      params['script.param'] = String(scriptParam)
    }
    
    const response = await axios.request({
      method: 'GET',
      url: url,
      params: params,
      headers: headers,
      validateStatus: function (status) {
        return status < 500
      }
    })
    
    return response.data
  } catch (error) {
    console.error('Error al ejecutar script:', error.response?.data || error.message)
    throw new Error(error.response?.data?.messages?.[0]?.message || error.message || 'Error al ejecutar el script')
  }
}

/**
 * Crear registro en la bitácora para una PQRS
 */
const crearRegistroBitacora = async (pqrsRecordId, token) => {
  try {
    const layoutBitacora = 'tblPQRSBitacora'
    
    const url = isDevelopment 
      ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
      : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
    
    const headers = {
      'X-FM-Data-Session-Token': token,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    
    const fieldData = {
      fk_PQRS: String(pqrsRecordId),
      Accion: 'CREADA',
      Comentario: 'Cambio de estado automatico',
    }
    
    const response = await axios.request({
      method: 'POST',
      url: url,
      data: {
        fieldData: fieldData,
      },
      headers: headers,
      transformRequest: [(data) => JSON.stringify(data)],
      validateStatus: function (status) {
        return status < 500
      }
    })
    
    if (response.data?.response?.recordId) {
      return {
        success: true,
        recordId: response.data.response.recordId,
      }
    }
    
    // Si no hay recordId, verificar si hay errores
    if (response.status >= 400 || (response.data?.messages && response.data.messages.length > 0)) {
      const errorMessage = response.data?.messages?.[0]?.message || 'Error al crear el registro en bitácora'
      throw new Error(errorMessage)
    }
    
    throw new Error('No se pudo crear el registro en bitácora')
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response?.data?.messages?.[0]?.message || 
                          error.response?.data?.message || 
                          'Error al crear el registro en bitácora'
      throw new Error(errorMessage)
    }
    throw new Error(error.message || 'Error al crear el registro en bitácora')
  }
}

export const pqrsService = {
  // Obtener todas las PQRS
  getPQRS: async (params = {}) => {
    try {
      const limit = params._limit || 2000
      const records = await getRecords(limit)
      
      // Transformar los registros de FileMaker al formato esperado
      return records.map(record => ({
        id: record.recordId || record.fieldData?.RecordID,
        recordId: record.recordId,
        ...record.fieldData,
        modId: record.modId,
      }))
    } catch (error) {
      throw new Error(error.message || 'Error al consultar PQRS')
    }
  },

  // Obtener una PQRS por ID
  getPQRSById: async (id) => {
    try {
      const record = await getRecordById(id)
      return {
        id: record.recordId,
        recordId: record.recordId,
        ...record.fieldData,
        modId: record.modId,
      }
    } catch (error) {
      // Si el error ya es el mensaje personalizado, mantenerlo
      if (error.message === 'No se encontró información relacionada') {
        throw error
      }
      // Si el error indica que no se encontró, usar mensaje personalizado
      if (error.message?.toLowerCase().includes('record is missing') ||
          error.message?.toLowerCase().includes('no encontrado') ||
          error.message?.toLowerCase().includes('not found')) {
        throw new Error('No se encontró información relacionada')
      }
      throw new Error(error.message || 'Error al consultar la PQRS')
    }
  },

  // Crear una nueva PQRS
  createPQRS: async (data) => {
    try {
      const token = await getSessionToken()
      
      if (!token) {
        throw new Error('No se pudo obtener el token de sesión')
      }
      
      // Mapeo de tipos de solicitud
      const tipoMap = {
        'peticion': 'Petición',
        'queja': 'Queja',
        'reclamo': 'Reclamo',
        'sugerencia': 'Sugerencia',
        'felicitacion': 'Felicitación'
      }
      
      // Mapeo de áreas
      const areaMap = {
        'SERVICIO AL CLIENTE': 'Servicio al cliente',
        'GARANTÍA': 'Garantía',
        'CAMBIO O DEVOLUCIÓN': 'Cambio o devolución'
      }
      
      // Función para convertir fecha de YYYY-MM-DD a MM/DD/YYYY
      const formatDate = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const year = date.getFullYear()
        return `${month}/${day}/${year}`
      }
      
      // Preparar los datos para FileMaker con los nombres de campo correctos
      const fieldData = {
        // Mapear tipo de solicitud
        Solicitud: tipoMap[data.tipo] || data.tipo,
        
        // Información personal
        Nombre_completo: data.nombre || '',
        Tipo_documento: data.tipoDocumento || '',
        Documento: data.numeroDocumento ? Number(data.numeroDocumento) : '',
        Correo: data.email || '',
        Telefono_contacto: data.telefono ? Number(data.telefono) : '',
        Estado: 'Abierta',
        
        // Información de compra (opcional)
        // Solo incluir si tienen valor
        ...(data.fechaCompra ? { Fecha_compra: formatDate(data.fechaCompra) } : {}),
        ...(data.numeroFactura ? { No_factura: data.numeroFactura } : {}),
        ...(data.dondeCompro ? { Sede: data.dondeCompro } : {}),
        ...(data.areaDirigida ? { fk_ClaseSolicitud: data.areaDirigida } : {}),
        
        // Descripción
        Descripcion_pqrs: data.descripcion || '',
        
        // Política de datos (solo incluir si está aceptada)
        // Nota: Si el campo es calculado o de solo lectura en FileMaker, no incluirlo
        // Politica_datos: data.aceptaPolitica ? '["Acepto"]' : ''
      }
      
      // Remover campos vacíos opcionales para evitar errores
      // También remover campos que podrían ser calculados o de solo lectura
      const requiredFields = ['Solicitud', 'Nombre_completo', 'Tipo_documento', 'Documento', 'Correo', 'Telefono_contacto', 'Descripcion_pqrs']
      
      Object.keys(fieldData).forEach(key => {
        const value = fieldData[key]
        
        // Eliminar campos vacíos, null o undefined (excepto los requeridos)
        if (value === '' || value === null || value === undefined) {
          if (!requiredFields.includes(key)) {
            delete fieldData[key]
          }
        }
      })
      
      // Agregar Politica_datos solo si está aceptada (y si el campo es modificable)
      if (data.aceptaPolitica) {
        fieldData.Politica_datos = '["Acepto"]'
      }
      
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`, // También enviar como Authorization
        'Content-Type': 'application/json',
      }
      
      // Log de campos que se van a enviar (para debugging)
      console.log('Campos a enviar a FileMaker:', Object.keys(fieldData))
      
      // Usar axios.request para tener control total sobre la petición
      const response = await axios.request({
        method: 'POST',
        url: url,
        data: {
          fieldData: fieldData,
        },
        headers: headers,
        transformRequest: [(data) => JSON.stringify(data)],
        validateStatus: function (status) {
          return status < 500; // Resolver para cualquier código menor que 500
        }
      })
      
      // Verificar primero si la creación fue exitosa (hay recordId)
      if (response.data?.response?.recordId) {
        const recordId = response.data.response.recordId
        
        // Subir archivos adjuntos si existen
        if (data.archivos && data.archivos.length > 0) {
          try {
            await subirArchivosAdjuntos(recordId, data.archivos, token)
          } catch (archivoError) {
            // No lanzar error si falla la subida de archivos, solo loguear
            console.error('Error al subir archivos adjuntos:', archivoError.message)
          }
        }
        
        // Crear registro en la bitácora después de crear el PQRS
        try {
          await crearRegistroBitacora(recordId, token)
        } catch (bitacoraError) {
          // No lanzar error si falla la bitácora, solo loguear
          console.error('Error al crear registro en bitácora:', bitacoraError.message)
        }
        
        // Ejecutar script de asignación inicial después de crear el PQRS
        try {
          // Ejecutar el script AsignacionInicialTodaPQRS
          // Pasar el recordId como parámetro del script
          await ejecutarScript('AsignacionInicialTodaPQRS', LAYOUT, String(recordId), token)
          console.log('Script AsignacionInicialTodaPQRS ejecutado exitosamente para PQRS:', recordId)
        } catch (scriptError) {
          // No lanzar error si falla el script, solo loguear
          console.error('Error al ejecutar script AsignacionInicialTodaPQRS:', scriptError.message)
        }
        
        return {
          id: recordId,
          recordId: recordId,
          ...fieldData,
        }
      }
      
      // Si no hay recordId, verificar si hay errores
      // Solo lanzar error si el status code es de error o si hay mensajes de error
      if (response.status >= 400 || (response.data?.messages && response.data.messages.length > 0)) {
        const errorMessage = response.data?.messages?.[0]?.message || 'Error al crear el registro'
        const errorCode = response.data?.messages?.[0]?.code
        
        // Si el error es "Field cannot be modified", proporcionar más información
        if (errorCode === '201' || errorMessage.includes('cannot be modified')) {
          console.error('Error al crear PQRS - Campo no modificable:', {
            errorCode,
            errorMessage,
            camposEnviados: Object.keys(fieldData),
            fieldData
          })
          throw new Error('Error al crear el registro: Uno o más campos no pueden ser modificados. Por favor, verifica los campos del formulario.')
        }
        
        throw new Error(errorMessage)
      }
      
      // Si llegamos aquí, no hay recordId pero tampoco hay error explícito
      throw new Error('No se pudo crear el registro')
    } catch (error) {
      if (error.response) {
        if (error.response?.status === 401 || error.response?.status === 952) {
          // Limpiar token para forzar nueva autenticación
          sessionToken = null
          // Lanzar error especial que será manejado por el mecanismo de reintento
          const authError = new Error('Error de autorización - se requiere reconexión')
          authError.isAuthError = true
          authError.status = error.response.status
          throw authError
        }
        
        const errorMessage = error.response?.data?.messages?.[0]?.message || 
                            error.response?.data?.message || 
                            'Error al crear la PQRS'
        throw new Error(errorMessage)
      }

      throw new Error(error.message || 'Error al crear la PQRS')
    }
  },

  // Crear PQRS con mecanismo de reconexión automática
  createPQRSConReintento: async (data, maxReintentos = 2) => {
    let intentos = 0
    
    while (intentos <= maxReintentos) {
      try {
        return await pqrsService.createPQRS(data)
      } catch (error) {
        intentos++
        
        // Si es error de autorización y aún hay reintentos disponibles
        if (error.isAuthError || 
            (error.response && (error.response.status === 401 || error.response.status === 952)) ||
            error.message?.includes('401') || 
            error.message?.includes('952') || 
            error.message?.includes('Sesión expirada') ||
            error.message?.includes('token') ||
            error.message?.includes('autorización')) {
          
          if (intentos <= maxReintentos) {
            // Limpiar el token para forzar una nueva autenticación
            sessionToken = null
            console.log(`Error de autorización detectado. Reintentando creación de PQRS (intento ${intentos}/${maxReintentos})...`)
            // Esperar un momento antes de reintentar (backoff exponencial)
            const delay = Math.min(1000 * Math.pow(2, intentos - 1), 5000)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          } else {
            console.error(`Se agotaron los reintentos (${maxReintentos}) para crear la PQRS`)
            throw new Error('Error de autorización: No se pudo reconectar después de varios intentos. Por favor, intente nuevamente.')
          }
        }
        
        // Si no es error de autorización, lanzar el error original
        throw error
      }
    }
  },

  // Crear PQRS con reintento automático en caso de error de autorización
  createPQRSConReintento: async (data, maxReintentos = 2) => {
    let intentos = 0
    
    while (intentos <= maxReintentos) {
      try {
        return await pqrsService.createPQRS(data)
      } catch (error) {
        intentos++
        
        // Si es error de autorización y aún hay reintentos disponibles
        if (error.message && (
          error.message.includes('401') || 
          error.message.includes('952') || 
          error.message.includes('Sesión expirada') ||
          error.message.includes('token')
        )) {
          if (intentos <= maxReintentos) {
            // Limpiar el token para forzar una nueva autenticación
            sessionToken = null
            console.log(`Reintentando creación de PQRS (intento ${intentos}/${maxReintentos})...`)
            // Esperar un momento antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
        }
        
        // Si no es error de autorización o se agotaron los reintentos, lanzar el error
        throw error
      }
    }
  },

  // Enviar email de confirmación mediante webhook
  enviarEmailPQRS: async (nombreCompleto, email, radicado) => {
    try {
      if (!API_KEY_WEBHOOK_EMAIL) {
        console.warn('API_KEY_WEBHOOK_EMAIL no configurada')
        return { success: false, message: 'API_KEY_WEBHOOK_EMAIL no configurada' }
      }

      if (!WEBHOOK_EMAIL_URL) {
        console.warn('WEBHOOK_EMAIL_URL no configurada')
        return { success: false, message: 'WEBHOOK_EMAIL_URL no configurada' }
      }

      // Asegurar que el radicado sea string
      const radicadoStr = String(radicado || '')

      const body = {
        name: nombreCompleto || '',
        email: email || '',
        radicado: radicadoStr,
        updated: false,
        url: URL_DEPLOY
      }

      console.log('Enviando email webhook:', { url: WEBHOOK_EMAIL_URL, body })

      const response = await axios.post(
        WEBHOOK_EMAIL_URL,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY_WEBHOOK_EMAIL,
          },
        }
      )

      console.log('Email webhook enviado exitosamente:', response.data)
      return { success: true, data: response.data }
    } catch (error) {
      console.error('Error al enviar email webhook:', error.response?.data || error.message)
      // No lanzar error para no interrumpir el flujo de creación de PQRS
      // Solo retornar el error para logging si es necesario
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Error al enviar email' 
      }
    }
  },

  // Subir archivos adjuntos a una PQRS existente (público, usa token de sesión básico)
  subirAdjuntosPQRS: async (pqrsRecordId, archivos) => {
    try {
      const token = await getSessionToken()
      
      if (!token) {
        throw new Error('No se pudo obtener el token de sesión')
      }
      
      return await subirArchivosAdjuntos(pqrsRecordId, archivos, token)
    } catch (error) {
      throw new Error(error.message || 'Error al subir archivos adjuntos')
    }
  },

  // Obtener lista de sedes (público, usa token de sesión básico)
  getSedes: async () => {
    try {
      const token = await getSessionToken()
      
      if (!token) {
        throw new Error('No se pudo obtener el token de sesión')
      }
      
      const layoutSedes = 'Sede'
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutSedes}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutSedes}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.get(
        url,
        {
          params: {
            _limit: 2000,
          },
          headers: headers,
        }
      )
      
      if (response.data?.response?.data) {
        return response.data.response.data.map(record => ({
          id: record.recordId,
          recordId: record.recordId,
          ...record.fieldData,
        }))
      }
      return []
    } catch (error) {
      throw new Error(error.message || 'Error al obtener sedes')
    }
  },
}

// Servicio de autenticación de empleados
export const empleadoService = {
  // Autenticar empleado en FileMaker
  login: async (usuario, password) => {
    try {
      const credentials = btoa(`${usuario}:${password}`)
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/sessions`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/sessions`
      
      const response = await axios.request({
        method: 'POST',
        url: url,
        data: {},
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        transformRequest: [(data) => JSON.stringify(data)],
        validateStatus: function (status) {
          return status < 500
        }
      })
      
      if (response.data?.response?.token) {
        return {
          success: true,
          token: response.data.response.token,
          usuario: usuario
        }
      } else {
        throw new Error('Credenciales inválidas')
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Usuario o contraseña incorrectos')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al autenticar')
    }
  },

  // Obtener todas las PQRS (para gestión de empleados)
  getPQRSPendientes: async (token) => {
    try {
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.get(
        url,
        {
          params: {
            _limit: 2000,
          },
          headers: headers,
        }
      )
      
      if (response.data?.response?.data) {
        // Retornar todas las PQRS (el filtrado se hace en el frontend)
        const todas = response.data.response.data
          .map(record => ({
            id: record.recordId,
            recordId: record.recordId,
            ...record.fieldData,
            modId: record.modId,
          }))
        
        return todas
      }
      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener PQRS')
    }
  },

  // Actualizar PQRS (asignar, cambiar estado, etc.)
  actualizarPQRS: async (recordId, datos, token) => {
    try {
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.patch(
        url,
        {
          fieldData: datos,
        },
        {
          headers: headers,
        }
      )
      
      if (response.data?.response?.modId) {
        return {
          success: true,
          modId: response.data.response.modId,
        }
      }
      throw new Error('No se pudo actualizar la PQRS')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al actualizar la PQRS')
    }
  },

  // Obtener lista de sedes
  getSedes: async (token) => {
    try {
      const layoutSedes = 'Sede'
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutSedes}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutSedes}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.get(
        url,
        {
          params: {
            _limit: 2000,
          },
          headers: headers,
        }
      )
      
      if (response.data?.response?.data) {
        return response.data.response.data.map(record => ({
          id: record.recordId,
          recordId: record.recordId,
          ...record.fieldData,
        }))
      }
      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener sedes')
    }
  },

  // Obtener usuarios por sede desde la tabla Empleados
  getUsuariosPorSede: async (pk_Sede, token) => {
    try {
      const layoutEmpleados = 'Empleado'
      const baseUrl = isDevelopment
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutEmpleados}`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutEmpleados}`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      // Buscar empleados por fk_sede usando el pk_Sede de la sede seleccionada
      const response = await axios.post(
        `${baseUrl}/_find`,
        {
          query: [
            {
              fk_sede: String(pk_Sede),
            },
          ],
        },
        { headers }
      )
      
      if (response.data?.response?.data) {
        const empleados = response.data.response.data.map(record => ({
          id: record.recordId,
          recordId: record.recordId,
          ...record.fieldData,
        }))
        
        return empleados
      }
      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener usuarios por sede')
    }
  },

  // Obtener lista de empleados disponibles para reasignación (mantener para compatibilidad)
  getUsuariosDisponibles: async (token) => {
    try {
      // Buscar en la tabla de empleados
      const layoutEmpleados = 'Empleado' // Ajustar según el nombre real del layout
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutEmpleados}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutEmpleados}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.get(
        url,
        {
          params: {
            _limit: 2000,
          },
          headers: headers,
        }
      )
      
      if (response.data?.response?.data) {
        return response.data.response.data.map(record => ({
          id: record.recordId,
          recordId: record.recordId,
          ...record.fieldData,
        }))
      }
      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener usuarios')
    }
  },

  // Agregar comentario a la bitácora de una PQRS
  agregarComentarioBitacora: async (pqrsRecordId, comentario, token) => {
    try {
      const layoutBitacora = 'tblPQRSBitacora'
      
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const fieldData = {
        fk_PQRS: String(pqrsRecordId),
        Accion: 'Comentario',
        Comentario: comentario || '',
      }
      
      const response = await axios.request({
        method: 'POST',
        url: url,
        data: {
          fieldData: fieldData,
        },
        headers: headers,
        transformRequest: [(data) => JSON.stringify(data)],
        validateStatus: function (status) {
          return status < 500
        }
      })
      
      if (response.data?.response?.recordId) {
        return {
          success: true,
          recordId: response.data.response.recordId,
        }
      }
      
      // Si no hay recordId, verificar si hay errores
      if (response.status >= 400 || (response.data?.messages && response.data.messages.length > 0)) {
        const errorMessage = response.data?.messages?.[0]?.message || 'Error al agregar comentario en bitácora'
        throw new Error(errorMessage)
      }
      
      throw new Error('No se pudo agregar el comentario en bitácora')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al agregar comentario en bitácora')
    }
  },

  // Enviar email de comentario al cliente mediante webhook
  enviarEmailComentario: async (nombreCompleto, email, radicado, comentario) => {
    try {
      if (!API_KEY_WEBHOOK_EMAIL) {
        console.warn('API_KEY_WEBHOOK_EMAIL no configurada')
        return { success: false, message: 'API_KEY_WEBHOOK_EMAIL no configurada' }
      }

      if (!WEBHOOK_EMAIL_URL) {
        console.warn('WEBHOOK_EMAIL_URL no configurada')
        return { success: false, message: 'WEBHOOK_EMAIL_URL no configurada' }
      }

      const radicadoStr = String(radicado || '')

      const body = {
        name: nombreCompleto || '',
        email: email || '',
        radicado: radicadoStr,
        comentario: comentario || '',
        updated: true,
        url: URL_DEPLOY
      }

      const response = await axios.post(
        WEBHOOK_EMAIL_URL,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY_WEBHOOK_EMAIL,
          },
        }
      )

      return { success: true, data: response.data }
    } catch (error) {
      console.error('Error al enviar email webhook:', error.response?.data || error.message)
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Error al enviar email' 
      }
    }
  },

  // Obtener historial de una PQRS desde la tabla tblPQRSBitacora
  getHistorialPQRS: async (recordId, token) => {
    try {
      const layoutBitacora = 'tblPQRSBitacora' // Layout de la tabla de bitácora

      // Endpoint correcto para _find en FileMaker: .../layouts/<layout>/_find
      const baseUrlBitacora = isDevelopment
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}`

      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      // Buscar registros de bitácora por el ID de la PQRS usando el campo fk_PQRS
      const response = await axios.post(
        `${baseUrlBitacora}/_find`,
        {
          query: [
            {
              // Buscar por campo fk_PQRS que relaciona con la PQRS
              fk_PQRS: String(recordId),
            },
          ],
        },
        { headers }
      )

      if (response.data?.response?.data) {
        // Normalizar los registros de historial
        return response.data.response.data.map((record) => {
          const fd = record.fieldData || {}
          
          // Mapear acciones a texto legible
          const mapeoAcciones = {
            'EstadoCambio': 'Cambio de estado',
            'Adjunto': 'Archivo adjunto',
            'Comentario': 'Comentario',
            'CREADA': 'Creada',
          }
          
          const accionOriginal = fd.Accion || 'Cambio'
          const accionMapeada = mapeoAcciones[accionOriginal] || accionOriginal
          
          // Obtener información del adjunto si existe
          let adjuntoInfo = null
          if (accionOriginal === 'Adjunto' && record.recordId) {
            // Extraer nombre del archivo del comentario
            const nombreArchivo = fd.Comentario?.replace('Archivo adjunto: ', '') || `archivo_${record.recordId}`
            
            // Construir URL para descargar desde FileMaker
            // FileMaker requiere el nombre del archivo en la URL
            // Si no tenemos el nombre exacto, intentaremos con el nombre extraído del comentario
            const urlDescarga = isDevelopment
              ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${record.recordId}/containers/Adjuntos/${encodeURIComponent(nombreArchivo)}`
              : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${record.recordId}/containers/Adjuntos/${encodeURIComponent(nombreArchivo)}`
            
            adjuntoInfo = {
              url: urlDescarga,
              nombre: nombreArchivo,
              recordId: record.recordId,
            }
          }
          
          return {
            id: record.recordId,
            recordId: record.recordId,
            // Fecha del movimiento en bitácora (priorizar fecha de creación)
            fecha:
              fd.CreationTimestamp ||
              fd.FechaCreacion ||
              fd.FechaEvento ||
              fd.ModificationTimestamp ||
              null,
            // Acción o movimiento registrado en bitácora (mapeada)
            accion: accionMapeada,
            // Comentario del registro
            comentario: fd.Comentario || null,
            // Información del adjunto (si existe)
            adjunto: adjuntoInfo,
            // Usuario que realizó el cambio
            usuario:
              fd.ModifiedBy ||
              fd.CreatedBy ||
              null,
            detalles: (() => {
              const det = {}
              if (fd.EstadoPQRSanterior) det['Estado anterior'] = fd.EstadoPQRSanterior
              if (fd.EstadoPQRSnuevo) det['Estado nuevo'] = fd.EstadoPQRSnuevo
              if (fd.fk_EmpleadoAutor) det['Empleado autor'] = fd.fk_EmpleadoAutor
              if (fd.fk_EmpleadoAsignadoNuevo) det['Empleado asignado nuevo'] = fd.fk_EmpleadoAsignadoNuevo
              if (fd.fk_SedeAnterior) det['Sede anterior'] = fd.fk_SedeAnterior
              if (fd.fk_SedeNueva) det['Sede nueva'] = fd.fk_SedeNueva
              if (fd.fk_ClaseSolicitudAnterior) det['Clase solicitud anterior'] = fd.fk_ClaseSolicitudAnterior
              if (fd.fk_ClaseSolicitudNuevo) det['Clase solicitud nuevo'] = fd.fk_ClaseSolicitudNuevo
              return det
            })(),
          }
        })
      }

      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener historial de la PQRS')
    }
  },

  // Obtener adjuntos/documentos de una PQRS
  getAdjuntos: async (recordId, token) => {
    try {
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records/${recordId}`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const response = await axios.get(
        url,
        {
          headers: headers,
        }
      )
      
      if (response.data?.response?.data?.[0]) {
        const record = response.data.response.data[0]
        const fieldData = record.fieldData || {}
        const adjuntos = []
        
        // Buscar campos que puedan contener adjuntos
        // FileMaker puede tener campos de contenedor o portales relacionados
        const posiblesCamposAdjuntos = [
          'Adjuntos', 'adjuntos', 'Documentos', 'documentos',
          'Archivos', 'archivos', 'Files', 'files',
          'Attachments', 'attachments'
        ]
        
        // Verificar si hay campos de contenedor con URLs
        posiblesCamposAdjuntos.forEach(campo => {
          if (fieldData[campo]) {
            const valor = fieldData[campo]
            // Si es un string con URL o ruta
            if (typeof valor === 'string' && (valor.includes('http') || valor.includes('/'))) {
              adjuntos.push({
                nombre: campo,
                url: valor,
                tipo: valor.toLowerCase().includes('.pdf') ? 'pdf' : 
                      valor.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)/) ? 'image' : 'file'
              })
            }
            // Si es un array de URLs
            else if (Array.isArray(valor)) {
              valor.forEach((item, index) => {
                if (typeof item === 'string' && (item.includes('http') || item.includes('/'))) {
                  adjuntos.push({
                    nombre: `${campo} ${index + 1}`,
                    url: item,
                    tipo: item.toLowerCase().includes('.pdf') ? 'pdf' : 
                          item.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)/) ? 'image' : 'file'
                  })
                }
              })
            }
          }
        })
        
        // Verificar portales relacionados (si existen)
        if (record.portalData) {
          Object.keys(record.portalData).forEach(portalName => {
            const portalRecords = record.portalData[portalName] || []
            portalRecords.forEach((portalRecord, index) => {
              const portalFieldData = portalRecord.fieldData || {}
              // Buscar campos de archivo en el portal
              Object.keys(portalFieldData).forEach(fieldName => {
                const fieldValue = portalFieldData[fieldName]
                if (typeof fieldValue === 'string' && (fieldValue.includes('http') || fieldValue.includes('/'))) {
                  adjuntos.push({
                    nombre: portalFieldData.Nombre || portalFieldData.nombre || `${portalName} ${index + 1}`,
                    url: fieldValue,
                    tipo: fieldValue.toLowerCase().includes('.pdf') ? 'pdf' : 
                          fieldValue.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)/) ? 'image' : 'file',
                    fecha: portalFieldData.Fecha || portalFieldData.fecha
                  })
                }
              })
            })
          })
        }
        
        return adjuntos
      }
      return []
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 952) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente')
      }
      throw new Error(error.response?.data?.messages?.[0]?.message || 'Error al obtener adjuntos')
    }
  },

  // Descargar adjunto desde FileMaker
  descargarAdjunto: async (bitacoraRecordId, nombreArchivo, token) => {
    try {
      const layoutBitacora = 'tblPQRSBitacora'
      
      // Obtener el registro para obtener la URL del archivo del campo contenedor
      const urlRecord = isDevelopment
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${bitacoraRecordId}`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${layoutBitacora}/records/${bitacoraRecordId}`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      
      const recordResponse = await axios.get(urlRecord, { headers })
      
      const fieldData = recordResponse.data?.response?.data?.[0]?.fieldData || {}
      
      // Primero intentar usar el campo base64 si existe
      if (fieldData.base64 || fieldData.Base64) {
        try {
          const base64Data = fieldData.base64 || fieldData.Base64
          
          // Decodificar el base64 y crear un blob
          // El formato puede ser: "data:mime/type;base64,datos" o solo los datos base64
          let base64String = base64Data
          let mimeType = 'application/octet-stream'
          
          // Si tiene el prefijo data:, extraer el tipo MIME
          if (base64String.startsWith('data:')) {
            const matches = base64String.match(/^data:([^;]+);base64,(.+)$/)
            if (matches) {
              mimeType = matches[1]
              base64String = matches[2]
            } else {
              // Si tiene data: pero no el formato completo, extraer solo los datos
              base64String = base64String.replace(/^data:[^;]*;base64,/, '')
            }
          }
          
          // Convertir base64 a blob
          const byteCharacters = atob(base64String)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: mimeType })
          
          // Crear un enlace temporal para descargar el archivo
          const urlBlob = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = urlBlob
          link.download = nombreArchivo
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(urlBlob)
          
          return { success: true }
        } catch (base64Error) {
          console.warn('Error al procesar base64, intentando con URL:', base64Error.message)
          // Continuar con el método de URL si falla
        }
      }
      
      // Si no hay base64 o falló, usar la URL del campo Adjuntos
      if (!fieldData.Adjuntos && !fieldData.adjuntos) {
        throw new Error('No se encontró el archivo adjunto en el registro')
      }
      
      const adjuntoUrl = fieldData.Adjuntos || fieldData.adjuntos
      
      // FileMaker devuelve una URL de streaming SSL en el campo contenedor
      // Ejemplo: https://localhost:443/Streaming_SSL/MainDB/...pdf?RCType=EmbeddedRCFileProcessor
      // Necesitamos reemplazar el host con el host correcto de FileMaker
      
      let urlDescarga = adjuntoUrl
      
      // Extraer el host de FileMaker desde API_BASE_URL
      // API_BASE_URL es algo como: https://fms-dev.celerix.com/fmi/data/v1/...
      // Necesitamos: https://fms-dev.celerix.com
      let filemakerHost = ''
      if (isDevelopment) {
        // En desarrollo, usar el host del API_BASE_URL o el configurado
        filemakerHost = API_BASE_URL ? API_BASE_URL.replace(/\/fmi.*$/, '') : 'https://fms-dev.celerix.com'
      } else {
        filemakerHost = API_BASE_URL.replace(/\/fmi.*$/, '')
      }
      
      // Asegurar que use HTTPS y puerto 443
      filemakerHost = filemakerHost.replace(/^http:/, 'https:').replace(/:(\d+)?$/, ':443')
      
      // Si la URL contiene localhost o necesita reemplazar el host
      if (typeof adjuntoUrl === 'string') {
        if (adjuntoUrl.startsWith('http')) {
          // URL completa - reemplazar el host si es localhost
          try {
            const urlObj = new URL(adjuntoUrl)
            if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
              // Reemplazar localhost con el host de FileMaker
              urlObj.hostname = new URL(filemakerHost).hostname
              urlObj.port = '443'
              urlObj.protocol = 'https:'
              urlDescarga = urlObj.toString()
            } else {
              // Ya tiene el host correcto, usar tal cual
              urlDescarga = adjuntoUrl
            }
          } catch (e) {
            // Si no se puede parsear, intentar reemplazo simple
            urlDescarga = adjuntoUrl.replace(/https?:\/\/[^\/]+/, filemakerHost)
          }
        } else if (adjuntoUrl.startsWith('/')) {
          // Ruta absoluta - agregar el host de FileMaker
          urlDescarga = `${filemakerHost}${adjuntoUrl}`
        } else {
          // Ruta relativa
          urlDescarga = `${filemakerHost}/${adjuntoUrl}`
        }
      }
      
      console.log('URL de descarga:', urlDescarga)
      
      // Para URLs de streaming SSL de FileMaker, necesitamos autenticación
      // FileMaker puede requerir autenticación básica o token de sesión
      // Intentaremos usar autenticación básica en la URL
      
      // Extraer el host y la ruta de la URL
      const urlObj = new URL(urlDescarga)
      
      // Construir URL con autenticación básica (usuario:contraseña@host)
      // Esto es necesario porque FileMaker streaming requiere autenticación
      const usuario = BASIC_AUTH_USER
      const password = BASIC_AUTH_PASSWORD
      
      if (usuario && password) {
        // Construir URL con autenticación básica
        const urlConAuth = `${urlObj.protocol}//${usuario}:${encodeURIComponent(password)}@${urlObj.host}${urlObj.pathname}${urlObj.search}`
        
        // Crear un enlace temporal y hacer clic en él
        const link = document.createElement('a')
        link.href = urlConAuth
        link.download = nombreArchivo
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        
        // Agregar al DOM, hacer clic y remover
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // Si no hay credenciales, intentar con el token como parámetro
        urlObj.searchParams.append('token', token)
        urlObj.searchParams.append('X-FM-Data-Session-Token', token)
        
        const link = document.createElement('a')
        link.href = urlObj.toString()
        link.download = nombreArchivo
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error al descargar adjunto:', error.response?.data || error.message)
      throw new Error(error.response?.data?.messages?.[0]?.message || error.message || 'Error al descargar el archivo')
    }
  },

  // Subir archivos adjuntos a una PQRS (para empleados)
  subirArchivosAdjuntos: async (pqrsRecordId, archivos, token) => {
    try {
      return await subirArchivosAdjuntos(pqrsRecordId, archivos, token)
    } catch (error) {
      throw new Error(error.message || 'Error al subir archivos adjuntos')
    }
  },
}

export default api

