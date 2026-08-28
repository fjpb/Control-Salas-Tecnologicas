// Rutas del modulo de equipos.
// Expone inventario tecnologico y estado de asignacion a salas.

const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middlewares/auth.middleware");
const { permitirRoles } = require("../middlewares/roles.middleware");
const {
  listarEquipos,
  registrarEquipo,
  actualizarEquipo,
  obtenerHistorialEquipo,
  asignarEquipoSala,
  retirarEquipoSala,
  listarBajasEquipo,
  obtenerHistorialBajaEquipo,
  solicitarBajaEquipo,
  decidirBajaEquipo,
  ejecutarBajaEquipo,
} = require("../controllers/equipos.controller");

const rolesGestionBaja = [
  "SUPER_ADMINISTRADOR",
  "ADMINISTRADOR",
  "TECNICO_SOPORTE",
  "ALUMNO_PRACTICA",
];

const rolesGestionEquipo = [
  "SUPER_ADMINISTRADOR",
  "ADMINISTRADOR",
  "TECNICO_SOPORTE",
];

router.get("/", verificarToken, listarEquipos);
router.post(
  "/",
  verificarToken,
  permitirRoles(...rolesGestionEquipo),
  registrarEquipo,
);
router.get(
  "/bajas",
  verificarToken,
  permitirRoles(...rolesGestionBaja),
  listarBajasEquipo,
);
router.get(
  "/bajas/:id_baja_equipo/historial",
  verificarToken,
  permitirRoles(...rolesGestionBaja),
  obtenerHistorialBajaEquipo,
);
router.patch(
  "/bajas/:id_baja_equipo/decision",
  verificarToken,
  permitirRoles("SUPER_ADMINISTRADOR"),
  decidirBajaEquipo,
);
router.patch(
  "/bajas/:id_baja_equipo/ejecutar",
  verificarToken,
  permitirRoles("SUPER_ADMINISTRADOR"),
  ejecutarBajaEquipo,
);
router.get("/:id_equipo/historial", verificarToken, obtenerHistorialEquipo);
router.post(
  "/:id_equipo/asignar-sala",
  verificarToken,
  permitirRoles(...rolesGestionEquipo),
  asignarEquipoSala,
);
router.post(
  "/:id_equipo/solicitar-baja",
  verificarToken,
  permitirRoles(...rolesGestionBaja),
  solicitarBajaEquipo,
);
router.patch(
  "/:id_equipo/retirar-sala",
  verificarToken,
  permitirRoles(...rolesGestionEquipo),
  retirarEquipoSala,
);
router.patch(
  "/:id_equipo",
  verificarToken,
  permitirRoles(...rolesGestionEquipo),
  actualizarEquipo,
);

module.exports = router;
