const express = require('express');
const router = express.Router();

const {
  buscarRolesPorRut,
  validarCredenciales,
  seleccionarRol,
  login
} = require('../controllers/auth.controller');

router.post('/roles', buscarRolesPorRut);
router.post('/validar-credenciales', validarCredenciales);
router.post('/seleccionar-rol', seleccionarRol);
router.post('/login', login);

module.exports = router;
