import { useState, useEffect } from 'react'
import { empleadoService } from '../services/api'
import './ModalReasignar.css'

const ModalReasignar = ({ isOpen, onClose, onReasignar, recordId, token }) => {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedUsuario, setSelectedUsuario] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen && token) {
      cargarUsuarios()
    }
  }, [isOpen, token])

  const cargarUsuarios = async () => {
    setLoading(true)
    setError(null)
    try {
      const listaUsuarios = await empleadoService.getUsuariosDisponibles(token)
      
      // Eliminar duplicados usando un Map basado en recordId
      const usuariosUnicos = new Map()
      listaUsuarios.forEach(usuario => {
        const id = usuario.recordId || usuario.id
        if (id && !usuariosUnicos.has(id)) {
          usuariosUnicos.set(id, usuario)
        }
      })
      
      // Convertir Map a Array y ordenar por nombre
      const usuariosFiltrados = Array.from(usuariosUnicos.values()).sort((a, b) => {
        const nombreA = (a.Nombre || a.nombre || a.Usuario || a.usuario || '').toLowerCase()
        const nombreB = (b.Nombre || b.nombre || b.Usuario || b.usuario || '').toLowerCase()
        return nombreA.localeCompare(nombreB)
      })
      
      setUsuarios(usuariosFiltrados)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReasignar = () => {
    if (selectedUsuario) {
      onReasignar(recordId, selectedUsuario)
      onClose()
    }
  }

  const usuariosFiltrados = usuarios.filter(usuario => {
    const nombre = usuario.Nombre || usuario.nombre || usuario.Usuario || usuario.usuario || ''
    const search = searchTerm.toLowerCase()
    return nombre.toLowerCase().includes(search)
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Reasignar PQRS</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p>Cargando usuarios...</p>
            </div>
          ) : error ? (
            <div className="modal-error">
              <p>{error}</p>
              <button onClick={cargarUsuarios} className="btn-retry">Reintentar</button>
            </div>
          ) : (
            <>
              <div className="modal-search">
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="usuarios-list">
                {usuariosFiltrados.length === 0 ? (
                  <p className="no-results">No se encontraron usuarios</p>
                ) : (
                  usuariosFiltrados.map((usuario) => {
                    const nombre = usuario.Nombre || usuario.nombre || usuario.Usuario || usuario.usuario || 'Sin nombre'
                    const isSelected = selectedUsuario?.recordId === usuario.recordId
                    
                    return (
                      <div
                        key={usuario.recordId}
                        className={`usuario-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedUsuario(usuario)}
                      >
                        <div className="usuario-info">
                          <span className="usuario-nombre">{nombre}</span>
                          {usuario.Email && (
                            <span className="usuario-email">{usuario.Email}</span>
                          )}
                        </div>
                        {isSelected && <span className="check-icon">✓</span>}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-reasignar"
            onClick={handleReasignar}
            disabled={!selectedUsuario || loading}
          >
            Reasignar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalReasignar

