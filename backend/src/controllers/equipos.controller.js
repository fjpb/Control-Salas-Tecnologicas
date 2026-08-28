// Controlador del modulo de equipos.
// Entrega inventario tecnologico indicando si cada equipo esta asignado a sala.

const pool = require("../config/db");

/*
==============================================================================
FUNCION: listarEquipos
DESCRIPCION:
Lista equipos activos logicamente y agrega informacion de asignacion vigente.
No modifica datos; se usa como base del modulo visual de inventario.
==============================================================================
*/
exports.listarEquipos = async (req, res) => {
  try {
    const [equipos] = await pool.query(
      `
      SELECT
          e.id_equipo,
          e.codigo_inventario,
          e.nro_serie,
          e.nombre_equipo,
          e.marca,
          e.modelo,
          e.id_tipo_equipo,
          te.nombre AS tipo_equipo,
          e.direccion_ip,
          e.mac_address,
          e.fecha_compra,
          e.fecha_garantia_fin,
          e.tiene_factura,
          e.numero_factura,
          e.observacion_factura,
          e.estado_activo,
          e.eliminado_logico,
          e.observaciones,
          e.fecha_creacion,

          se.id_sala_equipo,
          se.fecha_instalacion,
          se.ubicacion_en_sala,
          se.es_principal,
          se.estado_asignacion,

          s.id_sala,
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          ed.nombre AS edificio,

          CASE
            WHEN e.estado_activo = 'BAJA' OR e.eliminado_logico = TRUE THEN 'BAJA'
            WHEN se.id_sala_equipo IS NULL THEN 'NO_ASIGNADO'
            ELSE 'ASIGNADO'
          END AS estado_asignacion_actual

      FROM equipo e

      INNER JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo

      LEFT JOIN sala_equipo se
          ON e.id_equipo = se.id_equipo
          AND se.estado_asignacion = 'ACTIVA'

      LEFT JOIN sala s
          ON se.id_sala = s.id_sala

      LEFT JOIN edificio ed
          ON s.id_edificio = ed.id_edificio

      ORDER BY
          CASE
            WHEN e.estado_activo = 'BAJA' OR e.eliminado_logico = TRUE THEN 2
            ELSE 1
          END,
          estado_asignacion_actual,
          te.nombre,
          e.nombre_equipo
      `,
    );

    return res.json({
      ok: true,
      total: equipos.length,
      data: equipos,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar equipos.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: registrarEquipo
DESCRIPCION:
Registra un equipo nuevo en inventario. El equipo queda sin asignacion a sala
hasta que se cree una asignacion activa en sala_equipo.

AUDITORIA:
La tabla equipo tiene trigger MySQL de auditoria para INSERT, por lo que este
registro queda trazado automaticamente en auditoria_log.
==============================================================================
*/
exports.registrarEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      codigo_inventario,
      nro_serie,
      nombre_equipo,
      marca,
      modelo,
      id_tipo_equipo,
      direccion_ip,
      mac_address,
      fecha_compra,
      fecha_garantia_fin,
      tiene_factura,
      numero_factura,
      observacion_factura,
      estado_activo,
      observaciones,
    } = req.body;

    const id_usuario_creacion = req.usuario.id_usuario;

    const nombreFinal = nombre_equipo ? nombre_equipo.trim() : "";
    const codigoFinal = codigo_inventario ? codigo_inventario.trim() : null;
    const serieFinal = nro_serie ? nro_serie.trim() : null;
    const marcaFinal = marca ? marca.trim() : null;
    const modeloFinal = modelo ? modelo.trim() : null;
    const ipFinal = direccion_ip ? direccion_ip.trim() : null;
    const macFinal = mac_address ? mac_address.trim() : null;
    const tieneFacturaFinal = Boolean(tiene_factura);
    const numeroFacturaFinal =
      tieneFacturaFinal && numero_factura ? numero_factura.trim() : null;
    const observacionFacturaFinal =
      tieneFacturaFinal && observacion_factura
        ? observacion_factura.trim()
        : null;
    const observacionesFinal = observaciones ? observaciones.trim() : null;
    const estadoFinal = estado_activo || "OPERATIVO";

    if (!nombreFinal || nombreFinal.length < 3) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un nombre de equipo de al menos 3 caracteres.",
      });
    }

    if (nombreFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El nombre del equipo no puede superar los 100 caracteres.",
      });
    }

    if (!id_tipo_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar el tipo de equipo.",
      });
    }

    const estadosPermitidos = [
      "OPERATIVO",
      "CON_FALLA",
      "FUERA_SERVICIO",
      "BAJA",
    ];

    if (!estadosPermitidos.includes(estadoFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El estado del equipo no es valido.",
      });
    }

    if (codigoFinal && codigoFinal.length > 50) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El codigo de inventario no puede superar los 50 caracteres.",
      });
    }

    if (serieFinal && serieFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El numero de serie no puede superar los 100 caracteres.",
      });
    }

    if (marcaFinal && marcaFinal.length > 80) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La marca no puede superar los 80 caracteres.",
      });
    }

    if (modeloFinal && modeloFinal.length > 80) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El modelo no puede superar los 80 caracteres.",
      });
    }

    if (ipFinal && ipFinal.length > 45) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La direccion IP no puede superar los 45 caracteres.",
      });
    }

    if (macFinal && !/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(macFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La direccion MAC debe usar formato XX:XX:XX:XX:XX:XX.",
      });
    }

    if (tieneFacturaFinal && !numeroFacturaFinal) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar el numero de factura del equipo.",
      });
    }

    if (numeroFacturaFinal && numeroFacturaFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El numero de factura no puede superar los 100 caracteres.",
      });
    }

    if (observacionFacturaFinal && observacionFacturaFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion de factura no puede superar los 500 caracteres.",
      });
    }

    if (observacionesFinal && observacionesFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Las observaciones no pueden superar los 500 caracteres.",
      });
    }

    const [tipos] = await connection.query(
      `
      SELECT id_tipo_equipo, nombre
      FROM tipo_equipo
      WHERE id_tipo_equipo = ?
        AND activo = TRUE
      LIMIT 1
      `,
      [id_tipo_equipo],
    );

    if (tipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El tipo de equipo seleccionado no existe o esta inactivo.",
      });
    }

    if (codigoFinal) {
      const [codigos] = await connection.query(
        `
        SELECT id_equipo
        FROM equipo
        WHERE codigo_inventario = ?
        LIMIT 1
        `,
        [codigoFinal],
      );

      if (codigos.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Ya existe un equipo con ese codigo de inventario.",
        });
      }
    }

    if (serieFinal) {
      const [series] = await connection.query(
        `
        SELECT id_equipo
        FROM equipo
        WHERE nro_serie = ?
        LIMIT 1
        `,
        [serieFinal],
      );

      if (series.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Ya existe un equipo con ese numero de serie.",
        });
      }
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO equipo
      (
        codigo_inventario,
        nro_serie,
        nombre_equipo,
        marca,
        modelo,
        id_tipo_equipo,
        direccion_ip,
        mac_address,
        fecha_compra,
        fecha_garantia_fin,
        tiene_factura,
        numero_factura,
        observacion_factura,
        estado_activo,
        observaciones,
        eliminado_logico,
        id_usuario_creacion,
        id_usuario_actualizacion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
      `,
      [
        codigoFinal,
        serieFinal,
        nombreFinal,
        marcaFinal,
        modeloFinal,
        id_tipo_equipo,
        ipFinal,
        macFinal,
        fecha_compra || null,
        fecha_garantia_fin || null,
        tieneFacturaFinal,
        numeroFacturaFinal,
        observacionFacturaFinal,
        estadoFinal,
        observacionesFinal,
        id_usuario_creacion,
        id_usuario_creacion,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Equipo registrado correctamente.",
      data: {
        id_equipo: resultado.insertId,
        codigo_inventario: codigoFinal,
        nombre_equipo: nombreFinal,
        tipo_equipo: tipos[0].nombre,
        estado_activo: estadoFinal,
        estado_asignacion_actual: "NO_ASIGNADO",
      },
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        ok: false,
        message:
          "Ya existe un equipo registrado con el codigo de inventario o numero de serie ingresado.",
      });
    }

    if (error.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
      return res.status(400).json({
        ok: false,
        message:
          "Los datos ingresados no cumplen las restricciones definidas para el equipo.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Error al registrar equipo.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: actualizarEquipo
DESCRIPCION:
Actualiza datos generales de un equipo existente sin alterar su asignacion a
sala. La auditoria queda registrada por el trigger MySQL de UPDATE en equipo.
==============================================================================
*/
exports.actualizarEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_equipo } = req.params;

    const {
      codigo_inventario,
      nro_serie,
      nombre_equipo,
      marca,
      modelo,
      id_tipo_equipo,
      direccion_ip,
      mac_address,
      fecha_compra,
      fecha_garantia_fin,
      tiene_factura,
      numero_factura,
      observacion_factura,
      estado_activo,
      observaciones,
    } = req.body;

    const id_usuario_actualizacion = req.usuario.id_usuario;

    const nombreFinal = nombre_equipo ? nombre_equipo.trim() : "";
    const codigoFinal = codigo_inventario ? codigo_inventario.trim() : null;
    const serieFinal = nro_serie ? nro_serie.trim() : null;
    const marcaFinal = marca ? marca.trim() : null;
    const modeloFinal = modelo ? modelo.trim() : null;
    const ipFinal = direccion_ip ? direccion_ip.trim() : null;
    const macFinal = mac_address ? mac_address.trim() : null;
    const tieneFacturaFinal = Boolean(tiene_factura);
    const numeroFacturaFinal =
      tieneFacturaFinal && numero_factura ? numero_factura.trim() : null;
    const observacionFacturaFinal =
      tieneFacturaFinal && observacion_factura
        ? observacion_factura.trim()
        : null;
    const observacionesFinal = observaciones ? observaciones.trim() : null;
    const estadoFinal = estado_activo || "OPERATIVO";

    if (!id_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el equipo a actualizar.",
      });
    }

    const [equipos] = await connection.query(
      `
      SELECT id_equipo
      FROM equipo
      WHERE id_equipo = ?
        AND eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_equipo],
    );

    if (equipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El equipo solicitado no existe o se encuentra deshabilitado.",
      });
    }

    if (!nombreFinal || nombreFinal.length < 3) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un nombre de equipo de al menos 3 caracteres.",
      });
    }

    if (nombreFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El nombre del equipo no puede superar los 100 caracteres.",
      });
    }

    if (!id_tipo_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar el tipo de equipo.",
      });
    }

    const estadosPermitidos = [
      "OPERATIVO",
      "CON_FALLA",
      "FUERA_SERVICIO",
      "BAJA",
    ];

    if (!estadosPermitidos.includes(estadoFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El estado del equipo no es valido.",
      });
    }

    if (codigoFinal && codigoFinal.length > 50) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El codigo de inventario no puede superar los 50 caracteres.",
      });
    }

    if (serieFinal && serieFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El numero de serie no puede superar los 100 caracteres.",
      });
    }

    if (marcaFinal && marcaFinal.length > 80) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La marca no puede superar los 80 caracteres.",
      });
    }

    if (modeloFinal && modeloFinal.length > 80) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El modelo no puede superar los 80 caracteres.",
      });
    }

    if (ipFinal && ipFinal.length > 45) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La direccion IP no puede superar los 45 caracteres.",
      });
    }

    if (macFinal && !/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(macFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La direccion MAC debe usar formato XX:XX:XX:XX:XX:XX.",
      });
    }

    if (tieneFacturaFinal && !numeroFacturaFinal) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar el numero de factura del equipo.",
      });
    }

    if (numeroFacturaFinal && numeroFacturaFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El numero de factura no puede superar los 100 caracteres.",
      });
    }

    if (observacionFacturaFinal && observacionFacturaFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion de factura no puede superar los 500 caracteres.",
      });
    }

    if (observacionesFinal && observacionesFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Las observaciones no pueden superar los 500 caracteres.",
      });
    }

    const [tipos] = await connection.query(
      `
      SELECT id_tipo_equipo, nombre
      FROM tipo_equipo
      WHERE id_tipo_equipo = ?
        AND activo = TRUE
      LIMIT 1
      `,
      [id_tipo_equipo],
    );

    if (tipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El tipo de equipo seleccionado no existe o esta inactivo.",
      });
    }

    if (codigoFinal) {
      const [codigos] = await connection.query(
        `
        SELECT id_equipo
        FROM equipo
        WHERE codigo_inventario = ?
          AND id_equipo <> ?
        LIMIT 1
        `,
        [codigoFinal, id_equipo],
      );

      if (codigos.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Ya existe otro equipo con ese codigo de inventario.",
        });
      }
    }

    if (serieFinal) {
      const [series] = await connection.query(
        `
        SELECT id_equipo
        FROM equipo
        WHERE nro_serie = ?
          AND id_equipo <> ?
        LIMIT 1
        `,
        [serieFinal, id_equipo],
      );

      if (series.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Ya existe otro equipo con ese numero de serie.",
        });
      }
    }

    await connection.query(
      `
      UPDATE equipo
      SET
          codigo_inventario = ?,
          nro_serie = ?,
          nombre_equipo = ?,
          marca = ?,
          modelo = ?,
          id_tipo_equipo = ?,
          direccion_ip = ?,
          mac_address = ?,
          fecha_compra = ?,
          fecha_garantia_fin = ?,
          tiene_factura = ?,
          numero_factura = ?,
          observacion_factura = ?,
          estado_activo = ?,
          observaciones = ?,
          id_usuario_actualizacion = ?
      WHERE id_equipo = ?
      `,
      [
        codigoFinal,
        serieFinal,
        nombreFinal,
        marcaFinal,
        modeloFinal,
        id_tipo_equipo,
        ipFinal,
        macFinal,
        fecha_compra || null,
        fecha_garantia_fin || null,
        tieneFacturaFinal,
        numeroFacturaFinal,
        observacionFacturaFinal,
        estadoFinal,
        observacionesFinal,
        id_usuario_actualizacion,
        id_equipo,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Equipo actualizado correctamente.",
      data: {
        id_equipo: Number(id_equipo),
        codigo_inventario: codigoFinal,
        nombre_equipo: nombreFinal,
        tipo_equipo: tipos[0].nombre,
        estado_activo: estadoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar equipo.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: obtenerHistorialEquipo
DESCRIPCION:
Obtiene la trazabilidad tecnica de un equipo usando auditoria_log.
No crea datos nuevos; solo presenta los eventos registrados por la base.
==============================================================================
*/
exports.obtenerHistorialEquipo = async (req, res) => {
  try {
    const { id_equipo } = req.params;

    if (!id_equipo) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el equipo.",
      });
    }

    const [equipos] = await pool.query(
      `
      SELECT id_equipo
      FROM equipo
      WHERE id_equipo = ?
      LIMIT 1
      `,
      [id_equipo],
    );

    if (equipos.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "El equipo solicitado no existe o se encuentra deshabilitado.",
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
          al.tabla_afectada = 'equipo'
          AND al.id_registro_afectado = ?
        )
        OR
        (
          al.tabla_afectada = 'sala_equipo'
          AND (
            JSON_UNQUOTE(JSON_EXTRACT(al.valor_nuevo, '$.id_equipo')) = ?
            OR JSON_UNQUOTE(JSON_EXTRACT(al.valor_anterior, '$.id_equipo')) = ?
          )
        )
      ORDER BY al.fecha_evento ASC
      `,
      [id_equipo, id_equipo, id_equipo],
    );

    return res.json({
      ok: true,
      total: historial.length,
      data: historial,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial del equipo.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: asignarEquipoSala
DESCRIPCION:
Asigna un equipo sin asignacion activa a una sala. La asignacion queda registrada
en sala_equipo y el inventario pasa a estado ASIGNADO en las consultas.
==============================================================================
*/
exports.asignarEquipoSala = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_equipo } = req.params;
    const {
      id_sala,
      fecha_instalacion,
      ubicacion_en_sala,
      es_principal,
      observaciones,
    } = req.body;

    const id_usuario_creacion = req.usuario.id_usuario;
    const ubicacionFinal = ubicacion_en_sala
      ? ubicacion_en_sala.trim()
      : null;
    const observacionesFinal = observaciones ? observaciones.trim() : null;

    if (!id_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el equipo a asignar.",
      });
    }

    if (!id_sala) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar la sala de destino.",
      });
    }

    if (ubicacionFinal && ubicacionFinal.length > 150) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La ubicacion en sala no puede superar los 150 caracteres.",
      });
    }

    if (observacionesFinal && observacionesFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Las observaciones no pueden superar los 500 caracteres.",
      });
    }

    const [equipos] = await connection.query(
      `
      SELECT id_equipo, nombre_equipo, estado_activo
      FROM equipo
      WHERE id_equipo = ?
        AND eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_equipo],
    );

    if (equipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El equipo solicitado no existe o se encuentra deshabilitado.",
      });
    }

    if (equipos[0].estado_activo !== "OPERATIVO") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "Solo equipos en estado OPERATIVO pueden ser asignados a una sala.",
      });
    }

    const [asignacionesActivas] = await connection.query(
      `
      SELECT id_sala_equipo
      FROM sala_equipo
      WHERE id_equipo = ?
        AND estado_asignacion = 'ACTIVA'
      LIMIT 1
      `,
      [id_equipo],
    );

    if (asignacionesActivas.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El equipo ya tiene una asignacion activa a sala.",
      });
    }

    const [salas] = await connection.query(
      `
      SELECT id_sala, codigo, nombre
      FROM sala
      WHERE id_sala = ?
        AND eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_sala],
    );

    if (salas.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La sala seleccionada no existe o se encuentra inactiva.",
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO sala_equipo
      (
        id_sala,
        id_equipo,
        fecha_instalacion,
        ubicacion_en_sala,
        es_principal,
        estado_asignacion,
        observaciones,
        id_usuario_creacion,
        id_usuario_actualizacion
      )
      VALUES (?, ?, ?, ?, ?, 'ACTIVA', ?, ?, ?)
      `,
      [
        id_sala,
        id_equipo,
        fecha_instalacion || new Date(),
        ubicacionFinal,
        Boolean(es_principal),
        observacionesFinal,
        id_usuario_creacion,
        id_usuario_creacion,
      ],
    );

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
      VALUES
      (
        ?,
        'sala_equipo',
        ?,
        'INSERT',
        'Asignacion de equipo a sala.',
        JSON_OBJECT(
          'id_equipo', ?,
          'nombre_equipo', ?,
          'id_sala', ?,
          'codigo_sala', ?,
          'sala', ?,
          'ubicacion_en_sala', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_creacion,
        resultado.insertId,
        id_equipo,
        equipos[0].nombre_equipo,
        id_sala,
        salas[0].codigo,
        salas[0].nombre,
        ubicacionFinal,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Equipo asignado a sala correctamente.",
      data: {
        id_sala_equipo: resultado.insertId,
        id_equipo: Number(id_equipo),
        id_sala: Number(id_sala),
        codigo_sala: salas[0].codigo,
        sala: salas[0].nombre,
        estado_asignacion_actual: "ASIGNADO",
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al asignar equipo a sala.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: retirarEquipoSala
DESCRIPCION:
Retira la asignacion activa de un equipo a sala. No elimina historial: marca la
asignacion como RETIRADA y el equipo vuelve a aparecer como NO_ASIGNADO.
==============================================================================
*/
exports.retirarEquipoSala = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_equipo } = req.params;
    const { fecha_retiro, motivo_retiro } = req.body;

    const id_usuario_actualizacion = req.usuario.id_usuario;
    const motivoFinal = motivo_retiro ? motivo_retiro.trim() : "";

    if (!id_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el equipo a retirar.",
      });
    }

    if (motivoFinal.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un motivo de retiro de al menos 5 caracteres.",
      });
    }

    if (motivoFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El motivo de retiro no puede superar los 500 caracteres.",
      });
    }

    const [asignaciones] = await connection.query(
      `
      SELECT
          se.id_sala_equipo,
          se.id_sala,
          se.fecha_instalacion,
          se.ubicacion_en_sala,
          e.nombre_equipo,
          s.codigo AS codigo_sala,
          s.nombre AS sala
      FROM sala_equipo se
      INNER JOIN equipo e
          ON se.id_equipo = e.id_equipo
      INNER JOIN sala s
          ON se.id_sala = s.id_sala
      WHERE se.id_equipo = ?
        AND se.estado_asignacion = 'ACTIVA'
      LIMIT 1
      `,
      [id_equipo],
    );

    if (asignaciones.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El equipo no tiene una asignacion activa a sala.",
      });
    }

    const asignacion = asignaciones[0];

    await connection.query(
      `
      UPDATE sala_equipo
      SET
          estado_asignacion = 'RETIRADA',
          fecha_retiro = ?,
          observaciones = ?,
          id_usuario_actualizacion = ?
      WHERE id_sala_equipo = ?
      `,
      [
        fecha_retiro || new Date(),
        motivoFinal,
        id_usuario_actualizacion,
        asignacion.id_sala_equipo,
      ],
    );

    await connection.query(
      `
      INSERT INTO auditoria_log
      (
        id_usuario,
        tabla_afectada,
        id_registro_afectado,
        accion,
        descripcion,
        valor_anterior,
        valor_nuevo,
        user_agent
      )
      VALUES
      (
        ?,
        'sala_equipo',
        ?,
        'UPDATE',
        'Retiro de equipo desde sala.',
        JSON_OBJECT(
          'estado_asignacion', 'ACTIVA',
          'id_equipo', ?,
          'id_sala', ?,
          'nombre_equipo', ?,
          'codigo_sala', ?,
          'sala', ?,
          'ubicacion_en_sala', ?
        ),
        JSON_OBJECT(
          'estado_asignacion', 'RETIRADA',
          'id_equipo', ?,
          'id_sala', ?,
          'nombre_equipo', ?,
          'codigo_sala', ?,
          'sala', ?,
          'fecha_retiro', ?,
          'motivo_retiro', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_actualizacion,
        asignacion.id_sala_equipo,
        id_equipo,
        asignacion.id_sala,
        asignacion.nombre_equipo,
        asignacion.codigo_sala,
        asignacion.sala,
        asignacion.ubicacion_en_sala,
        id_equipo,
        asignacion.id_sala,
        asignacion.nombre_equipo,
        asignacion.codigo_sala,
        asignacion.sala,
        fecha_retiro || null,
        motivoFinal,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Equipo retirado de sala correctamente.",
      data: {
        id_equipo: Number(id_equipo),
        id_sala_equipo: asignacion.id_sala_equipo,
        estado_asignacion_actual: "NO_ASIGNADO",
        motivo_retiro: motivoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al retirar equipo de sala.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: listarBajasEquipo
DESCRIPCION:
Lista solicitudes de baja de equipos con datos del equipo y usuarios asociados.
==============================================================================
*/
exports.listarBajasEquipo = async (req, res) => {
  try {
    const [bajas] = await pool.query(
      `
      SELECT
          b.id_baja_equipo,
          b.id_equipo,
          e.codigo_inventario,
          e.nombre_equipo,
          te.nombre AS tipo_equipo,
          b.motivo_baja,
          b.observacion_tecnica,
          b.documento_respaldo,
          b.estado_baja,
          b.fecha_solicitud,
          b.fecha_aprobacion,
          b.fecha_ejecucion,
          CONCAT(us.nombres, ' ', us.apellidos) AS usuario_solicita,
          CONCAT(ua.nombres, ' ', ua.apellidos) AS usuario_aprueba,
          CONCAT(ue.nombres, ' ', ue.apellidos) AS usuario_ejecuta
      FROM baja_equipo b
      INNER JOIN equipo e
          ON b.id_equipo = e.id_equipo
      INNER JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo
      INNER JOIN usuario us
          ON b.id_usuario_solicita = us.id_usuario
      LEFT JOIN usuario ua
          ON b.id_usuario_aprueba = ua.id_usuario
      LEFT JOIN usuario ue
          ON b.id_usuario_ejecuta = ue.id_usuario
      ORDER BY b.fecha_solicitud DESC
      `,
    );

    return res.json({
      ok: true,
      total: bajas.length,
      data: bajas,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar solicitudes de baja.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: obtenerHistorialBajaEquipo
DESCRIPCION:
Obtiene la trazabilidad completa de una solicitud de baja. Combina el estado
administrativo guardado en baja_equipo con los eventos registrados en auditoria.
==============================================================================
*/
exports.obtenerHistorialBajaEquipo = async (req, res) => {
  try {
    const { id_baja_equipo } = req.params;

    if (!id_baja_equipo) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la solicitud de baja.",
      });
    }

    const [bajas] = await pool.query(
      `
      SELECT
          b.id_baja_equipo,
          b.id_equipo,
          e.codigo_inventario,
          e.nombre_equipo,
          te.nombre AS tipo_equipo,
          b.motivo_baja,
          b.observacion_tecnica,
          b.documento_respaldo,
          b.estado_baja,
          b.fecha_solicitud,
          b.fecha_aprobacion,
          b.fecha_ejecucion,
          b.fecha_actualizacion,
          CONCAT(us.nombres, ' ', us.apellidos) AS usuario_solicita,
          CONCAT(ua.nombres, ' ', ua.apellidos) AS usuario_aprueba,
          CONCAT(ue.nombres, ' ', ue.apellidos) AS usuario_ejecuta
      FROM baja_equipo b
      INNER JOIN equipo e
          ON b.id_equipo = e.id_equipo
      INNER JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo
      INNER JOIN usuario us
          ON b.id_usuario_solicita = us.id_usuario
      LEFT JOIN usuario ua
          ON b.id_usuario_aprueba = ua.id_usuario
      LEFT JOIN usuario ue
          ON b.id_usuario_ejecuta = ue.id_usuario
      WHERE b.id_baja_equipo = ?
      LIMIT 1
      `,
      [id_baja_equipo],
    );

    if (bajas.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "La solicitud de baja no existe.",
      });
    }

    const [auditoria] = await pool.query(
      `
      SELECT
          al.id_auditoria,
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
      WHERE al.tabla_afectada = 'baja_equipo'
        AND al.id_registro_afectado = ?
      ORDER BY al.fecha_evento ASC
      `,
      [id_baja_equipo],
    );

    return res.json({
      ok: true,
      data: {
        baja: bajas[0],
        auditoria,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial de baja.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: solicitarBajaEquipo
DESCRIPCION:
Registra una solicitud formal de baja para un equipo. No ejecuta la baja ni
modifica el inventario; solo inicia el flujo administrativo.
==============================================================================
*/
exports.solicitarBajaEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_equipo } = req.params;
    const {
      motivo_baja,
      observacion_tecnica,
      documento_respaldo,
    } = req.body;

    const id_usuario_solicita = req.usuario.id_usuario;
    const motivoFinal = motivo_baja ? motivo_baja.trim() : "";
    const observacionFinal = observacion_tecnica
      ? observacion_tecnica.trim()
      : null;
    const documentoFinal = documento_respaldo
      ? documento_respaldo.trim()
      : null;

    if (!id_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el equipo para solicitar baja.",
      });
    }

    if (motivoFinal.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un motivo de baja de al menos 5 caracteres.",
      });
    }

    if (motivoFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El motivo de baja no puede superar los 500 caracteres.",
      });
    }

    if (observacionFinal && observacionFinal.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion tecnica no puede superar los 1000 caracteres.",
      });
    }

    if (documentoFinal && documentoFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El documento de respaldo no puede superar los 500 caracteres.",
      });
    }

    const [equipos] = await connection.query(
      `
      SELECT id_equipo, nombre_equipo, estado_activo
      FROM equipo
      WHERE id_equipo = ?
        AND eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_equipo],
    );

    if (equipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El equipo solicitado no existe o se encuentra deshabilitado.",
      });
    }

    if (equipos[0].estado_activo === "BAJA") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El equipo ya se encuentra dado de baja.",
      });
    }

    const [bajasPendientes] = await connection.query(
      `
      SELECT id_baja_equipo, estado_baja
      FROM baja_equipo
      WHERE id_equipo = ?
        AND estado_baja IN ('SOLICITADA', 'APROBADA')
      LIMIT 1
      `,
      [id_equipo],
    );

    if (bajasPendientes.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El equipo ya tiene una solicitud de baja pendiente.",
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO baja_equipo
      (
        id_equipo,
        id_usuario_solicita,
        motivo_baja,
        observacion_tecnica,
        documento_respaldo,
        estado_baja
      )
      VALUES (?, ?, ?, ?, ?, 'SOLICITADA')
      `,
      [
        id_equipo,
        id_usuario_solicita,
        motivoFinal,
        observacionFinal,
        documentoFinal,
      ],
    );

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
      VALUES
      (
        ?,
        'baja_equipo',
        ?,
        'BAJA_EQUIPO',
        'Solicitud formal de baja de equipo.',
        JSON_OBJECT(
          'id_equipo', ?,
          'nombre_equipo', ?,
          'motivo_baja', ?,
          'estado_baja', 'SOLICITADA'
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_solicita,
        resultado.insertId,
        id_equipo,
        equipos[0].nombre_equipo,
        motivoFinal,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Solicitud de baja registrada correctamente.",
      data: {
        id_baja_equipo: resultado.insertId,
        id_equipo: Number(id_equipo),
        estado_baja: "SOLICITADA",
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al solicitar baja de equipo.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: decidirBajaEquipo
DESCRIPCION:
Aprueba o rechaza una solicitud de baja. No ejecuta la baja del equipo; solo
resuelve la etapa administrativa de revision de la solicitud.
==============================================================================
*/
exports.decidirBajaEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_baja_equipo } = req.params;
    const { decision, observacion_decision } = req.body;
    const id_usuario_aprueba = req.usuario.id_usuario;

    const decisionFinal = decision ? decision.trim() : "";
    const observacionFinal = observacion_decision
      ? observacion_decision.trim()
      : null;

    if (!id_baja_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la solicitud de baja.",
      });
    }

    if (!["APROBADA", "RECHAZADA"].includes(decisionFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La decision de baja no es valida.",
      });
    }

    if (
      decisionFinal === "RECHAZADA" &&
      (!observacionFinal || observacionFinal.length < 5)
    ) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un motivo de rechazo de al menos 5 caracteres.",
      });
    }

    if (observacionFinal && observacionFinal.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion de decision no puede superar los 1000 caracteres.",
      });
    }

    const [bajas] = await connection.query(
      `
      SELECT
          b.id_baja_equipo,
          b.id_equipo,
          b.estado_baja,
          b.observacion_tecnica,
          e.nombre_equipo
      FROM baja_equipo b
      INNER JOIN equipo e
          ON b.id_equipo = e.id_equipo
      WHERE b.id_baja_equipo = ?
      LIMIT 1
      `,
      [id_baja_equipo],
    );

    if (bajas.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La solicitud de baja no existe.",
      });
    }

    const baja = bajas[0];

    if (baja.estado_baja !== "SOLICITADA") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Solo se pueden resolver solicitudes en estado SOLICITADA.",
      });
    }

    const observacionActualizada = observacionFinal
      ? baja.observacion_tecnica
        ? `${baja.observacion_tecnica}\nDecision: ${observacionFinal}`
        : `Decision: ${observacionFinal}`
      : baja.observacion_tecnica;

    await connection.query(
      `
      UPDATE baja_equipo
      SET
          id_usuario_aprueba = ?,
          fecha_aprobacion = CASE WHEN ? = 'APROBADA' THEN NOW() ELSE fecha_aprobacion END,
          estado_baja = ?,
          observacion_tecnica = ?
      WHERE id_baja_equipo = ?
      `,
      [
        id_usuario_aprueba,
        decisionFinal,
        decisionFinal,
        observacionActualizada,
        id_baja_equipo,
      ],
    );

    await connection.query(
      `
      INSERT INTO auditoria_log
      (
        id_usuario,
        tabla_afectada,
        id_registro_afectado,
        accion,
        descripcion,
        valor_anterior,
        valor_nuevo,
        user_agent
      )
      VALUES
      (
        ?,
        'baja_equipo',
        ?,
        'BAJA_EQUIPO',
        'Decision administrativa sobre solicitud de baja.',
        JSON_OBJECT(
          'estado_baja', ?,
          'id_equipo', ?,
          'nombre_equipo', ?
        ),
        JSON_OBJECT(
          'estado_baja', ?,
          'observacion_decision', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_aprueba,
        id_baja_equipo,
        baja.estado_baja,
        baja.id_equipo,
        baja.nombre_equipo,
        decisionFinal,
        observacionFinal,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message:
        decisionFinal === "APROBADA"
          ? "Solicitud de baja aprobada correctamente."
          : "Solicitud de baja rechazada correctamente.",
      data: {
        id_baja_equipo: Number(id_baja_equipo),
        estado_baja: decisionFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al resolver solicitud de baja.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: ejecutarBajaEquipo
DESCRIPCION:
Ejecuta una baja previamente aprobada. Marca el equipo como BAJA, aplica
eliminado logico y retira cualquier asignacion activa a sala.
==============================================================================
*/
exports.ejecutarBajaEquipo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_baja_equipo } = req.params;
    const { observacion_ejecucion } = req.body;
    const id_usuario_ejecuta = req.usuario.id_usuario;
    const observacionFinal = observacion_ejecucion
      ? observacion_ejecucion.trim()
      : null;

    if (!id_baja_equipo) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la solicitud de baja a ejecutar.",
      });
    }

    if (observacionFinal && observacionFinal.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion de ejecucion no puede superar los 1000 caracteres.",
      });
    }

    const [bajas] = await connection.query(
      `
      SELECT
          b.id_baja_equipo,
          b.id_equipo,
          b.estado_baja,
          b.observacion_tecnica,
          e.nombre_equipo,
          e.estado_activo,
          e.eliminado_logico
      FROM baja_equipo b
      INNER JOIN equipo e
          ON b.id_equipo = e.id_equipo
      WHERE b.id_baja_equipo = ?
      LIMIT 1
      `,
      [id_baja_equipo],
    );

    if (bajas.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La solicitud de baja no existe.",
      });
    }

    const baja = bajas[0];

    if (baja.estado_baja !== "APROBADA") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Solo se pueden ejecutar solicitudes aprobadas.",
      });
    }

    if (baja.estado_activo === "BAJA" || baja.eliminado_logico) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El equipo ya se encuentra dado de baja.",
      });
    }

    const observacionActualizada = observacionFinal
      ? baja.observacion_tecnica
        ? `${baja.observacion_tecnica}\nEjecucion: ${observacionFinal}`
        : `Ejecucion: ${observacionFinal}`
      : baja.observacion_tecnica;

    await connection.query(
      `
      UPDATE baja_equipo
      SET
          id_usuario_ejecuta = ?,
          fecha_ejecucion = NOW(),
          estado_baja = 'EJECUTADA',
          observacion_tecnica = ?
      WHERE id_baja_equipo = ?
      `,
      [id_usuario_ejecuta, observacionActualizada, id_baja_equipo],
    );

    await connection.query(
      `
      UPDATE equipo
      SET
          estado_activo = 'BAJA',
          eliminado_logico = TRUE,
          id_usuario_actualizacion = ?
      WHERE id_equipo = ?
      `,
      [id_usuario_ejecuta, baja.id_equipo],
    );

    await connection.query(
      `
      UPDATE sala_equipo
      SET
          estado_asignacion = 'RETIRADA',
          fecha_retiro = COALESCE(fecha_retiro, CURDATE()),
          observaciones = COALESCE(observaciones, 'Retiro automatico por baja ejecutada.'),
          id_usuario_actualizacion = ?
      WHERE id_equipo = ?
        AND estado_asignacion = 'ACTIVA'
      `,
      [id_usuario_ejecuta, baja.id_equipo],
    );

    await connection.query(
      `
      INSERT INTO auditoria_log
      (
        id_usuario,
        tabla_afectada,
        id_registro_afectado,
        accion,
        descripcion,
        valor_anterior,
        valor_nuevo,
        user_agent
      )
      VALUES
      (
        ?,
        'baja_equipo',
        ?,
        'BAJA_EQUIPO',
        'Ejecucion formal de baja de equipo.',
        JSON_OBJECT(
          'estado_baja', ?,
          'estado_activo', ?,
          'eliminado_logico', ?
        ),
        JSON_OBJECT(
          'estado_baja', 'EJECUTADA',
          'estado_activo', 'BAJA',
          'eliminado_logico', TRUE,
          'id_equipo', ?,
          'nombre_equipo', ?,
          'observacion_ejecucion', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_ejecuta,
        id_baja_equipo,
        baja.estado_baja,
        baja.estado_activo,
        Boolean(baja.eliminado_logico),
        baja.id_equipo,
        baja.nombre_equipo,
        observacionFinal,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Baja de equipo ejecutada correctamente.",
      data: {
        id_baja_equipo: Number(id_baja_equipo),
        id_equipo: baja.id_equipo,
        estado_baja: "EJECUTADA",
        estado_activo: "BAJA",
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al ejecutar baja de equipo.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
