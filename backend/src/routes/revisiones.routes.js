// Rutas del módulo de revisiones.
// Define endpoints protegidos para estado semanal, registro, historial,
// equipos por sala, checklist técnico, detalle e historial de revisión.

const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middlewares/auth.middleware");

const {
  obtenerEstadoSemanalSala,
  registrarRevision,
  obtenerEquiposPorSala,
  obtenerChecklistPorEquipo,
  listarRevisiones,
  obtenerDetalleRevision,
  obtenerHistorialRevision,
  editarRevision,
  anularRevision,
} = require("../controllers/revisiones.controller");

router.get("/historial", verificarToken, listarRevisiones);

router.get("/historial/:id_revision", verificarToken, obtenerHistorialRevision);

router.get("/detalle/:id_revision", verificarToken, obtenerDetalleRevision);

router.get(
  "/estado-semanal/:id_sala",
  verificarToken,
  obtenerEstadoSemanalSala,
);

router.get("/equipos-por-sala/:id_sala", verificarToken, obtenerEquiposPorSala);

router.get(
  "/checklist-equipo/:id_equipo",
  verificarToken,
  obtenerChecklistPorEquipo,
);

router.post("/", verificarToken, registrarRevision);

router.patch("/:id_revision", verificarToken, editarRevision);

router.patch("/:id_revision/anular", verificarToken, anularRevision);

module.exports = router;
