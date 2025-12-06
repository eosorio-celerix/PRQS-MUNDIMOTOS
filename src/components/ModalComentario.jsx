import { useState } from 'react'
import './ModalComentario.css'

const ModalComentario = ({ 
  isOpen, 
  onClose, 
  onGuardar, 
  titulo = 'Agregar Comentario',
  accionContexto = null // 'reasignar', 'cambiarEstado', o null para comentario simple
}) => {
  const [comentario, setComentario] = useState('')
  const [notificarCliente, setNotificarCliente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [archivos, setArchivos] = useState([])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setArchivos(prev => [...prev, ...files])
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

  const handleGuardar = async () => {
    if (!comentario.trim() && archivos.length === 0) {
      return
    }

    setGuardando(true)
    try {
      await onGuardar(comentario.trim(), notificarCliente, archivos)
      // Limpiar formulario
      setComentario('')
      setNotificarCliente(false)
      setArchivos([])
      onClose()
    } catch (error) {
      console.error('Error al guardar comentario:', error)
      // El error se manejará en el componente padre, no cerrar el modal
    } finally {
      setGuardando(false)
    }
  }

  const handleCancelar = () => {
    setComentario('')
    setNotificarCliente(false)
    setArchivos([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancelar}>
      <div className="modal-comentario-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-comentario-header">
          <h2>{titulo}</h2>
          <button className="modal-close" onClick={handleCancelar}>×</button>
        </div>

        <div className="modal-comentario-body">
          <div className="comentario-form-group">
            <label htmlFor="comentario-textarea">Comentario:</label>
            <textarea
              id="comentario-textarea"
              className="comentario-textarea-modal"
              placeholder="Escribe tu comentario aquí..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={6}
              disabled={guardando}
            />
          </div>

          <div className="comentario-form-group">
            <label className="checkbox-label-modal">
              <input
                type="checkbox"
                checked={notificarCliente}
                onChange={(e) => setNotificarCliente(e.target.checked)}
                disabled={guardando}
              />
              <span>Notificar al cliente por correo</span>
            </label>
          </div>

          <div className="comentario-form-group">
            <label htmlFor="archivos-comentario" className="file-upload-label-modal">
              <span className="file-upload-icon">📎</span>
              Adjuntar archivos
              <input
                id="archivos-comentario"
                type="file"
                multiple
                onChange={handleFileChange}
                className="file-input"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                disabled={guardando}
              />
            </label>
            <p className="file-hint-modal">
              Formatos permitidos: PDF, Word, Excel, Imágenes. Tamaño máximo: 10MB por archivo.
            </p>

            {archivos.length > 0 && (
              <div className="archivos-list-modal">
                {archivos.map((archivo, index) => (
                  <div key={index} className="archivo-item-modal">
                    <span className="archivo-icon">
                      {archivo.type?.includes('pdf') ? '📄' : 
                       archivo.type?.includes('image') ? '🖼️' : 
                       archivo.type?.includes('word') || archivo.type?.includes('document') ? '📝' :
                       archivo.type?.includes('excel') || archivo.type?.includes('spreadsheet') ? '📊' : '📎'}
                    </span>
                    <div className="archivo-info-modal">
                      <span className="archivo-nombre-modal">{archivo.name}</span>
                      <span className="archivo-tamaño-modal">{formatFileSize(archivo.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-file-modal"
                      onClick={() => handleRemoveFile(index)}
                      title="Eliminar archivo"
                      disabled={guardando}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-comentario-footer">
          <button
            className="btn-cancel-modal"
            onClick={handleCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            className="btn-guardar-modal"
            onClick={handleGuardar}
            disabled={(!comentario.trim() && archivos.length === 0) || guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalComentario

