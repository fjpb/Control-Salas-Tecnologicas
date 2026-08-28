// Rutas del modulo de usuarios.
// Protege administracion de cuentas y roles segun perfil autenticado.

const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middlewares/auth.middleware");
const { permitirRoles } = require("../middlewares/roles.middleware");
const {
  listarUsuarios,
  listarRoles,
  registrarUsuario,
  actualizarRolesUsuario,
  actualizarEstadoUsuario,
  resetearPasswordUsuario,
  obtenerHistorialUsuario,
} = require("../controllers/usuarios.controller");

const rolesAdministracion = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"];

router.get(
  "/",
  verificarToken,
  permitirRoles(...rolesAdministracion),
  listarUsuarios,
);

router.get(
  "/roles",
  verificarToken,
  permitirRoles(...rolesAdministracion),
  listarRoles,
);

router.get(
  "/:id_usuario/historial",
  verificarToken,
  permitirRoles(...rolesAdministracion),
  obtenerHistorialUsuario,
);

router.post(
  "/",
  verificarToken,
  permitirRoles("SUPER_ADMINISTRADOR"),
  registrarUsuario,
);

router.patch(
  "/:id_usuario/roles",
  verificarToken,
  permitirRoles(...rolesAdministracion),
  actualizarRolesUsuario,
);

router.patch(
  "/:id_usuario/password",
  verificarToken,
  permitirRoles(...rolesAdministracion),
  resetearPasswordUsuario,
);

router.patch(
  "/:id_usuario/estado",
  verificarToken,
  permitirRoles("SUPER_ADMINISTRADOR"),
  actualizarEstadoUsuario,
);

module.exports = router;
