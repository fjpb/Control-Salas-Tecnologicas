// Controlador para entregar datos de catalogos y listas desplegables.
// Estos datos se utilizaran en formularios de revisiones, incidencias y dashboard.

const pool = require('../config/db');

/*
==============================================================================
FUNCION: obtenerCatalogosGenerales
DESCRIPCION:
Retorna catalogos necesarios para listas desplegables del frontend.
==============================================================================
*/
exports.obtenerCatalogosGenerales = async (req, res) => {
  try {
    const [edificios] = await pool.query(`
      SELECT id_edificio, nombre, campus
      FROM edificio
      ORDER BY nombre
    `);

    const [tiposSala] = await pool.query(`
      SELECT id_tipo_sala, nombre, descripcion
      FROM tipo_sala
      ORDER BY nombre
    `);

    const [salas] = await pool.query(`
      SELECT 
        s.id_sala,
        s.codigo,
        s.nombre,
        s.piso,
        s.id_edificio,
        e.nombre AS edificio,
        ts.nombre AS tipo_sala
      FROM sala s
      INNER JOIN edificio e ON s.id_edificio = e.id_edificio
      INNER JOIN tipo_sala ts ON s.id_tipo_sala = ts.id_tipo_sala
      WHERE s.eliminado_logico = FALSE
      ORDER BY e.nombre, s.nombre
    `);

    const [tiposEquipo] = await pool.query(`
      SELECT id_tipo_equipo, nombre, descripcion
      FROM tipo_equipo
      WHERE activo = TRUE
      ORDER BY nombre
    `);

    const [estadosRevision] = await pool.query(`
      SELECT id_estado_revision, nombre
      FROM estado_revision
      ORDER BY id_estado_revision
    `);

    const [tiposIncidencia] = await pool.query(`
      SELECT id_tipo_incidencia, nombre, descripcion
      FROM tipo_incidencia
      ORDER BY nombre
    `);

    const [estadosIncidencia] = await pool.query(`
      SELECT id_estado_incidencia, nombre
      FROM estado_incidencia
      ORDER BY id_estado_incidencia
    `);

    return res.json({
      ok: true,
      message: 'Catalogos obtenidos correctamente.',
      data: {
        edificios,
        tiposSala,
        salas,
        tiposEquipo,
        estadosRevision,
        tiposIncidencia,
        estadosIncidencia
      }
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener catalogos.',
      error: error.message
    });
  }
};
/*
==============================================================================
FUNCION: registrarTipoEquipo
DESCRIPCION:
Permite crear un nuevo tipo de equipo para ampliar el catalogo operacional.
Se valida duplicidad por nombre y se registra auditoria para mantener trazabilidad.
==============================================================================
*/
exports.registrarTipoEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const rolesPermitidos = ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR'];
    const rolUsuario = req.usuario?.nombre_rol;

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        ok: false,
        message: 'No tiene permisos para registrar tipos de equipo.',
      });
    }

    const {
      nombre,
      descripcion,
      requiere_serie = false,
      requiere_ip = false,
      requiere_mac = false,
    } = req.body;

    const nombreNormalizado = String(nombre || '').trim().toUpperCase().replace(/\s+/g, '_');
    const descripcionNormalizada = descripcion ? String(descripcion).trim() : null;

    if (!nombreNormalizado || nombreNormalizado.length < 2) {
      return res.status(400).json({
        ok: false,
        message: 'Debe ingresar un nombre de tipo de equipo de al menos 2 caracteres.',
      });
    }

    if (nombreNormalizado.length > 80) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre del tipo de equipo no puede superar los 80 caracteres.',
      });
    }

    if (descripcionNormalizada && descripcionNormalizada.length > 255) {
      return res.status(400).json({
        ok: false,
        message: 'La descripcion del tipo de equipo no puede superar los 255 caracteres.',
      });
    }

    await connection.beginTransaction();

    const [existentes] = await connection.query(
      `
      SELECT id_tipo_equipo
      FROM tipo_equipo
      WHERE nombre = ?
      LIMIT 1
      `,
      [nombreNormalizado],
    );

    if (existentes.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un tipo de equipo registrado con ese nombre.',
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO tipo_equipo
      (
        nombre,
        descripcion,
        requiere_serie,
        requiere_ip,
        requiere_mac,
        activo,
        id_usuario_creacion
      )
      VALUES (?, ?, ?, ?, ?, TRUE, ?)
      `,
      [
        nombreNormalizado,
        descripcionNormalizada,
        Boolean(requiere_serie),
        Boolean(requiere_ip),
        Boolean(requiere_mac),
        req.usuario.id_usuario,
      ],
    );

    const nuevoTipo = {
      id_tipo_equipo: resultado.insertId,
      nombre: nombreNormalizado,
      descripcion: descripcionNormalizada,
      requiere_serie: Boolean(requiere_serie) ? 1 : 0,
      requiere_ip: Boolean(requiere_ip) ? 1 : 0,
      requiere_mac: Boolean(requiere_mac) ? 1 : 0,
      activo: 1,
    };

    await connection.query(
      `
      INSERT INTO auditoria_log
      (
        id_usuario,
        tabla_afectada,
        id_registro_afectado,
        accion,
        descripcion,
        valor_nuevo,
        user_agent
      )
      VALUES (?, 'tipo_equipo', ?, 'INSERT', ?, ?, ?)
      `,
      [
        req.usuario.id_usuario,
        resultado.insertId,
        'Se registro un nuevo tipo de equipo en el catalogo.',
        JSON.stringify(nuevoTipo),
        req.headers['user-agent'] || null,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'Tipo de equipo registrado correctamente.',
      data: nuevoTipo,
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un tipo de equipo registrado con ese nombre.',
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error al registrar tipo de equipo.',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

