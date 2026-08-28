require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a MySQL Azure exitosa');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Servidor SGTSL iniciado en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();