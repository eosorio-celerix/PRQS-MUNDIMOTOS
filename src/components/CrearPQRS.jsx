import { useState } from 'react'
import { pqrsService } from '../services/api'
import './CrearPQRS.css'

const CrearPQRS = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    tipo: 'peticion',
    nombre: '',
    tipoDocumento: 'Cédula ciudadanía',
    numeroDocumento: '',
    email: '',
    telefono: '',
    fechaCompra: '',
    numeroFactura: '',
    areaDirigida: '',
    dondeCompro: '',
    descripcion: '',
    aceptaPolitica: false,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showTipoInfo, setShowTipoInfo] = useState(false)
  const [archivos, setArchivos] = useState([])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Limpiar mensajes al cambiar el formulario
    if (error) setError(null)
  }

  const handleNumberChange = (e) => {
    const { name, value } = e.target
    // Solo permitir números
    if (value === '' || /^\d+$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
      if (error) setError(null)
    }
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setArchivos(prev => [...prev, ...files])
    if (error) setError(null)
  }

  const handleRemoveFile = (index) => {
    setArchivos(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validación de campos obligatorios
    if (!formData.tipo) {
      setError('Por favor seleccione el tipo de solicitud')
      setLoading(false)
      return
    }

    if (!formData.nombre.trim()) {
      setError('Por favor ingrese su nombre completo')
      setLoading(false)
      return
    }

    if (!formData.numeroDocumento.trim()) {
      setError('Por favor ingrese su número de documento')
      setLoading(false)
      return
    }

    if (!formData.email.trim()) {
      setError('Por favor ingrese su correo electrónico')
      setLoading(false)
      return
    }

    if (!formData.telefono.trim()) {
      setError('Por favor ingrese su teléfono de contacto')
      setLoading(false)
      return
    }

    if (!formData.descripcion.trim()) {
      setError('Por favor describa su PQRSF con más detalle')
      setLoading(false)
      return
    }

    if (!formData.aceptaPolitica) {
      setError('Debe aceptar la Política de Tratamiento y Protección de Datos Personales')
      setLoading(false)
      return
    }

    try {
      // Incluir archivos en los datos
      const datosConArchivos = {
        ...formData,
        archivos: archivos,
      }
      
      const response = await pqrsService.createPQRSConReintento(datosConArchivos)
      
      // Si la creación fue exitosa, enviar email mediante webhook
      if (response.recordId || response.id) {
        const radicado = response.recordId || response.id
        const nombreCompleto = formData.nombre || response.Nombre_completo || ''
        const email = formData.email || response.Correo || ''
        
        console.log('PQRS creada exitosamente, enviando email:', { nombreCompleto, email, radicado })
        
        // Llamar al webhook de email (no bloquea el flujo si falla)
        const emailResult = await pqrsService.enviarEmailPQRS(nombreCompleto, email, radicado)
        console.log('Resultado del envío de email:', emailResult)
      } else {
        console.warn('No se pudo obtener recordId de la respuesta:', response)
      }
      
      // Limpiar formulario después de crear exitosamente
      setFormData({
        tipo: 'peticion',
        nombre: '',
        tipoDocumento: 'Cédula ciudadanía',
        numeroDocumento: '',
        email: '',
        telefono: '',
        fechaCompra: '',
        numeroFactura: '',
        areaDirigida: '',
        dondeCompro: '',
        descripcion: '',
        aceptaPolitica: false,
      })
      setArchivos([])
      // Llamar al callback de éxito con el recordId
      if (onSuccess && (response.recordId || response.id)) {
        onSuccess(response.recordId || response.id)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="crear-pqrs">
      <div className="form-header">
        <h2>Crear Nueva PQRSF</h2>
        <p className="subtitle">
          Complete el formulario para crear una nueva Petición, Queja, Reclamo, Sugerencia o Felicitación
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pqrs-form">
        {/* SECCIÓN 1: Tipo de Solicitud */}
        <div className="form-section">
          <div className="section-header">
            <h3>1. Tipo de Solicitud</h3>
            <button
              type="button"
              className="info-toggle"
              onClick={() => setShowTipoInfo(!showTipoInfo)}
              aria-label="Mostrar información sobre tipos de solicitud"
            >
              {showTipoInfo ? 'Ocultar información' : 'Ver información'}
              <span className="toggle-icon">{showTipoInfo ? '▲' : '▼'}</span>
            </button>
          </div>
          
          {showTipoInfo && (
            <div className="info-box">
              <div className="info-item">
                <strong>📋 Petición:</strong> Solicitud de información o consulta sobre un proceso de la compañía.
              </div>
              <div className="info-item">
                <strong>😞 Queja:</strong> Inconformidad sobre un producto adquirido o servicio prestado.
              </div>
              <div className="info-item">
                <strong>⚖️ Reclamo:</strong> Exigencia solicitando una respuesta a la situación dada a conocer.
              </div>
              <div className="info-item">
                <strong>💡 Sugerencia:</strong> Recomendaciones para mejorar nuestros procesos internos.
              </div>
              <div className="info-item">
                <strong>⭐ Felicitación:</strong> Reconocimiento por haberte brindado una experiencia memorable.
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tipo">
              <span className="required">*</span> Seleccione el tipo de solicitud
            </label>
            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="peticion">Petición</option>
              <option value="queja">Queja</option>
              <option value="reclamo">Reclamo</option>
              <option value="sugerencia">Sugerencia</option>
              <option value="felicitacion">Felicitación</option>
            </select>
          </div>
        </div>

        {/* SECCIÓN 2: Información Personal */}
        <div className="form-section">
          <div className="section-header">
            <h3>2. Información Personal</h3>
            <span className="section-subtitle">Datos de contacto y identificación</span>
          </div>

          <div className="form-group">
            <label htmlFor="nombre">
              <span className="required">*</span> Nombre completo
            </label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              placeholder="Ej: Juan Pérez García"
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipoDocumento">
                <span className="required">*</span> Tipo de documento
              </label>
              <select
                id="tipoDocumento"
                name="tipoDocumento"
                value={formData.tipoDocumento}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="Cédula ciudadanía">Cédula ciudadanía</option>
                <option value="Cédula extranjería">Cédula extranjería</option>
                <option value="NIT">NIT</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="numeroDocumento">
                <span className="required">*</span> Número de documento
              </label>
              <input
                type="text"
                id="numeroDocumento"
                name="numeroDocumento"
                value={formData.numeroDocumento}
                onChange={handleNumberChange}
                required
                placeholder="Solo números"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">
                <span className="required">*</span> Correo electrónico
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="correo@ejemplo.com"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="telefono">
                <span className="required">*</span> Teléfono de contacto
              </label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={formData.telefono}
                onChange={handleNumberChange}
                required
                placeholder="Solo números"
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: Información de Compra */}
        <div className="form-section">
          <div className="section-header">
            <h3>3. Información de Compra</h3>
            <span className="section-subtitle">Datos relacionados con tu compra (opcional)</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fechaCompra">
                <span className="optional">(Opcional)</span> Fecha de compra
              </label>
              <input
                type="date"
                id="fechaCompra"
                name="fechaCompra"
                value={formData.fechaCompra}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="numeroFactura">
                <span className="optional">(Opcional)</span> Número de factura
              </label>
              <input
                type="text"
                id="numeroFactura"
                name="numeroFactura"
                value={formData.numeroFactura}
                onChange={handleChange}
                placeholder="Ej: FV8111976"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dondeCompro">
                <span className="optional">(Opcional)</span> ¿Dónde compraste tus productos?
              </label>
              <select
                id="dondeCompro"
                name="dondeCompro"
                value={formData.dondeCompro}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Selecciona una opción</option>
                <option value="tienda_fisica">Tienda física</option>
                <option value="tienda_online">Tienda online</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="areaDirigida">
                <span className="optional">(Opcional)</span> ¿A qué área está dirigida?
              </label>
              <select
                id="areaDirigida"
                name="areaDirigida"
                value={formData.areaDirigida}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Selecciona una opción</option>
                <option value="servicio_cliente">Servicio al cliente</option>
                <option value="garantia">Garantía</option>
                <option value="cambio_devolucion">Cambio o devolución</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: Descripción del Caso */}
        <div className="form-section">
          <div className="section-header">
            <h3>4. Descripción del Caso</h3>
            <span className="section-subtitle">Cuéntanos con detalle sobre tu solicitud</span>
          </div>

          <div className="form-group">
            <label htmlFor="descripcion">
              <span className="required">*</span> Describe tu solicitud con el mayor detalle posible
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              required
              rows="6"
              placeholder="Por favor, proporciona información detallada sobre tu solicitud, incluyendo fechas, nombres de personas involucradas, números de referencia, y cualquier otro detalle relevante que nos ayude a resolver tu caso de manera más eficiente."
              className="form-input"
            />
            <div className="char-counter">
              {formData.descripcion.length} caracteres
            </div>
          </div>
        </div>

        {/* SECCIÓN 5: Archivos Adjuntos (Opcional) */}
        <div className="form-section">
          <div className="section-header">
            <h3>5. Archivos Adjuntos (Opcional)</h3>
            <span className="section-subtitle">Puedes adjuntar documentos relacionados con tu solicitud</span>
          </div>

          <div className="form-group">
            <label htmlFor="archivos" className="file-upload-label">
              <span className="file-upload-icon">📎</span>
              Seleccionar archivos
              <input
                id="archivos"
                type="file"
                multiple
                onChange={handleFileChange}
                className="file-input"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              />
            </label>
            <p className="file-hint">
              Formatos permitidos: PDF, Word, Excel, Imágenes (JPG, PNG, GIF). Tamaño máximo: 10MB por archivo.
            </p>

            {archivos.length > 0 && (
              <div className="archivos-list">
                <h4>Archivos seleccionados ({archivos.length}):</h4>
                {archivos.map((archivo, index) => (
                  <div key={index} className="archivo-item">
                    <span className="archivo-icon">
                      {archivo.type?.includes('pdf') ? '📄' : 
                       archivo.type?.includes('image') ? '🖼️' : 
                       archivo.type?.includes('word') || archivo.type?.includes('document') ? '📝' :
                       archivo.type?.includes('excel') || archivo.type?.includes('spreadsheet') ? '📊' : '📎'}
                    </span>
                    <div className="archivo-info">
                      <span className="archivo-nombre">{archivo.name}</span>
                      <span className="archivo-tamaño">{formatFileSize(archivo.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={() => handleRemoveFile(index)}
                      title="Eliminar archivo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 6: Política de Datos */}
        <div className="form-section">
          <div className="section-header">
            <h3>5. Política de Tratamiento de Datos</h3>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="aceptaPolitica"
                checked={formData.aceptaPolitica}
                onChange={handleChange}
                required
                className="checkbox-input"
              />
              <span className="checkbox-text">
                <span className="required">*</span> Acepto que mis datos personales sean almacenados, procesados, usados, transmitidos, transferidos y actualizados, conforme a la <strong>Política de Tratamiento y Protección de Datos Personales de Mundimotos</strong> y lo dispuesto en la <strong>Ley 1581 de 2012</strong>. Entiendo que tengo derecho a acceder, conocer, actualizar, rectificar mis datos personales, solicitar prueba de mi autorización, revocarla y/o solicitar la supresión del dato.
              </span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Creando...
              </>
            ) : (
              'Crear PQRSF'
            )}
          </button>
          <button
            type="button"
            className="btn-reset"
            onClick={() => {
              setFormData({
                tipo: 'peticion',
                nombre: '',
                tipoDocumento: 'Cédula ciudadanía',
                numeroDocumento: '',
                email: '',
                telefono: '',
                fechaCompra: '',
                numeroFactura: '',
                areaDirigida: '',
                dondeCompro: '',
                descripcion: '',
                aceptaPolitica: false,
              })
              setArchivos([])
              setError(null)
            }}
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  )
}

export default CrearPQRS

