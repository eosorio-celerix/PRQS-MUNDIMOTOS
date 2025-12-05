import axios from 'axios'

// Variables de entorno (Vite requiere el prefijo VITE_)
const API_BASE_URL = import.meta.env.VITE_FM_API_BASE_URL || 'https://fms-dev.celerix.com'
const DATABASE = import.meta.env.VITE_FM_DATABASE || 'PQRS-MM-QA'
const LAYOUT = import.meta.env.VITE_FM_LAYOUT || 'PQRS'

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
})

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
    
    const response = await axios.get(
      url,
      {
        headers: headers,
      }
    )
    
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
        
        const retryResponse = await axios.get(
          retryUrl,
          {
            headers: retryHeaders,
          }
        )
        
        if (retryResponse.data?.response?.data?.[0]) {
          return retryResponse.data.response.data[0]
        }
      }
      
      const errorMessage = error.response?.data?.messages?.[0]?.message || 
                          error.response?.data?.message || 
                          `Error ${error.response.status}: ${error.response.statusText}`
      throw new Error(errorMessage)
    }
    
    throw new Error(error.message || 'Error al consultar el registro')
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
        'servicio_cliente': 'Servicio al cliente',
        'garantia': 'Garantía',
        'cambio_devolucion': 'Cambio o devolución'
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
        
        // Información de compra (opcional)
        Fecha_compra: data.fechaCompra ? formatDate(data.fechaCompra) : '',
        No_factura: data.numeroFactura || '',
        Area_pqrs: data.areaDirigida ? (areaMap[data.areaDirigida] || data.areaDirigida) : '',
        
        // Descripción
        Descripcion_pqrs: data.descripcion || '',
        
        // Política de datos
        Politica_datos: data.aceptaPolitica ? '["Acepto"]' : ''
      }
      
      // Remover campos vacíos opcionales para evitar errores
      Object.keys(fieldData).forEach(key => {
        if (fieldData[key] === '' || fieldData[key] === null || fieldData[key] === undefined) {
          // Solo eliminar si no es un campo requerido
          const requiredFields = ['Solicitud', 'Nombre_completo', 'Tipo_documento', 'Documento', 'Correo', 'Telefono_contacto', 'Descripcion_pqrs', 'Politica_datos']
          if (!requiredFields.includes(key)) {
            delete fieldData[key]
          }
        }
      })
      
      const url = isDevelopment 
        ? `/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
        : `${API_BASE_URL}/fmi/data/v1/databases/${DATABASE}/layouts/${LAYOUT}/records`
      
      const headers = {
        'X-FM-Data-Session-Token': token,
        'Authorization': `Bearer ${token}`, // También enviar como Authorization
        'Content-Type': 'application/json',
      }
      
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

  // Obtener lista de empleados disponibles para reasignación
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
          return {
            id: record.recordId,
            recordId: record.recordId,
            // Fecha del movimiento en bitácora
            fecha:
              fd.ModificationTimestamp ||
              fd.CreationTimestamp ||
              fd.FechaCreacion ||
              fd.FechaEvento ||
              null,
            // Acción o movimiento registrado en bitácora
            accion: 
              fd.Accion || 
              'Cambio',
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
}

export default api

