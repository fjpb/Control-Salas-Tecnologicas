const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');
const { obtenerCatalogosGenerales, registrarTipoEquipo } = require('../controllers/catalogos.controller');

/*
==============================================================================
RUTA: GET /api/catalogos
DESCRIPCIÃ“N:
Entrega datos para listas desplegables del frontend.
==============================================================================
*/
router.get('/', verificarToken, obtenerCatalogosGenerales);

/*
==============================================================================
RUTA: POST /api/catalogos/tipos-equipo
DESCRIPCION:
Crea tipos de equipo para ampliar el catalogo usado por inventario.
==============================================================================
*/
router.post('/tipos-equipo', verificarToken, registrarTipoEquipo);

module.exports = router;
