// Header superior institucional SGTSL.
// Muestra información del sistema, usuario autenticado y cierre de sesión.

import Swal from 'sweetalert2';

import '../../styles/layout/header.css';
import logoBlanco from '../../assets/img/logo-escudo-blanco.jpg';

function Header({ onToggleSidebar }) {

/*
  ============================================================================
  OBTENER DATOS DEL USUARIO AUTENTICADO
  ============================================================================
*/

  const usuario = JSON.parse(
    localStorage.getItem('sgtsl_usuario')
  );

/*
  ============================================================================
  FUNCIÓN: cerrarSesion
  DESCRIPCIÓN:
  Elimina la información de autenticación almacenada en el navegador
  y redirige al usuario nuevamente al login.
  ============================================================================
*/

  function cerrarSesion() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Se finalizará la sesión actual del sistema.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0D2B63',
      cancelButtonColor: '#6C757D'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('sgtsl_token');
        localStorage.removeItem('sgtsl_usuario');

        window.history.replaceState(null, '', '/login');
        window.location.href = '/login';
      }
    });
  }

  return (
    <header className="sgtsl-header">
      <div className="d-flex align-items-center gap-3">
        <button
          type="button"
          className="btn btn-outline-light btn-sm sgtsl-header-menu-btn"
          onClick={onToggleSidebar}
          title="Mostrar u ocultar menu"
          aria-label="Mostrar u ocultar menu lateral"
        >
          <i className="bi bi-list"></i>
        </button>

        <img
          src={logoBlanco}
          alt="Universidad de Concepción"
          className="sgtsl-header-logo"
        />

        <div>
          <h5 className="mb-0 fw-bold">
            Sistema SGTSL
          </h5>

          <small>
            Universidad de Concepción - Campus Los Ángeles
          </small>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <div className="text-end sgtsl-header-user">
          <strong className="d-block text-truncate">
            {usuario?.nombre || 'Usuario'}
          </strong>

          <small className="d-block text-truncate">
            {usuario?.rol || 'Sin rol'}
          </small>
        </div>

        <button
          type="button"
          className="btn btn-outline-light btn-sm"
          onClick={cerrarSesion}
          title="Cerrar sesión"
        >
          <i className="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </header>
  );
}

export default Header;

