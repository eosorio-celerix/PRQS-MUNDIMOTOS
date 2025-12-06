import { useState, useEffect } from 'react'
import { empleadoService, pqrsService } from '../services/api'
import ModalReasignar from './ModalReasignar'
import ModalComentario from './ModalComentario'
import './GestionPQRS.css'

const GestionPQRS = ({ empleadoInfo, onLogout }) => {
  const [pqrsList, setPqrsList] = useState([])
  const [allPQRS, setAllPQRS] = useState([]) // Todas las PQRS sin filtrar
  const [selectedPQRS, setSelectedPQRS] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [actualizando, setActualizando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('Todos') // Filtro por estado
  const [activeTab, setActiveTab] = useState('detalle') // Pestaña activa: 'detalle', 'historial' o 'adjuntos'
  const [adjuntos, setAdjuntos] = useState([])
  const [loadingAdjuntos, setLoadingAdjuntos] = useState(false)
  const [historialPQRS, setHistorialPQRS] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [showModalReasignar, setShowModalReasignar] = useState(false)
  const [showModalComentario, setShowModalComentario] = useState(false)
  const [modalComentarioContexto, setModalComentarioContexto] = useState(null) // 'reasignar', 'cambiarEstado', o null
  const [modalComentarioTitulo, setModalComentarioTitulo] = useState('Agregar Comentario')
  const [estadoPendiente, setEstadoPendiente] = useState(null) // Para guardar el estado cuando se abre el modal
  const [usuarioPendiente, setUsuarioPendiente] = useState(null) // Para guardar el usuario cuando se reasigna
  const [ordenFecha, setOrdenFecha] = useState('reciente') // 'reciente' o 'antiguo'

  const token = localStorage.getItem('empleado_token')

  // Cargar PQRS pendientes al montar el componente
  useEffect(() => {
    cargarPQRS()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Aplicar filtro cuando cambie allPQRS, filtroEstado o ordenFecha
  useEffect(() => {
    if (allPQRS.length > 0) {
      aplicarFiltro(filtroEstado, allPQRS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, allPQRS, ordenFecha])

  const cargarPQRS = async () => {
    if (!token) {
      onLogout()
      return
    }

    setLoading(true)
    setError(null)
    try {
      const todas = await empleadoService.getPQRSPendientes(token)
      setAllPQRS(todas)
    } catch (err) {
      setError(err.message)
      if (err.message.includes('Sesión expirada')) {
        onLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  // Calcular totales por estado
  const calcularTotales = () => {
    const totales = {
      Todos: allPQRS.length,
      Pendiente: 0,
      'En Proceso': 0,
      Resuelta: 0,
      Cerrada: 0,
      'Sin asignar': 0
    }

    allPQRS.forEach(pqrs => {
      const estado = pqrs.Estado || pqrs.estado || ''
      if (estado === 'Pendiente') totales.Pendiente++
      else if (estado === 'En Proceso') totales['En Proceso']++
      else if (estado === 'Resuelta') totales.Resuelta++
      else if (estado === 'Cerrada') totales.Cerrada++
      
      if (!pqrs.Asignado_a && !pqrs.asignado_a) {
        totales['Sin asignar']++
      }
    })

    return totales
  }

  // Formatear total: agregar "+" si es >= 500
  const formatearTotal = (total) => {
    return total >= 500 ? `+${total}` : total.toString()
  }

  // Obtener mensaje cuando no hay registros según el filtro
  const obtenerMensajeVacio = () => {
    const mensajes = {
      'Todos': 'No hay PQRS registradas',
      'Pendiente': 'No hay PQRS pendientes',
      'En Proceso': 'No hay PQRS en proceso',
      'Resuelta': 'No hay PQRS resueltas',
      'Cerrada': 'No hay PQRS cerradas',
      'Sin asignar': 'No hay PQRS sin asignar'
    }
    return mensajes[filtroEstado] || 'No hay PQRS para mostrar'
  }

  // Ordenar lista por fecha
  const ordenarPorFecha = (lista, orden) => {
    const listaOrdenada = [...lista]
    
    listaOrdenada.sort((a, b) => {
      // Obtener fechas (pueden estar en diferentes formatos)
      const fechaA = a.Fecha_creacion || a.fecha_creacion || a.Fecha || a.fecha || ''
      const fechaB = b.Fecha_creacion || b.fecha_creacion || b.Fecha || b.fecha || ''
      
      // Convertir a objetos Date para comparar
      const dateA = fechaA ? new Date(fechaA) : new Date(0)
      const dateB = fechaB ? new Date(fechaB) : new Date(0)
      
      if (orden === 'reciente') {
        // Más reciente primero (fecha más reciente = mayor)
        return dateB - dateA
      } else {
        // Más antiguo primero (fecha más antigua = menor)
        return dateA - dateB
      }
    })
    
    return listaOrdenada
  }

  // Aplicar filtro por estado y ordenar por fecha
  const aplicarFiltro = (estado, lista = allPQRS) => {
    let filtradas = lista

    if (estado !== 'Todos') {
      if (estado === 'Sin asignar') {
        filtradas = lista.filter(pqrs => !pqrs.Asignado_a && !pqrs.asignado_a)
      } else {
        filtradas = lista.filter(pqrs => {
          const pqrsEstado = pqrs.Estado || pqrs.estado || ''
          return pqrsEstado === estado
        })
      }
    }

    // Ordenar por fecha
    filtradas = ordenarPorFecha(filtradas, ordenFecha)

    setPqrsList(filtradas)
  }

  const handleFiltroChange = (estado) => {
    setFiltroEstado(estado)
    aplicarFiltro(estado, allPQRS)
  }

  const handleOrdenarFecha = (orden) => {
    setOrdenFecha(orden)
    aplicarFiltro(filtroEstado, allPQRS)
  }

  const handleSelectPQRS = async (pqrs) => {
    // No limpiar selectedPQRS para mantener la altura del contenedor
    setLoadingDetail(true)
    try {
      const detalle = await pqrsService.getPQRSById(pqrs.recordId || pqrs.id)
      setSelectedPQRS(detalle)

      const id = pqrs.recordId || pqrs.id

      // Cargar datos asociados según el tab activo
      if (activeTab === 'adjuntos') {
        await cargarAdjuntos(id)
      } else if (activeTab === 'historial') {
        await cargarHistorial(id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  const cargarAdjuntos = async (recordId) => {
    if (!token || !recordId) return
    
    setLoadingAdjuntos(true)
    try {
      // Obtener todo el historial y filtrar solo los adjuntos
      const historial = await empleadoService.getHistorialPQRS(recordId, token)
      // Filtrar solo los registros que tienen adjuntos
      const adjuntosData = historial
        .filter(item => item.adjunto)
        .map(item => ({
          id: item.id,
          recordId: item.recordId,
          nombre: item.adjunto.nombre,
          fecha: item.fecha,
          usuario: item.usuario,
          comentario: item.comentario,
          adjunto: item.adjunto,
        }))
      setAdjuntos(adjuntosData)
    } catch (err) {
      setError(err.message)
      setAdjuntos([])
    } finally {
      setLoadingAdjuntos(false)
    }
  }

  const cargarHistorial = async (recordId) => {
    if (!token || !recordId) return

    setLoadingHistorial(true)
    try {
      const historial = await empleadoService.getHistorialPQRS(recordId, token)
      // Filtrar solo los comentarios (excluir adjuntos)
      const comentarios = historial.filter(item => !item.adjunto)
      setHistorialPQRS(comentarios)
    } catch (err) {
      setError(err.message)
      setHistorialPQRS([])
    } finally {
      setLoadingHistorial(false)
    }
  }

  const handleTabChange = async (tab) => {
    setActiveTab(tab)
    if (!selectedPQRS) return

    const id = selectedPQRS.recordId || selectedPQRS.id
    if (tab === 'adjuntos') {
      await cargarAdjuntos(id)
    } else if (tab === 'historial') {
      await cargarHistorial(id)
    }
  }

  const handleActualizarEstado = (nuevoEstado) => {
    if (!selectedPQRS || !token) return
    
    // Guardar el estado y abrir modal de comentario
    setEstadoPendiente(nuevoEstado)
    setModalComentarioContexto('cambiarEstado')
    setModalComentarioTitulo(`Cambiar Estado a "${nuevoEstado}"`)
    setShowModalComentario(true)
  }

  const handleReasignar = (recordId, usuario) => {
    if (!token) return
    
    // Guardar el usuario y abrir modal de comentario
    setUsuarioPendiente({ recordId, usuario })
    setModalComentarioContexto('reasignar')
    setModalComentarioTitulo('Reasignar PQRS')
    setShowModalReasignar(false)
    setShowModalComentario(true)
  }

  // Ordenar historial para mostrar (más reciente primero)
  const ordenarHistorialUI = (historial = []) => {
    return [...historial].sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha) : new Date(0)
      const fechaB = b.fecha ? new Date(b.fecha) : new Date(0)
      return fechaB - fechaA
    })
  }

  // Calcular días restantes para cumplir con el plazo de 15 días
  const calcularDiasRestantes = (fechaCreacion) => {
    if (!fechaCreacion) return null

    try {
      // Intentar parsear la fecha en diferentes formatos
      let fecha = null
      
      // Si es string, intentar parsearlo
      if (typeof fechaCreacion === 'string') {
        // Formato MM/DD/YYYY
        if (fechaCreacion.includes('/')) {
          const [mes, dia, año] = fechaCreacion.split('/')
          fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia))
        } else {
          // Intentar parsear como ISO
          fecha = new Date(fechaCreacion)
        }
      } else {
        fecha = new Date(fechaCreacion)
      }

      if (isNaN(fecha.getTime())) return null

      // Fecha límite: 15 días después de la creación
      const fechaLimite = new Date(fecha)
      fechaLimite.setDate(fechaLimite.getDate() + 15)

      // Fecha actual
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      fechaLimite.setHours(0, 0, 0, 0)

      // Calcular diferencia en días
      const diferenciaMs = fechaLimite - hoy
      const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24))

      return diasRestantes
    } catch (error) {
      console.error('Error al calcular días restantes:', error)
      return null
    }
  }

  // Obtener clase CSS según días restantes
  const obtenerClaseDiasRestantes = (diasRestantes) => {
    if (diasRestantes === null) return 'dias-restantes-unknown'
    if (diasRestantes < 0) return 'dias-restantes-expirado'
    if (diasRestantes <= 3) return 'dias-restantes-critico'
    if (diasRestantes <= 7) return 'dias-restantes-advertencia'
    return 'dias-restantes-normal'
  }

  const handleGuardarComentario = async (comentario, notificarCliente) => {
    if (!selectedPQRS || !token) return

    setActualizando(true)
    setError(null)

    try {
      const recordId = selectedPQRS.recordId || selectedPQRS.id

      // Si hay contexto, realizar la acción primero
      if (modalComentarioContexto === 'cambiarEstado' && estadoPendiente) {
        // Cambiar estado
        await empleadoService.actualizarPQRS(
          recordId,
          { Estado: estadoPendiente },
          token
        )
      } else if (modalComentarioContexto === 'reasignar' && usuarioPendiente) {
        // Reasignar
        const usuario = usuarioPendiente.usuario
        await empleadoService.actualizarPQRS(
          usuarioPendiente.recordId,
          { 
            Asignado_a: usuario.Nombre || usuario.nombre || usuario.Usuario || usuario.usuario,
            Usuario_asignado: usuario.recordId || usuario.id
          },
          token
        )
      }

      // Agregar comentario a la bitácora
      await empleadoService.agregarComentarioBitacora(recordId, comentario, token)

      // Si está marcado para notificar al cliente, enviar email
      if (notificarCliente) {
        const nombreCompleto = selectedPQRS.Nombre_completo || selectedPQRS.nombre || ''
        const email = selectedPQRS.Correo || selectedPQRS.email || ''
        const radicado = recordId

        await empleadoService.enviarEmailComentario(nombreCompleto, email, radicado, comentario)
      }

      // Recargar lista completa y aplicar filtro
      const todas = await empleadoService.getPQRSPendientes(token)
      setAllPQRS(todas)
      aplicarFiltro(filtroEstado, todas)

      // Actualizar detalle
      const detalle = await pqrsService.getPQRSById(recordId)
      setSelectedPQRS(detalle)

      // Recargar historial si estamos en esa pestaña
      if (activeTab === 'historial') {
        await cargarHistorial(recordId)
      }

      // Guardar contexto antes de limpiar para el mensaje
      const contexto = modalComentarioContexto

      // Limpiar estados
      setEstadoPendiente(null)
      setUsuarioPendiente(null)
      setModalComentarioContexto(null)

      // Mostrar mensaje de éxito
      const mensaje = contexto 
        ? 'Acción realizada y comentario agregado exitosamente' + (notificarCliente ? ' y notificación enviada al cliente' : '')
        : 'Comentario agregado exitosamente' + (notificarCliente ? ' y notificación enviada al cliente' : '')
      setSuccessMessage(mensaje)
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      setError(err.message)
      if (err.message.includes('Sesión expirada')) {
        onLogout()
      }
      throw err
    } finally {
      setActualizando(false)
    }
  }

  const handleAbrirModalComentario = () => {
    if (!selectedPQRS) {
      alert('Por favor, seleccione una PQRS primero')
      return
    }
    setModalComentarioContexto(null)
    setModalComentarioTitulo('Agregar Comentario')
    setShowModalComentario(true)
  }

  const handleAsignar = async (usuario) => {
    if (!selectedPQRS || !token) return

    setActualizando(true)
    try {
      await empleadoService.actualizarPQRS(
        selectedPQRS.recordId || selectedPQRS.id,
        { Asignado_a: usuario },
        token
      )
      // Recargar lista completa y aplicar filtro
      const todas = await empleadoService.getPQRSPendientes(token)
      setAllPQRS(todas)
      aplicarFiltro(filtroEstado, todas)
      
      // Actualizar detalle
      if (selectedPQRS) {
        const detalle = await pqrsService.getPQRSById(selectedPQRS.recordId || selectedPQRS.id)
        setSelectedPQRS(detalle)
      }
    } catch (err) {
      setError(err.message)
      if (err.message.includes('Sesión expirada')) {
        onLogout()
      }
    } finally {
      setActualizando(false)
    }
  }

  return (
    <div className="gestion-pqrs">
      <div className="gestion-header">
        <div className="header-info">
          <h2>Gestión de PQRS</h2>
          <p>Bienvenido, {empleadoInfo?.usuario || 'Empleado'}</p>
        </div>
        <button onClick={onLogout} className="btn-logout">
          Cerrar Sesión
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="alert-close"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <span>{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="alert-close"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      <div className="gestion-content">
        {/* Listado de PQRS pendientes - Lado izquierdo */}
        <div className="pqrs-list-container">
          <div className="list-header">
            <h3>Lista de PQRS</h3>
          </div>

          {/* Botones de ordenamiento y actualizar */}
          <div className="list-actions">
            <div className="orden-buttons">
              <button
                onClick={() => handleOrdenarFecha('antiguo')}
                className={`btn-orden ${ordenFecha === 'antiguo' ? 'active' : ''}`}
                disabled={loading}
                title="Más antiguo primero"
              >
                ⬆️
              </button>
              <button
                onClick={() => handleOrdenarFecha('reciente')}
                className={`btn-orden ${ordenFecha === 'reciente' ? 'active' : ''}`}
                disabled={loading}
                title="Más reciente primero"
              >
                ⬇️
              </button>
            </div>
            <button onClick={cargarPQRS} className="btn-refresh" disabled={loading} title="Actualizar lista">
              🔄
            </button>
          </div>

          {/* Filtros por estado con totales */}
          <div className="filtros-estado">
            {Object.entries(calcularTotales()).map(([estado, total]) => (
              <button
                key={estado}
                className={`filtro-btn ${filtroEstado === estado ? 'active' : ''}`}
                onClick={() => handleFiltroChange(estado)}
                disabled={loading}
                title={estado}
              >
                <span className="filtro-label">{estado}</span>
                <span className="filtro-total">{formatearTotal(total)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Cargando...</p>
            </div>
          ) : pqrsList.length === 0 ? (
            <div className="empty-state">
              <p>{obtenerMensajeVacio()}</p>
            </div>
          ) : (
            <div className="pqrs-list">
              {pqrsList.map((pqrs) => (
                <div
                  key={pqrs.recordId || pqrs.id}
                  className={`pqrs-item ${selectedPQRS?.recordId === pqrs.recordId ? 'active' : ''}`}
                  onClick={() => handleSelectPQRS(pqrs)}
                >
                  <div className="pqrs-item-header">
                    <span className="pqrs-id">#{pqrs.recordId || pqrs.id}</span>
                    <span className={`pqrs-type ${(pqrs.Solicitud || pqrs.tipo || 'general')?.toLowerCase()?.replace(/\s+/g, '_') || 'general'}`}>
                      {pqrs.Solicitud || pqrs.tipo || 'General'}
                    </span>
                  </div>
                  <div className="pqrs-item-body">
                    <p className="pqrs-nombre">{pqrs.Nombre_completo || pqrs.nombre || 'N/A'}</p>
                    <p className="pqrs-descripcion">
                      {(pqrs.Descripcion_pqrs || pqrs.descripcion || '').substring(0, 100)}
                      {(pqrs.Descripcion_pqrs || pqrs.descripcion || '').length > 100 ? '...' : ''}
                    </p>
                    <div className="pqrs-item-footer">
                      {(pqrs.Fecha_creacion || pqrs.CreationTimestamp) && (
                        <p className="pqrs-fecha">📅 {pqrs.Fecha_creacion || pqrs.CreationTimestamp}</p>
                      )}
                      {(() => {
                        // No mostrar días restantes si el estado es "cerrada"
                        const estado = (pqrs.Estado || pqrs.estado || '').toLowerCase()
                        if (estado === 'cerrada') return null
                        
                        const fechaCreacion = pqrs.Fecha_creacion || pqrs.CreationTimestamp || pqrs.fechaCreacion
                        const diasRestantes = calcularDiasRestantes(fechaCreacion)
                        if (diasRestantes === null) return null
                        
                        const claseDias = obtenerClaseDiasRestantes(diasRestantes)
                        const texto = diasRestantes < 0 
                          ? `⚠️ Expirado hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''}`
                          : diasRestantes === 0
                          ? '⚠️ Expira hoy'
                          : `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`
                        
                        return (
                          <span className={`dias-restantes ${claseDias}`}>
                            {texto}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle de PQRS - Centro con Pestañas */}
        <div className="pqrs-detail-container">
          {loadingDetail ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Cargando detalle...</p>
            </div>
          ) : selectedPQRS ? (
            <div className="pqrs-detail">
              <div className="detail-header">
                <h3>Detalle de PQRS #{selectedPQRS.recordId || selectedPQRS.id}</h3>
                <div className="detail-actions">
                  <button
                    className="btn-reasignar-header"
                    onClick={() => setShowModalReasignar(true)}
                    disabled={actualizando}
                  >
                    Reasignar
                  </button>
                  <select
                    value={selectedPQRS.Estado || selectedPQRS.estado || ''}
                    onChange={(e) => handleActualizarEstado(e.target.value)}
                    className="select-estado"
                    disabled={actualizando}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Resuelta">Resuelta</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                </div>
              </div>

              {/* Pestañas */}
              <div className="detail-tabs">
                <button
                  className={`tab-button ${activeTab === 'detalle' ? 'active' : ''}`}
                  onClick={() => handleTabChange('detalle')}
                >
                  Detalle
                </button>
                <button
                  className={`tab-button ${activeTab === 'historial' ? 'active' : ''}`}
                  onClick={() => handleTabChange('historial')}
                >
                  Historial
                </button>
                <button
                  className={`tab-button ${activeTab === 'adjuntos' ? 'active' : ''}`}
                  onClick={() => handleTabChange('adjuntos')}
                >
                  Adjuntos
                </button>
              </div>

              {/* Contenido de las pestañas */}
              <div className="tab-content">
                {activeTab === 'adjuntos' ? (
                  <div className="adjuntos-content">
                    {loadingAdjuntos ? (
                      <div className="loading">
                        <div className="spinner"></div>
                        <p>Cargando adjuntos...</p>
                      </div>
                    ) : adjuntos.length === 0 ? (
                      <div className="empty-adjuntos">
                        <div className="empty-adjuntos-icon">📎</div>
                        <p>No hay documentos adjuntos para esta PQRS</p>
                      </div>
                    ) : (
                      <div className="adjuntos-list">
                        {adjuntos.map((adjunto, index) => (
                          <div key={adjunto.id || index} className="adjunto-item">
                            <div className="adjunto-icon">
                              📎
                            </div>
                            <div className="adjunto-info">
                              <h4>{adjunto.nombre || `Documento ${index + 1}`}</h4>
                              {adjunto.fecha && (
                                <p className="adjunto-fecha">📅 {adjunto.fecha}</p>
                              )}
                              {adjunto.usuario && (
                                <p className="adjunto-usuario">👤 {adjunto.usuario}</p>
                              )}
                              {adjunto.comentario && (
                                <p className="adjunto-comentario">{adjunto.comentario}</p>
                              )}
                            </div>
                            <div className="adjunto-actions">
                              {adjunto.adjunto && (
                                <button
                                  className="btn-descargar-adjunto"
                                  onClick={async () => {
                                    try {
                                      await empleadoService.descargarAdjunto(
                                        adjunto.adjunto.recordId,
                                        adjunto.adjunto.nombre,
                                        token
                                      )
                                    } catch (error) {
                                      setError(error.message || 'Error al descargar el archivo')
                                      setTimeout(() => setError(null), 5000)
                                    }
                                  }}
                                >
                                  📥 Descargar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeTab === 'detalle' ? (
                  <div className="detail-content">
                    <div className="detail-section">
                      <h4>Información General</h4>
                      <div className="detail-grid">
                        <div className="detail-field">
                          <strong>Tipo:</strong>
                          <span className={`pqrs-type ${(selectedPQRS.Solicitud || selectedPQRS.tipo || 'general')?.toLowerCase()?.replace(/\s+/g, '_') || 'general'}`}>
                            {selectedPQRS.Solicitud || selectedPQRS.tipo || 'General'}
                          </span>
                        </div>
                        <div className="detail-field">
                          <strong>Estado:</strong>
                          <span className={`pqrs-estado ${(selectedPQRS.Estado || selectedPQRS.estado || '').toLowerCase()}`}>
                            {selectedPQRS.Estado || selectedPQRS.estado || 'N/A'}
                          </span>
                        </div>
                        <div className="detail-field">
                          <strong>Fecha de creación:</strong> {selectedPQRS.Fecha_creacion || selectedPQRS.fecha_creacion || 'N/A'}
                        </div>
                        {selectedPQRS.Asignado_a && (
                          <div className="detail-field">
                            <strong>Asignado a:</strong> {selectedPQRS.Asignado_a}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Información del Solicitante</h4>
                      <div className="detail-grid">
                        <div className="detail-field">
                          <strong>Nombre:</strong> {selectedPQRS.Nombre_completo || selectedPQRS.nombre || 'N/A'}
                        </div>
                        <div className="detail-field">
                          <strong>Documento:</strong> {selectedPQRS.Documento || selectedPQRS.documento || 'N/A'}
                        </div>
                        <div className="detail-field">
                          <strong>Email:</strong> {selectedPQRS.Correo || selectedPQRS.email || 'N/A'}
                        </div>
                        <div className="detail-field">
                          <strong>Teléfono:</strong> {selectedPQRS.Telefono_contacto || selectedPQRS.telefono || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {selectedPQRS.Descripcion_pqrs && (
                      <div className="detail-section">
                        <h4>Descripción</h4>
                        <p className="detail-description">{selectedPQRS.Descripcion_pqrs || selectedPQRS.descripcion}</p>
                      </div>
                    )}

                    <div className="detail-section">
                      <h4>Información Adicional</h4>
                      <div className="detail-grid">
                        {selectedPQRS.Area_pqrs && (
                          <div className="detail-field">
                            <strong>Área:</strong> {selectedPQRS.Area_pqrs}
                          </div>
                        )}
                        {selectedPQRS.No_factura && (
                          <div className="detail-field">
                            <strong>No. Factura:</strong> {selectedPQRS.No_factura}
                          </div>
                        )}
                        {selectedPQRS.Fecha_compra && (
                          <div className="detail-field">
                            <strong>Fecha de compra:</strong> {selectedPQRS.Fecha_compra}
                          </div>
                        )}
                        {selectedPQRS.Sede && (
                          <div className="detail-field">
                            <strong>Sede:</strong> {selectedPQRS.Sede}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="historial-content">
                    {loadingHistorial ? (
                      <div className="loading">
                        <div className="spinner"></div>
                        <p>Cargando historial...</p>
                      </div>
                    ) : historialPQRS.length > 0 ? (
                      <div className="historial-timeline">
                        {ordenarHistorialUI(historialPQRS).map((cambio, index) => (
                          <div key={index} className="historial-item">
                            <div className="historial-marker"></div>
                            <div className="historial-content">
                              <div className="historial-header">
                                <span className="historial-accion">{cambio.accion}</span>
                                {cambio.usuario && (
                                  <span className="historial-usuario">👤 {cambio.usuario}</span>
                                )}
                              </div>
                              <div className="historial-meta">
                                <span className="historial-fecha">{cambio.fecha || 'Sin fecha'}</span>
                              </div>
                              {cambio.comentario && (
                                <div className="historial-comentario">
                                  <strong>Comentario:</strong> {cambio.comentario}
                                </div>
                              )}
                              {cambio.detalles && (
                                <div className="historial-detalles">
                                  {Object.entries(cambio.detalles).map(([key, value]) => (
                                    value ? (
                                      <div key={key} className="historial-detalle-item">
                                        <strong>{key}:</strong> {value}
                                      </div>
                                    ) : null
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="historial-vacio">
                        <p>No hay historial de cambios disponible</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-detail">
              <div className="empty-detail-icon">📋</div>
              <h3>Selecciona una PQRS</h3>
              <p>Haz clic en una PQRS del listado para ver su detalle</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reasignación */}
      <ModalReasignar
        isOpen={showModalReasignar}
        onClose={() => setShowModalReasignar(false)}
        onReasignar={handleReasignar}
        recordId={selectedPQRS?.recordId || selectedPQRS?.id}
        token={token}
      />

      <ModalComentario
        isOpen={showModalComentario}
        onClose={() => {
          setShowModalComentario(false)
          setModalComentarioContexto(null)
          setEstadoPendiente(null)
          setUsuarioPendiente(null)
          setError(null)
        }}
        onGuardar={async (comentario, notificarCliente) => {
          try {
            await handleGuardarComentario(comentario, notificarCliente)
          } catch (err) {
            // El error ya se maneja en handleGuardarComentario
            throw err
          }
        }}
        titulo={modalComentarioTitulo}
        accionContexto={modalComentarioContexto}
      />

      {/* Botón flotante para agregar comentario */}
      {selectedPQRS && (
        <button
          className="btn-flotante-comentario"
          onClick={handleAbrirModalComentario}
          title="Agregar comentario"
        >
          💬
        </button>
      )}
    </div>
  )
}

export default GestionPQRS

