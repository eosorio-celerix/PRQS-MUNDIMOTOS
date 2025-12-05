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

  const handleGuardar = async () => {
    if (!comentario.trim()) {
      return
    }

    setGuardando(true)
    try {
      await onGuardar(comentario.trim(), notificarCliente)
      // Limpiar formulario
      setComentario('')
      setNotificarCliente(false)
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
            disabled={!comentario.trim() || guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalComentario

