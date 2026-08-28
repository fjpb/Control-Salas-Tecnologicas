const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function generarTokenSesion(usuario) {
  return jwt.sign(
    {
      id_usuario: usuario.id_usuario,
      rut: usuario.rut,
      correo: usuario.correo,
      id_rol: usuario.id_rol,
      nombre_rol: usuario.nombre_rol
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

function responderCredencialesInvalidas(res) {
  return res.status(401).json({
    ok: false,
    message: 'No fue posible validar las credenciales ingresadas.'
  });
}

exports.buscarRolesPorRut = async (req, res) => {
  try {
    const { rut } = req.body;

    if (!rut) {
      return res.status(400).json({
        ok: false,
        message: 'Debe ingresar el RUN/RUT del usuario.'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.id_usuario,
        u.rut,
        CONCAT(u.nombres, ' ', u.apellidos) AS nombre_usuario,
        u.correo,
        r.id_rol,
        r.nombre_rol
      FROM usuario u
      INNER JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE u.rut = ?
        AND u.activo = TRUE
        AND ur.activo = TRUE
        AND r.activo = TRUE
      `,
      [rut]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'No se encontraron roles asociados al usuario.'
      });
    }

    return res.json({
      ok: true,
      usuario: {
        id_usuario: rows[0].id_usuario,
        rut: rows[0].rut,
        nombre_usuario: rows[0].nombre_usuario,
        correo: rows[0].correo
      },
      roles: rows.map(row => ({
        id_rol: row.id_rol,
        nombre_rol: row.nombre_rol
      }))
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al consultar roles.',
      error: error.message
    });
  }
};

exports.validarCredenciales = async (req, res) => {
  try {
    const { rut, password } = req.body;

    if (!rut || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Debe ingresar RUN/RUT y contrasena.'
      });
    }

    const [usuarios] = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.rut,
        u.nombres,
        u.apellidos,
        u.correo,
        u.clave_hash
      FROM usuario u
      WHERE u.rut = ?
        AND u.activo = TRUE
      LIMIT 1
      `,
      [rut]
    );

    if (usuarios.length === 0) {
      return responderCredencialesInvalidas(res);
    }

    const usuario = usuarios[0];
    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);

    if (!passwordValida) {
      return responderCredencialesInvalidas(res);
    }

    const [roles] = await pool.query(
      `
      SELECT
        r.id_rol,
        r.nombre_rol
      FROM usuario_rol ur
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE ur.id_usuario = ?
        AND ur.activo = TRUE
        AND r.activo = TRUE
      ORDER BY r.nombre_rol
      `,
      [usuario.id_usuario]
    );

    if (roles.length === 0) {
      return responderCredencialesInvalidas(res);
    }

    const tokenPrelogin = jwt.sign(
      {
        tipo: 'PRELOGIN',
        id_usuario: usuario.id_usuario,
        rut: usuario.rut
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({
      ok: true,
      message: 'Credenciales validadas correctamente.',
      token_prelogin: tokenPrelogin,
      usuario: {
        id_usuario: usuario.id_usuario,
        rut: usuario.rut,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        correo: usuario.correo
      },
      roles
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al validar credenciales.',
      error: error.message
    });
  }
};

exports.seleccionarRol = async (req, res) => {
  try {
    const { token_prelogin, id_rol } = req.body;

    if (!token_prelogin || !id_rol) {
      return res.status(400).json({
        ok: false,
        message: 'Debe seleccionar un rol de acceso.'
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token_prelogin, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        ok: false,
        message: 'La validacion previa expiro. Ingrese nuevamente.'
      });
    }

    if (decoded.tipo !== 'PRELOGIN' || !decoded.id_usuario) {
      return res.status(401).json({
        ok: false,
        message: 'La validacion previa no es valida.'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.rut,
        u.nombres,
        u.apellidos,
        u.correo,
        r.id_rol,
        r.nombre_rol
      FROM usuario u
      INNER JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE u.id_usuario = ?
        AND r.id_rol = ?
        AND u.activo = TRUE
        AND ur.activo = TRUE
        AND r.activo = TRUE
      LIMIT 1
      `,
      [decoded.id_usuario, id_rol]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        ok: false,
        message: 'El rol seleccionado no esta disponible para este usuario.'
      });
    }

    const usuario = rows[0];
    const token = generarTokenSesion(usuario);

    return res.json({
      ok: true,
      message: 'Inicio de sesion exitoso.',
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        correo: usuario.correo,
        rol: usuario.nombre_rol
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al seleccionar rol.',
      error: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { rut, id_rol, password } = req.body;

    if (!rut || !id_rol || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Debe ingresar RUN/RUT, rol y contraseña.'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.id_usuario,
        u.rut,
        u.nombres,
        u.apellidos,
        u.correo,
        u.clave_hash,
        r.id_rol,
        r.nombre_rol
      FROM usuario u
      INNER JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
      INNER JOIN rol r ON ur.id_rol = r.id_rol
      WHERE u.rut = ?
        AND r.id_rol = ?
        AND u.activo = TRUE
        AND ur.activo = TRUE
        AND r.activo = TRUE
      LIMIT 1
      `,
      [rut, id_rol]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario o rol no válido.'
      });
    }

    const usuario = rows[0];

    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        message: 'Contraseña incorrecta.'
      });
    }

    const token = generarTokenSesion(usuario);

    return res.json({
      ok: true,
      message: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        correo: usuario.correo,
        rol: usuario.nombre_rol
      }
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al iniciar sesión.',
      error: error.message
    });
  }
};
