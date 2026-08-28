const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middlewares/auth.middleware");
const { uploadEvidencia } = require("../middlewares/upload.middleware");

const {
  registrarIncidencia,
  listarIncidencias,
  editarIncidencia,
  cambiarEstadoIncidencia,
  reabrirIncidencia,
  subirEvidenciaIncidencia,
  listarEvidenciasIncidencia,
  obtenerHistorialIncidencia,
} = require("../controllers/incidencias.controller");

router.get("/", verificarToken, listarIncidencias);

router.get("/:id_incidencia/historial", verificarToken, obtenerHistorialIncidencia);

router.get("/:id_incidencia/evidencias", verificarToken, listarEvidenciasIncidencia);

router.post("/", verificarToken, registrarIncidencia);

router.patch("/:id_incidencia", verificarToken, editarIncidencia);

router.patch("/:id_incidencia/estado", verificarToken, cambiarEstadoIncidencia);

router.patch("/:id_incidencia/reabrir", verificarToken, reabrirIncidencia);

router.post(
  "/:id_incidencia/evidencias",
  verificarToken,
  uploadEvidencia.single("imagen"),
  subirEvidenciaIncidencia
);

module.exports = router;
