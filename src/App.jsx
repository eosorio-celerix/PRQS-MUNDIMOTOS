import { useState, useEffect } from 'react'
import Header from './components/Header'
import ConsultarPQRS from './components/ConsultarPQRS'
import CrearPQRS from './components/CrearPQRS'
import Login from './components/Login'
import GestionPQRS from './components/GestionPQRS'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('consultar')
  const [successMessage, setSuccessMessage] = useState(null)
  const [createdRecordId, setCreatedRecordId] = useState(null)
  const [isEmpleadoMode, setIsEmpleadoMode] = useState(false)
  const [empleadoInfo, setEmpleadoInfo] = useState(null)

  // Verificar si hay sesión de empleado al cargar
  useEffect(() => {
    const token = localStorage.getItem('empleado_token')
    const usuario = localStorage.getItem('empleado_usuario')
    if (token && usuario) {
      setEmpleadoInfo({ token, usuario })
      setIsEmpleadoMode(true)
    }
  }, [])

  const handleLoginSuccess = (result) => {
    setEmpleadoInfo(result)
    setIsEmpleadoMode(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('empleado_token')
    localStorage.removeItem('empleado_usuario')
    setEmpleadoInfo(null)
    setIsEmpleadoMode(false)
  }

  // Si está en modo empleado, mostrar login o gestión según corresponda
  if (isEmpleadoMode) {
    if (empleadoInfo) {
      return <GestionPQRS empleadoInfo={empleadoInfo} onLogout={handleLogout} />
    } else {
      return <Login onLoginSuccess={handleLoginSuccess} />
    }
  }

  // Modo público (clientes)
  return (
    <div className="App">
      <Header />
      <div className="container">
        <div className="navigation-tabs">
          <button
            className={`tab-button ${activeView === 'consultar' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('consultar')
              setSuccessMessage(null)
            }}
          >
            Consultar PQRS
          </button>
          <button
            className={`tab-button ${activeView === 'crear' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('crear')
              setSuccessMessage(null)
            }}
          >
            Crear PQRS
          </button>
          <button
            className="tab-button tab-button-empleado"
            onClick={() => setIsEmpleadoMode(true)}
          >
            🔐 Acceso Empleados
          </button>
        </div>

        <div className="content-area">
          {activeView === 'consultar' ? (
            <ConsultarPQRS 
              successMessage={successMessage}
              createdRecordId={createdRecordId}
              onClearSuccess={() => {
                setSuccessMessage(null)
                setCreatedRecordId(null)
              }}
            />
          ) : (
            <CrearPQRS 
              onSuccess={(recordId) => {
                setCreatedRecordId(recordId)
                setSuccessMessage('¡PQRS creada exitosamente!')
                setActiveView('consultar')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App

