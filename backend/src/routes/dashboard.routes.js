const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth.middleware');
const { permitirRoles } = require('../middlewares/roles.middleware');
const { obtenerKpiDashboard } = require('../controllers/dashboard.controller');

/*
==============================================================================
RUTA: GET /api/dashboard/resumen
DESCRIPCIÓN:
Ruta de prueba protegida para validar JWT y rol.
==============================================================================
*/
router.get(
  '/resumen',
  verificarToken,
  permitirRoles('SUPER_ADMINISTRADOR', 'ADMINISTRADOR', 'TECNICO_SOPORTE'),
  (req, res) => {
    res.json({
      ok: true,
      message: 'Dashboard SGTSL protegido correctamente.',
      usuario: req.usuario
    });
  }
);

/*
==============================================================================
RUTA: GET /api/dashboard/kpi
DESCRIPCIÓN:
Entrega los KPI reales del sistema desde las vistas SQL.
==============================================================================
*/
router.get(
  '/kpi',
  verificarToken,
  permitirRoles(
    'SUPER_ADMINISTRADOR',
    'ADMINISTRADOR',
    'TECNICO_SOPORTE',
    'ALUMNO_PRACTICA',
    'DOCENTE'
  ),
  obtenerKpiDashboard
);

module.exports = router;
