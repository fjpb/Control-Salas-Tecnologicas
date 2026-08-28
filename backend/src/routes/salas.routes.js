// Rutas del modulo de salas.
// Expone consulta operativa de salas y laboratorios protegida por JWT.

const express = require("express");
const router = express.Router();

const { verificarToken } = require("../middlewares/auth.middleware");
const {
  listarSalas,
  registrarSala,
  obtenerQrSala,
  actualizarSala,
  obtenerHistorialSala,
} = require("../controllers/salas.controller");

router.get("/", verificarToken, listarSalas);
router.post("/", verificarToken, registrarSala);
router.get("/:id_sala/qr", verificarToken, obtenerQrSala);
router.get("/:id_sala/historial", verificarToken, obtenerHistorialSala);
router.patch("/:id_sala", verificarToken, actualizarSala);

module.exports = router;
