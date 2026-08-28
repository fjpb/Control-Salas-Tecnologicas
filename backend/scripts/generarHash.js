// Este script genera un hash bcrypt para usarlo como clave segura en la base de datos.
// Se utiliza solo para preparar contraseñas iniciales de prueba del sistema.

const bcrypt = require('bcrypt');

async function generarHash() {
  const password = 'SGTSL2026*';
  const saltRounds = 10;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Contraseña inicial:', password);
  console.log('Hash generado:', hash);
}

generarHash();