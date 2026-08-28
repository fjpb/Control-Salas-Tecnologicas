// Ruta protegida del SGTSL.
// Valida si existe un token JWT antes de permitir el acceso a módulos internos.

import { Navigate, useLocation } from 'react-router-dom';

function ProtectedRoute({ children, rolesPermitidos = null }) {
  const location = useLocation();

  /*
  ============================================================================
  OBTENER TOKEN JWT
  ============================================================================
  */

  const token = localStorage.getItem('sgtsl_token');
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem('sgtsl_usuario')) || {};
    } catch {
      return {};
    }
  })();

  /*
  ============================================================================
  VALIDAR SESIÓN
  ============================================================================
  */

  if (!token) {
    localStorage.setItem(
      'sgtsl_ruta_pendiente',
      `${location.pathname}${location.search || ''}`
    );
    return <Navigate to="/login" replace />;
  }

  if (
    Array.isArray(rolesPermitidos) &&
    rolesPermitidos.length > 0 &&
    !rolesPermitidos.includes(usuario?.rol)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  /*
  ============================================================================
  PERMITIR ACCESO
  ============================================================================
  */

  return children;
}

export default ProtectedRoute;

