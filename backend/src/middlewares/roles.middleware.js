/*
==============================================================================
MIDDLEWARE: permitirRoles
DESCRIPCIÓN:
Permite restringir rutas según el rol del usuario autenticado.
El rol viene dentro del token JWT y queda disponible en req.usuario.
==============================================================================
*/
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado.'
      });
    }

    if (!rolesPermitidos.includes(req.usuario.nombre_rol)) {
      return res.status(403).json({
        ok: false,
        message: 'No tiene permisos para acceder a este recurso.'
      });
    }

    next();
  };
}

module.exports = {
  permitirRoles
};