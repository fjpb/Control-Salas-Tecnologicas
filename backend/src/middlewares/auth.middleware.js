// Se importa jsonwebtoken para validar el token enviado por el frontend.
const jwt = require('jsonwebtoken');

/*
==============================================================================
MIDDLEWARE: verificarToken
DESCRIPCIÓN:
Valida que la solicitud tenga un token JWT válido.
Si el token es correcto, deja disponible la información del usuario en req.usuario.
==============================================================================
*/
function verificarToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        ok: false,
        message: 'Token requerido para acceder a este recurso.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Formato de token inválido.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o expirado.'
    });
  }
}

module.exports = {
  verificarToken
};