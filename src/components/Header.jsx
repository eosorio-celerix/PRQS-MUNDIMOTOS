import './Header.css'
import logoImage from '/logo.webp'

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-logo-section">
          <a 
            href="https://mundimotos.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="logo-link"
          >
            <div className="logo-container">
              <img 
                src={logoImage} 
                alt="Mundimotos Logo" 
                className="logo-image"
              />
            </div>
          </a>
        </div>
        <div className="header-title-section">
          <h1 className="header-title">PQRS Mundimotos</h1>
          <p className="header-subtitle">Sistema de Peticiones, Quejas, Reclamos y Sugerencias</p>
        </div>
      </div>
    </header>
  )
}

export default Header

