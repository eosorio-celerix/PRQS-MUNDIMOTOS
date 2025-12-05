import { useState, useCallback } from 'react'
import { pqrsService } from '../services/api'
import './ConsultarPQRS.css'

const ConsultarPQRS = ({ successMessage, createdRecordId, onClearSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchId, setSearchId] = useState('')
  const [searchResult, setSearchResult] = useState(null)

  const handleSearchById = useCallback(async (idToSearch = null) => {
    const searchValue = idToSearch || searchId
    if (!searchValue.trim()) {
      setError('Por favor ingrese el número de radicado para buscar')
      return
    }

    setLoading(true)
    setError(null)
    setSearchResult(null)

    try {
      const data = await pqrsService.getPQRSById(searchValue)
      setSearchResult(data)
    } catch (err) {
      setError(err.message)
      setSearchResult(null)
    } finally {
      setLoading(false)
    }
  }, [searchId])

  const handleCalificarServicio = () => {
    // Redirigir a la URL de calificación
    window.open('https://forms.office.com/pages/responsepage.aspx?id=Byj7LZibDEy_hkyx7rBjYFZd1caLSu5IpE0W8kaPYn5URFpBS1ZSTE1CMTJISUFXSldETFpVTVRDVC4u&route=shorturl', '_blank')
  }

  // Mapear estados para mostrar al cliente
  const mapearEstadoCliente = (estado) => {
    if (!estado) return estado
    
    const estadoLower = estado.toLowerCase().trim()
    
    // Si es "pendiente" o "en proceso", mostrar "en gestion"
    if (estadoLower === 'pendiente' || estadoLower === 'en proceso') {
      return 'en gestion'
    }
    
    // Si es "cerrada" o "expirada", mostrar "cerrada"
    if (estadoLower === 'cerrada' || estadoLower === 'expirada') {
      return 'cerrada'
    }
    
    // Para cualquier otro estado, mantener el original
    return estado
  }

  return (
    <div className="consultar-pqrs">
      <div className="section-header">
        <h2>Consultar PQRS</h2>
        <button 
          className="btn-calificar"
          onClick={handleCalificarServicio}
        >
          ⭐ Calificar Servicio
        </button>
      </div>

      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por número de radicado..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchById()}
            className="search-input"
          />
          <button 
            onClick={() => handleSearchById()}
            className="btn-search"
            disabled={loading}
          >
            🔍 Buscar
          </button>
        </div>
        <p className="search-hint">
          Ingresa el número de radicado para consultar el estado de tu PQRS
        </p>
      </div>

      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <div>
            <strong>{successMessage}</strong>
            {createdRecordId && (
              <span> Tu número de radicado es: <strong>{createdRecordId}</strong></span>
            )}
          </div>
          {onClearSuccess && (
            <button 
              onClick={onClearSuccess}
              className="alert-close"
              aria-label="Cerrar mensaje"
            >
              ×
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      )}

      {searchResult && (
        <div className="pqrs-detail">
          <h3>Resultado de la búsqueda - Radicado #{searchResult.recordId || searchResult.RecordID || searchResult.id || searchId}</h3>
          <div className="pqrs-card-detail">
            <div className="pqrs-detail-header">
              <div className="detail-item">
                <strong>Radicado:</strong> {searchResult.recordId || searchResult.RecordID || searchResult.id || 'N/A'}
              </div>
              <div className="detail-item">
                <strong>Tipo:</strong> 
                <span className={`pqrs-type ${(searchResult.Solicitud || searchResult.tipo || 'general')?.toLowerCase()?.replace(/\s+/g, '_') || 'general'}`}>
                  {searchResult.Solicitud || searchResult.tipo || 'General'}
                </span>
              </div>
              {searchResult.Estado && (
                <div className="detail-item">
                  <strong>Estado:</strong>
                  <span className={`pqrs-estado ${mapearEstadoCliente(searchResult.Estado).toLowerCase().replace(/\s+/g, '-')}`}>
                    {mapearEstadoCliente(searchResult.Estado)}
                  </span>
                </div>
              )}
            </div>
            <div className="pqrs-detail-body">
              <div className="detail-section">
                <h4>Información del Solicitante</h4>
                <div className="detail-grid">
                  <div className="detail-field">
                    <strong>Nombre:</strong> {searchResult.Nombre_completo || searchResult.nombre || 'N/A'}
                  </div>
                  <div className="detail-field">
                    <strong>Documento:</strong> {searchResult.Documento || searchResult.documento || 'N/A'}
                  </div>
                  <div className="detail-field">
                    <strong>Email:</strong> {searchResult.Correo || searchResult.email || 'N/A'}
                  </div>
                  <div className="detail-field">
                    <strong>Teléfono:</strong> {searchResult.Telefono_contacto || searchResult.telefono || 'N/A'}
                  </div>
                </div>
              </div>
              
              {searchResult.Descripcion_pqrs && (
                <div className="detail-section">
                  <h4>Descripción</h4>
                  <p className="detail-description">{searchResult.Descripcion_pqrs || searchResult.descripcion}</p>
                </div>
              )}
              
              <div className="detail-section">
                <h4>Información Adicional</h4>
                <div className="detail-grid">
                  {searchResult.Area_pqrs && (
                    <div className="detail-field">
                      <strong>Área:</strong> {searchResult.Area_pqrs}
                    </div>
                  )}
                  {searchResult.No_factura && (
                    <div className="detail-field">
                      <strong>No. Factura:</strong> {searchResult.No_factura}
                    </div>
                  )}
                  {searchResult.Fecha_creacion && (
                    <div className="detail-field">
                      <strong>Fecha de creación:</strong> {searchResult.Fecha_creacion}
                    </div>
                  )}
                  {searchResult.Fecha_asignacion && (
                    <div className="detail-field">
                      <strong>Fecha de asignación:</strong> {searchResult.Fecha_asignacion}
                    </div>
                  )}
                  {searchResult.Sede && (
                    <div className="detail-field">
                      <strong>Sede:</strong> {searchResult.Sede}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !searchResult && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>Consulta tu PQRS por Radicado</h3>
          <p>Ingresa el número de radicado en el campo de búsqueda para consultar el estado de tu solicitud</p>
        </div>
      )}
    </div>
  )
}

export default ConsultarPQRS

