// Configuración principal de Express para SGTSL.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const catalogosRoutes = require('./routes/catalogos.routes');
const salasRoutes = require('./routes/salas.routes');
const revisionesRoutes = require('./routes/revisiones.routes');
const incidenciasRoutes = require('./routes/incidencias.routes');
const equiposRoutes = require('./routes/equipos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
==============================================================================
RUTA DE SALUD DEL BACKEND
==============================================================================
*/
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Backend SGTSL operativo'
  });
});

/*
==============================================================================
CARPETA PÚBLICA DE EVIDENCIAS
==============================================================================
*/
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }
  })
);

/*
==============================================================================
RUTAS PRINCIPALES DEL SISTEMA
==============================================================================
*/
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/salas', salasRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/revisiones', revisionesRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.use('/api/usuarios', usuariosRoutes);

module.exports = app;
