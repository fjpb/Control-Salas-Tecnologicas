// Controlador del modulo de usuarios SGTSL.
// Permite listar usuarios, crear cuentas y administrar roles sin eliminar datos.

const bcrypt = require("bcrypt");
const pool = require("../config/db");

function esSuperAdministrador(req) {
  return req.usuario?.nombre_rol === "SUPER_ADMINISTRADOR";
}

function esAdministrador(req) {
  return req.usuario?.nombre_rol === "ADMINISTRADOR";
}

function normalizarTexto(valor) {
  return valor ? String(valor).trim() : "";
}

function normalizarRut(valor) {
  return formatearRutChileno(valor);
}
function limpiarRutChileno(valor) {
  return normalizarTexto(valor).toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9);
}

function calcularDigitoVerificador(cuerpoRut) {
  let suma = 0;
  let multiplicador = 2;

  for (let indice = cuerpoRut.length - 1; indice >= 0; indice -= 1) {
    suma += Number(cuerpoRut[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

function formatearRutChileno(valor) {
  const limpio = limpiarRutChileno(valor);
  if (limpio.length <= 1) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const digito = limpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return cuerpoFormateado + "-" + digito;
}

function esRutChilenoValido(valor) {
  const limpio = limpiarRutChileno(valor);
  if (limpio.length < 8) return false;

  const cuerpo = limpio.slice(0, -1);
  const digito = limpio.slice(-1);

  return /^\d{7,8}$/.test(cuerpo) && digito === calcularDigitoVerificador(cuerpo);
}


function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

async function registrarAuditoria(connection, req, tabla, idRegistro, accion, descripcion, anterior, nuevo) {
  await connection.query(
    `
    INSERT INTO auditoria_log (
        id_usuario,
        tabla_afectada,
        id_registro_afectado,
        accion,
        descripcion,
        valor_anterior,
        valor_nuevo,
        ip_origen,
        user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      req.usuario.id_usuario,
      tabla,
      idRegistro,
      accion,
      descripcion,
      anterior ? JSON.stringify(anterior) : null,
      nuevo ? JSON.stringify(nuevo) : null,
      req.ip || null,
      req.headers["user-agent"] || null,
    ],
  );
}

async function obtenerRolesActivosUsuario(connection, idUsuario) {
  const [roles] = await connection.query(
    `
    SELECT r.id_rol, r.nombre_rol
    FROM usuario_rol ur
    INNER JOIN rol r
        ON ur.id_rol = r.id_rol
    WHERE ur.id_usuario = ?
      AND ur.activo = TRUE
      AND r.activo = TRUE
    ORDER BY r.nombre_rol
    `,
    [idUsuario],
  );

  return roles;
}

/*
==============================================================================
FUNCION: listarUsuarios
DESCRIPCION:
Entrega usuarios y roles activos/inactivos para administracion. No expone
hashes de contrasena ni permite eliminacion fisica.
==============================================================================
*/
exports.listarUsuarios = async (req, res) => {
  try {
    const [filas] = await pool.query(`
      SELECT
          u.id_usuario,
          u.rut,
          u.nombres,
          u.apellidos,
          CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
          u.correo,
          u.telefono,
          u.activo,
          u.fecha_creacion,
          r.id_rol,
          r.nombre_rol,
          ur.activo AS rol_activo
      FROM usuario u
      LEFT JOIN usuario_rol ur
          ON u.id_usuario = ur.id_usuario
      LEFT JOIN rol r
          ON ur.id_rol = r.id_rol
      ORDER BY u.nombres, u.apellidos, r.nombre_rol
    `);

    const usuarios = [];
    const indiceUsuarios = new Map();

    filas.forEach((fila) => {
      if (!indiceUsuarios.has(fila.id_usuario)) {
        indiceUsuarios.set(fila.id_usuario, usuarios.length);
        usuarios.push({
          id_usuario: fila.id_usuario,
          rut: fila.rut,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          nombre_completo: fila.nombre_completo,
          correo: fila.correo,
          telefono: fila.telefono,
          activo: Boolean(fila.activo),
          fecha_creacion: fila.fecha_creacion,
          roles: [],
        });
      }

      if (fila.id_rol) {
        usuarios[indiceUsuarios.get(fila.id_usuario)].roles.push({
          id_rol: fila.id_rol,
          nombre_rol: fila.nombre_rol,
          activo: Boolean(fila.rol_activo),
        });
      }
    });

    return res.json({
      ok: true,
      total: usuarios.length,
      data: usuarios,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar usuarios.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: listarRoles
DESCRIPCION:
Entrega roles activos para formularios de administracion de usuarios.
==============================================================================
*/
exports.listarRoles = async (req, res) => {
  try {
    const [roles] = await pool.query(`
      SELECT id_rol, nombre_rol, descripcion
      FROM rol
      WHERE activo = TRUE
      ORDER BY nombre_rol
    `);

    return res.json({
      ok: true,
      total: roles.length,
      data: roles,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar roles.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: registrarUsuario
DESCRIPCION:
Crea usuarios nuevos solo desde perfil SUPER_ADMINISTRADOR. La contrasena se
almacena con hash bcrypt y la asignacion de roles se registra sin eliminar datos.
==============================================================================
*/
exports.registrarUsuario = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!esSuperAdministrador(req)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Solo el super administrador puede crear usuarios.",
      });
    }

    const rut = normalizarRut(req.body.rut);
    const nombres = normalizarTexto(req.body.nombres);
    const apellidos = normalizarTexto(req.body.apellidos);
    const correo = normalizarTexto(req.body.correo).toLowerCase();
    const telefono = normalizarTexto(req.body.telefono) || null;
    const password = normalizarTexto(req.body.password);
    const roles = Array.isArray(req.body.roles) ? req.body.roles.map(Number) : [];

    if (!esRutChilenoValido(rut)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un RUN chileno valido para el usuario.",
      });
    }

    const rutLimpio = limpiarRutChileno(rut);
    const [usuariosRutExistente] = await connection.query(
      `
      SELECT id_usuario
      FROM usuario
      WHERE REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = ?
      LIMIT 1
      `,
      [rutLimpio],
    );

    if (usuariosRutExistente.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "El RUN ingresado ya se encuentra registrado en el sistema.",
      });
    }

    if (!nombres || nombres.length < 2 || nombres.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar nombres entre 2 y 100 caracteres.",
      });
    }

    if (!apellidos || apellidos.length < 2 || apellidos.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar apellidos entre 2 y 100 caracteres.",
      });
    }

    if (!correo || correo.length > 150 || !validarCorreo(correo)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un correo valido.",
      });
    }

    if (telefono && telefono.length > 30) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El telefono no puede superar los 30 caracteres.",
      });
    }

    if (!password || password.length < 8 || password.length > 72) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La contrasena debe tener entre 8 y 72 caracteres.",
      });
    }

    if (roles.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe asignar al menos un rol al usuario.",
      });
    }

    const [rolesValidos] = await connection.query(
      `
      SELECT id_rol, nombre_rol
      FROM rol
      WHERE id_rol IN (?)
        AND activo = TRUE
      `,
      [roles],
    );

    if (rolesValidos.length !== new Set(roles).size) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Uno o mas roles seleccionados no son validos.",
      });
    }

    const claveHash = await bcrypt.hash(password, 10);

    const [resultadoUsuario] = await connection.query(
      `
      INSERT INTO usuario (
          rut,
          nombres,
          apellidos,
          correo,
          telefono,
          clave_hash,
          activo
      )
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `,
      [rut, nombres, apellidos, correo, telefono, claveHash],
    );

    const idUsuarioNuevo = resultadoUsuario.insertId;

    for (const idRol of new Set(roles)) {
      await connection.query(
        `
        INSERT INTO usuario_rol (
            id_usuario,
            id_rol,
            activo,
            id_usuario_creacion,
            id_usuario_actualizacion
        )
        VALUES (?, ?, TRUE, ?, ?)
        `,
        [idUsuarioNuevo, idRol, req.usuario.id_usuario, req.usuario.id_usuario],
      );
    }

    await registrarAuditoria(
      connection,
      req,
      "usuario",
      idUsuarioNuevo,
      "INSERT",
      "Se registro un nuevo usuario del sistema.",
      null,
      {
        id_usuario: idUsuarioNuevo,
        rut,
        nombres,
        apellidos,
        correo,
        telefono,
        activo: true,
        roles: rolesValidos.map((rol) => rol.nombre_rol),
      },
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Usuario registrado correctamente.",
      data: {
        id_usuario: idUsuarioNuevo,
        rut,
        nombre_completo: `${nombres} ${apellidos}`,
        correo,
      },
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un usuario con ese RUN o correo.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Error al registrar usuario.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: actualizarRolesUsuario
DESCRIPCION:
Activa o desactiva roles de un usuario sin eliminar registros. Un administrador
no puede modificar super administradores ni asignar el rol SUPER_ADMINISTRADOR.
==============================================================================
*/
exports.actualizarRolesUsuario = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_usuario } = req.params;
    const rolesSolicitados = Array.isArray(req.body.roles)
      ? req.body.roles.map(Number)
      : [];

    if (!id_usuario || rolesSolicitados.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar usuario y al menos un rol.",
      });
    }

    const [usuarios] = await connection.query(
      `
      SELECT id_usuario, rut, nombres, apellidos, correo, activo
      FROM usuario
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id_usuario],
    );

    if (usuarios.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El usuario seleccionado no existe.",
      });
    }

    const rolesAnteriores = await obtenerRolesActivosUsuario(connection, id_usuario);
    const esUsuarioSuper = rolesAnteriores.some(
      (rol) => rol.nombre_rol === "SUPER_ADMINISTRADOR",
    );

    if (esAdministrador(req) && esUsuarioSuper) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Un administrador no puede modificar roles de un super administrador.",
      });
    }

    const [rolesValidos] = await connection.query(
      `
      SELECT id_rol, nombre_rol
      FROM rol
      WHERE id_rol IN (?)
        AND activo = TRUE
      `,
      [rolesSolicitados],
    );

    if (rolesValidos.length !== new Set(rolesSolicitados).size) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Uno o mas roles seleccionados no son validos.",
      });
    }

    const solicitaSuper = rolesValidos.some(
      (rol) => rol.nombre_rol === "SUPER_ADMINISTRADOR",
    );

    if (esAdministrador(req) && solicitaSuper) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Un administrador no puede asignar el rol super administrador.",
      });
    }

    const remueveRolActual =
      Number(id_usuario) === Number(req.usuario.id_usuario) &&
      !rolesValidos.some((rol) => rol.nombre_rol === req.usuario.nombre_rol);

    if (remueveRolActual) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "No puede retirar el rol con el que mantiene la sesion activa.",
      });
    }

    const idsRolesSolicitados = Array.from(new Set(rolesSolicitados));

    const [rolesActuales] = await connection.query(
      "SELECT id_rol FROM usuario_rol WHERE id_usuario = ?",
      [id_usuario],
    );
    const idsRolesActuales = rolesActuales.map((rol) => Number(rol.id_rol));

    for (const idRol of idsRolesSolicitados) {
      if (idsRolesActuales.includes(idRol)) {
        await connection.query(
          `
          UPDATE usuario_rol
          SET activo = TRUE,
              id_usuario_actualizacion = ?
          WHERE id_usuario = ?
            AND id_rol = ?
          `,
          [req.usuario.id_usuario, id_usuario, idRol],
        );
      } else {
        await connection.query(
          `
          INSERT INTO usuario_rol (
              id_usuario,
              id_rol,
              activo,
              id_usuario_creacion,
              id_usuario_actualizacion
          )
          VALUES (?, ?, TRUE, ?, ?)
          `,
          [id_usuario, idRol, req.usuario.id_usuario, req.usuario.id_usuario],
        );
      }
    }

    await connection.query(
      `
      UPDATE usuario_rol
      SET activo = FALSE,
          id_usuario_actualizacion = ?
      WHERE id_usuario = ?
        AND id_rol NOT IN (?)
      `,
      [req.usuario.id_usuario, id_usuario, idsRolesSolicitados],
    );

    await registrarAuditoria(
      connection,
      req,
      "usuario_rol",
      Number(id_usuario),
      "UPDATE",
      "Se actualizaron los roles asociados a un usuario.",
      {
        usuario: `${usuarios[0].nombres} ${usuarios[0].apellidos}`,
        roles: rolesAnteriores.map((rol) => rol.nombre_rol),
      },
      {
        usuario: `${usuarios[0].nombres} ${usuarios[0].apellidos}`,
        roles: rolesValidos.map((rol) => rol.nombre_rol),
      },
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Roles actualizados correctamente.",
      data: {
        id_usuario: Number(id_usuario),
        roles: rolesValidos.map((rol) => rol.nombre_rol),
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar roles del usuario.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: resetearPasswordUsuario
DESCRIPCION:
Permite a SUPER_ADMINISTRADOR y ADMINISTRADOR asignar una nueva contrasena
temporal a un usuario. No expone la contrasena anterior y registra auditoria.
Un ADMINISTRADOR no puede resetear cuentas SUPER_ADMINISTRADOR.
==============================================================================
*/
exports.resetearPasswordUsuario = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_usuario } = req.params;
    const password = normalizarTexto(req.body.password);

    if (!esSuperAdministrador(req) && !esAdministrador(req)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para resetear contrasenas de usuarios.",
      });
    }

    if (!id_usuario) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el usuario a actualizar.",
      });
    }

    if (!password || password.length < 8 || password.length > 72) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La nueva contrasena debe tener entre 8 y 72 caracteres.",
      });
    }

    const [usuarios] = await connection.query(
      `
      SELECT id_usuario, rut, nombres, apellidos, correo, activo
      FROM usuario
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id_usuario],
    );

    if (usuarios.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El usuario seleccionado no existe.",
      });
    }

    const rolesActivos = await obtenerRolesActivosUsuario(connection, id_usuario);
    const esUsuarioSuper = rolesActivos.some(
      (rol) => rol.nombre_rol === "SUPER_ADMINISTRADOR",
    );

    if (esAdministrador(req) && esUsuarioSuper) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Un administrador no puede resetear la contrasena de un super administrador.",
      });
    }

    const claveHash = await bcrypt.hash(password, 10);

    await connection.query(
      `
      UPDATE usuario
      SET clave_hash = ?,
          fecha_actualizacion = NOW()
      WHERE id_usuario = ?
      `,
      [claveHash, id_usuario],
    );

    const usuarioActual = usuarios[0];
    const nombreCompleto = `${usuarioActual.nombres} ${usuarioActual.apellidos}`;

    await registrarAuditoria(
      connection,
      req,
      "usuario",
      Number(id_usuario),
      "UPDATE",
      "Se reseteo la contrasena de una cuenta de usuario.",
      {
        rut: usuarioActual.rut,
        usuario: nombreCompleto,
        correo: usuarioActual.correo,
        password: "No visible por seguridad",
      },
      {
        rut: usuarioActual.rut,
        usuario: nombreCompleto,
        correo: usuarioActual.correo,
        password: "Contrasena actualizada por administracion",
      },
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Contrasena reseteada correctamente.",
      data: {
        id_usuario: Number(id_usuario),
        rut: usuarioActual.rut,
        nombre_completo: nombreCompleto,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al resetear la contrasena del usuario.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: actualizarEstadoUsuario
DESCRIPCION:
Habilita o deshabilita logicamente una cuenta de usuario. No elimina registros
para proteger la trazabilidad asociada a auditorias, revisiones e incidencias.
Solo SUPER_ADMINISTRADOR puede ejecutar esta accion.
==============================================================================
*/
exports.actualizarEstadoUsuario = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_usuario } = req.params;
    const activo = Boolean(req.body.activo);

    if (!esSuperAdministrador(req)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Solo el super administrador puede cambiar el estado de usuarios.",
      });
    }

    if (!id_usuario) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el usuario a actualizar.",
      });
    }

    if (Number(id_usuario) === Number(req.usuario.id_usuario) && !activo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "No puede deshabilitar la cuenta con la que mantiene la sesion activa.",
      });
    }

    const [usuarios] = await connection.query(
      `
      SELECT id_usuario, rut, nombres, apellidos, correo, activo
      FROM usuario
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id_usuario],
    );

    if (usuarios.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El usuario seleccionado no existe.",
      });
    }

    const usuarioActual = usuarios[0];

    await connection.query(
      `
      UPDATE usuario
      SET activo = ?
      WHERE id_usuario = ?
      `,
      [activo, id_usuario],
    );

    await registrarAuditoria(
      connection,
      req,
      "usuario",
      Number(id_usuario),
      "UPDATE",
      activo
        ? "Se habilito una cuenta de usuario."
        : "Se deshabilito una cuenta de usuario.",
      {
        rut: usuarioActual.rut,
        usuario: `${usuarioActual.nombres} ${usuarioActual.apellidos}`,
        correo: usuarioActual.correo,
        activo: Boolean(usuarioActual.activo),
      },
      {
        rut: usuarioActual.rut,
        usuario: `${usuarioActual.nombres} ${usuarioActual.apellidos}`,
        correo: usuarioActual.correo,
        activo,
      },
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: activo
        ? "Usuario habilitado correctamente."
        : "Usuario deshabilitado correctamente.",
      data: {
        id_usuario: Number(id_usuario),
        activo,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar el estado del usuario.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: obtenerHistorialUsuario
DESCRIPCION:
Consulta eventos de auditoria asociados al usuario y a sus roles. No modifica
datos; solo presenta trazabilidad administrativa.
==============================================================================
*/
exports.obtenerHistorialUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    if (!id_usuario) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el usuario.",
      });
    }

    const [usuarios] = await pool.query(
      `
      SELECT id_usuario
      FROM usuario
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id_usuario],
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "El usuario solicitado no existe.",
      });
    }

    const [historial] = await pool.query(
      `
      SELECT
          al.id_auditoria,
          al.tabla_afectada,
          al.accion,
          al.descripcion,
          al.valor_anterior,
          al.valor_nuevo,
          al.fecha_evento,
          al.user_agent,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario
      FROM auditoria_log al
      LEFT JOIN usuario u
          ON al.id_usuario = u.id_usuario
      WHERE
        (
          al.tabla_afectada = 'usuario'
          AND al.id_registro_afectado = ?
        )
        OR
        (
          al.tabla_afectada = 'usuario_rol'
          AND al.id_registro_afectado = ?
        )
      ORDER BY al.fecha_evento ASC
      `,
      [id_usuario, id_usuario],
    );

    return res.json({
      ok: true,
      total: historial.length,
      data: historial,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial del usuario.",
      error: error.message,
    });
  }
};
