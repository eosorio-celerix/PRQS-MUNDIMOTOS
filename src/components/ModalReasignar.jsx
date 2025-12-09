import { useState, useEffect } from 'react'
import { empleadoService } from '../services/api'
import './ModalReasignar.css'

const ModalReasignar = ({ isOpen, onClose, onReasignar, recordId, token }) => {
  const [sedes, setSedes] = useState([])
  const [selectedSede, setSelectedSede] = useState(null)
  const [sedeSearchTerm, setSedeSearchTerm] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingSedes, setLoadingSedes] = useState(false)
  const [error, setError] = useState(null)
  const [selectedUsuario, setSelectedUsuario] = useState(null)

  useEffect(() => {
    if (isOpen && token) {
      cargarSedes()
      // Resetear estados al abrir
      setSelectedSede(null)
      setSedeSearchTerm('')
      setUsuarios([])
      setSelectedUsuario(null)
    }
  }, [isOpen, token])

  useEffect(() => {
    if (selectedSede && token) {
      cargarUsuariosPorSede()
    } else {
      setUsuarios([])
      setSelectedUsuario(null)
    }
  }, [selectedSede, token])

  const cargarSedes = async () => {
    setLoadingSedes(true)
    setError(null)
    try {
      const listaSedes = await empleadoService.getSedes(token)
      // Ordenar sedes por nombre (usando campo Sede)
      const sedesOrdenadas = listaSedes.sort((a, b) => {
        const nombreA = (a.Sede || a.sede || a.Nombre || a.nombre || '').toLowerCase()
        const nombreB = (b.Sede || b.sede || b.Nombre || b.nombre || '').toLowerCase()
        return nombreA.localeCompare(nombreB)
      })
      
      setSedes(sedesOrdenadas)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSedes(false)
    }
  }

  const cargarUsuariosPorSede = async () => {
    if (!selectedSede) return
    
    setLoading(true)
    setError(null)
    try {
      const listaUsuarios = await empleadoService.getUsuariosPorSede(selectedSede.pk_Sede, token)
      console.log('listaUsuarios', listaUsuarios)
      // Ordenar usuarios por nombre
      const usuariosOrdenados = listaUsuarios.sort((a, b) => {
        const nombreA = (a.Nombre || a.nombre || a.Usuario || a.usuario || '').toLowerCase()
        const nombreB = (b.Nombre || b.nombre || b.Usuario || b.usuario || '').toLowerCase()
        return nombreA.localeCompare(nombreB)
      })
      
      setUsuarios(usuariosOrdenados)
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

  const sedesFiltradas = sedes.filter(sede => {
    const nombreSede = (sede.Sede || sede.sede || sede.Nombre || sede.nombre || '').toLowerCase()
    const search = sedeSearchTerm.toLowerCase()
    return nombreSede.includes(search)
  })

  const handleSedeSelect = (sede) => {
    setSelectedSede(sede)
    setSedeSearchTerm(sede.Sede || sede.sede || sede.Nombre || sede.nombre || '')
    setSelectedUsuario(null)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Reasignar PQRS</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Selector de Sede */}
          <div className="sede-selector">
            <label htmlFor="sede-search">Seleccionar Sede:</label>
            <div className="sede-autocomplete">
              <input
                id="sede-search"
                type="text"
                placeholder="Buscar sede..."
                value={sedeSearchTerm}
                onChange={(e) => {
                  setSedeSearchTerm(e.target.value)
                  if (selectedSede) {
                    setSelectedSede(null)
                    setUsuarios([])
                    setSelectedUsuario(null)
                  }
                }}
                className="search-input"
                disabled={loadingSedes}
              />
              {sedeSearchTerm && !selectedSede && sedesFiltradas.length > 0 && (
                <div className="autocomplete-dropdown">
                  {sedesFiltradas.map((sede) => (
                    <div
                      key={sede.recordId || sede.id}
                      className="autocomplete-item"
                      onClick={() => handleSedeSelect(sede)}
                    >
                      {sede.Sede || sede.sede || sede.Nombre || sede.nombre || 'Sin nombre'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedSede && (
              <div className="selected-sede">
                <span>Sede seleccionada: <strong>{selectedSede.Sede || selectedSede.sede || selectedSede.Nombre || selectedSede.nombre}</strong></span>
                <button 
                  className="btn-clear-sede" 
                  onClick={() => {
                    setSelectedSede(null)
                    setSedeSearchTerm('')
                    setUsuarios([])
                    setSelectedUsuario(null)
                  }}
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Lista de Usuarios */}
          {loadingSedes ? (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p>Cargando sedes...</p>
            </div>
          ) : !selectedSede ? (
            <div className="modal-message">
              <p>Por favor, seleccione una sede para ver los usuarios disponibles</p>
            </div>
          ) : loading ? (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p>Cargando usuarios...</p>
            </div>
          ) : error ? (
            <div className="modal-error">
              <p>{error}</p>
              <button onClick={cargarUsuariosPorSede} className="btn-retry">Reintentar</button>
            </div>
          ) : (
            <>
              <div className="usuarios-list">
                {usuarios.length === 0 ? (
                  <p className="no-results">No se encontraron usuarios para esta sede</p>
                ) : (
                  usuarios.map((usuario) => {
                    const nombre = usuario.Nombre || usuario.nombre || usuario.Usuario || usuario.usuario || 'Sin nombre'
                    const claseNombre = usuario.claseEmpleado?.nombre || usuario.ClaseEmpleado || usuario.claseEmpleado || ''
                    // Obtener el área asociada - puede estar en diferentes campos
                    const area = usuario.Area || usuario.area || usuario.Area_pqrs || usuario.area_pqrs || 
                                usuario.ClaseSolicitud || usuario.claseSolicitud || 
                                usuario.fk_ClaseSolicitud || usuario.Fk_ClaseSolicitud || ''
                    const isSelected = selectedUsuario?.recordId === usuario.recordId
                    
                    return (
                      <div
                        key={usuario.recordId}
                        className={`usuario-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedUsuario(usuario)}
                      >
                        <div className="usuario-info">
                          <span className="usuario-nombre">{nombre}</span>
                          {claseNombre && (
                            <span className="usuario-clase">{claseNombre}</span>
                          )}
                          {area && (
                            <span className="usuario-area">Área: {area}</span>
                          )}
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

