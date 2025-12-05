import { useState } from 'react'
import { empleadoService } from '../services/api'
import './Login.css'

const Login = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!usuario.trim() || !password.trim()) {
      setError('Por favor ingrese usuario y contraseña')
      setLoading(false)
      return
    }

    try {
      const result = await empleadoService.login(usuario, password)
      if (result.success) {
        // Guardar token en localStorage
        localStorage.setItem('empleado_token', result.token)
        localStorage.setItem('empleado_usuario', result.usuario)
        onLoginSuccess(result)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h2>Acceso Empleados</h2>
          <p>Sistema de Gestión de PQRS</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="usuario">
              <span className="required">*</span> Usuario
            </label>
            <input
              type="text"
              id="usuario"
              name="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              placeholder="Ingrese su usuario"
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="required">*</span> Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Ingrese su contraseña"
              className="form-input"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

