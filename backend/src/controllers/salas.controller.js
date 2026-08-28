// Controlador del modulo de salas.
// Entrega una vista operativa de salas, equipos asignados, incidencias y revisiones.

const pool = require("../config/db");

exports.listarSalas = async (req, res) => {
  try {
    const [salas] = await pool.query(`
      SELECT
          s.id_sala,
          s.codigo,
          s.nombre,
          s.piso,
          s.capacidad,
          s.ubicacion_detalle,
          s.estado_sala,
          s.permite_reserva,
          s.observaciones,
          s.fecha_creacion,
          e.id_edificio,
          e.nombre AS edificio,
          e.campus,
          ts.id_tipo_sala,
          ts.nombre AS tipo_sala,
          COALESCE(eq.total_equipos_asignados, 0) AS total_equipos_asignados,
          COALESCE(inc.total_incidencias, 0) AS total_incidencias,
          COALESCE(inc.incidencias_abiertas, 0) AS incidencias_abiertas,
          rev.ultima_revision,
          CASE
            WHEN rev.ultima_revision IS NULL THEN 'SIN_REVISION'
            WHEN YEARWEEK(rev.ultima_revision, 1) = YEARWEEK(CURDATE(), 1) THEN 'AL_DIA'
            ELSE 'PENDIENTE'
          END AS estado_revision_semanal
      FROM sala s
      INNER JOIN edificio e
          ON s.id_edificio = e.id_edificio
      INNER JOIN tipo_sala ts
          ON s.id_tipo_sala = ts.id_tipo_sala
      LEFT JOIN (
          SELECT
              se.id_sala,
              COUNT(se.id_equipo) AS total_equipos_asignados
          FROM sala_equipo se
          INNER JOIN equipo eq
              ON se.id_equipo = eq.id_equipo
          WHERE se.estado_asignacion = 'ACTIVA'
            AND eq.eliminado_logico = FALSE
            AND eq.estado_activo <> 'BAJA'
          GROUP BY se.id_sala
      ) eq
          ON s.id_sala = eq.id_sala
      LEFT JOIN (
          SELECT
              i.id_sala,
              COUNT(i.id_incidencia) AS total_incidencias,
              SUM(
                CASE
                  WHEN ei.nombre NOT IN ('RESUELTA', 'CERRADA') THEN 1
                  ELSE 0
                END
              ) AS incidencias_abiertas
          FROM incidencia i
          INNER JOIN estado_incidencia ei
              ON i.id_estado_incidencia = ei.id_estado_incidencia
          GROUP BY i.id_sala
      ) inc
          ON s.id_sala = inc.id_sala
      LEFT JOIN (
          SELECT
              id_sala,
              MAX(fecha_revision) AS ultima_revision
          FROM revision
          WHERE estado_revision_general <> 'ANULADA'
          GROUP BY id_sala
      ) rev
          ON s.id_sala = rev.id_sala
      WHERE s.eliminado_logico = FALSE
      ORDER BY e.nombre, s.codigo
    `);

    return res.json({
      ok: true,
      total: salas.length,
      data: salas,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar salas.",
      error: error.message,
    });
  }
};

function obtenerBaseFrontend(req) {
  return (
    process.env.FRONTEND_URL ||
    req.headers.origin ||
    "http://localhost:5173"
  );
}

function construirUrlIncidenciaSala(req, codigoSala) {
  const base = obtenerBaseFrontend(req).replace(/\/$/, "");
  return `${base}/incidencias/registrar?sala=${encodeURIComponent(codigoSala)}`;
}

/*
==============================================================================
FUNCION: registrarSala
DESCRIPCION:
Crea una nueva sala o laboratorio para ampliaciones institucionales. Solo
administracion puede ejecutar esta accion y la auditoria queda registrada por
trigger MySQL de INSERT sobre la tabla sala.
==============================================================================
*/
exports.registrarSala = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      codigo,
      nombre,
      piso,
      capacidad,
      id_tipo_sala,
      id_edificio,
      ubicacion_detalle,
      estado_sala,
      permite_reserva,
      observaciones,
    } = req.body;

    const rolesPermitidos = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"];

    if (!rolesPermitidos.includes(req.usuario.nombre_rol)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para registrar salas.",
      });
    }

    const codigoFinal = codigo ? codigo.trim().toUpperCase() : "";
    const nombreFinal = nombre ? nombre.trim() : "";
    const pisoFinal = piso ? piso.trim() : null;
    const ubicacionFinal = ubicacion_detalle ? ubicacion_detalle.trim() : null;
    const observacionesFinal = observaciones ? observaciones.trim() : null;
    const estadoFinal = estado_sala || "ACTIVA";
    const capacidadFinal =
      capacidad === "" || capacidad === null || capacidad === undefined
        ? null
        : Number(capacidad);
    const permiteReservaFinal = Boolean(permite_reserva);

    if (!codigoFinal || codigoFinal.length < 3) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un codigo de sala de al menos 3 caracteres.",
      });
    }

    if (codigoFinal.length > 30) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El codigo de la sala no puede superar los 30 caracteres.",
      });
    }

    if (!nombreFinal || nombreFinal.length < 3) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un nombre de sala de al menos 3 caracteres.",
      });
    }

    if (nombreFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El nombre de la sala no puede superar los 100 caracteres.",
      });
    }

    if (!Number(id_tipo_sala) || !Number(id_edificio)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar edificio y tipo de sala.",
      });
    }

    if (pisoFinal && pisoFinal.length > 20) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El piso no puede superar los 20 caracteres.",
      });
    }

    if (
      capacidadFinal !== null &&
      (!Number.isInteger(capacidadFinal) || capacidadFinal < 0 || capacidadFinal > 999)
    ) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La capacidad debe ser un numero entero entre 0 y 999.",
      });
    }

    if (ubicacionFinal && ubicacionFinal.length > 255) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La ubicacion no puede superar los 255 caracteres.",
      });
    }

    if (observacionesFinal && observacionesFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Las observaciones no pueden superar los 500 caracteres.",
      });
    }

    if (!["ACTIVA", "INACTIVA", "MANTENCION"].includes(estadoFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El estado de la sala no es valido.",
      });
    }

    const [tiposSala] = await connection.query(
      "SELECT id_tipo_sala FROM tipo_sala WHERE id_tipo_sala = ? LIMIT 1",
      [id_tipo_sala],
    );

    if (tiposSala.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El tipo de sala seleccionado no existe.",
      });
    }

    const [edificios] = await connection.query(
      "SELECT id_edificio FROM edificio WHERE id_edificio = ? LIMIT 1",
      [id_edificio],
    );

    if (edificios.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El edificio seleccionado no existe.",
      });
    }

    const [existentes] = await connection.query(
      "SELECT id_sala FROM sala WHERE codigo = ? LIMIT 1",
      [codigoFinal],
    );

    if (existentes.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        message: "Ya existe una sala registrada con ese codigo.",
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO sala (
          codigo,
          nombre,
          piso,
          capacidad,
          id_tipo_sala,
          id_edificio,
          ubicacion_detalle,
          estado_sala,
          permite_reserva,
          observaciones,
          id_usuario_creacion,
          id_usuario_actualizacion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigoFinal,
        nombreFinal,
        pisoFinal,
        capacidadFinal,
        Number(id_tipo_sala),
        Number(id_edificio),
        ubicacionFinal,
        estadoFinal,
        permiteReservaFinal,
        observacionesFinal,
        req.usuario.id_usuario,
        req.usuario.id_usuario,
      ],
    );

    const urlDestinoQr = construirUrlIncidenciaSala(req, codigoFinal);

    await connection.query(
      `
      INSERT INTO sala_qr (
          id_sala,
          codigo_qr,
          url_destino,
          activo,
          id_usuario_creacion,
          id_usuario_actualizacion
      )
      VALUES (?, ?, ?, TRUE, ?, ?)
      `,
      [
        resultado.insertId,
        `QR-${codigoFinal}`,
        urlDestinoQr,
        req.usuario.id_usuario,
        req.usuario.id_usuario,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Sala registrada correctamente.",
      data: {
        id_sala: resultado.insertId,
        codigo: codigoFinal,
        nombre: nombreFinal,
        estado_sala: estadoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una sala registrada con ese codigo.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Error al registrar sala.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: obtenerQrSala
DESCRIPCION:
Obtiene o genera el registro QR de una sala. El destino apunta al formulario de
incidencias con la sala preseleccionada.
==============================================================================
*/
exports.obtenerQrSala = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_sala } = req.params;

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
        message: "La sala solicitada no existe o se encuentra deshabilitada.",
      });
    }

    const sala = salas[0];
    const urlDestino = construirUrlIncidenciaSala(req, sala.codigo);

    const [qrExistente] = await connection.query(
      `
      SELECT
          id_qr,
          codigo_qr,
          url_destino,
          activo,
          fecha_generacion,
          fecha_ultima_regeneracion
      FROM sala_qr
      WHERE id_sala = ?
      LIMIT 1
      `,
      [id_sala],
    );

    if (qrExistente.length === 0) {
      const [resultado] = await connection.query(
        `
        INSERT INTO sala_qr (
            id_sala,
            codigo_qr,
            url_destino,
            activo,
            id_usuario_creacion,
            id_usuario_actualizacion
        )
        VALUES (?, ?, ?, TRUE, ?, ?)
        `,
        [
          id_sala,
          `QR-${sala.codigo}`,
          urlDestino,
          req.usuario.id_usuario,
          req.usuario.id_usuario,
        ],
      );

      await connection.commit();

      return res.status(201).json({
        ok: true,
        message: "QR de sala generado correctamente.",
        data: {
          id_qr: resultado.insertId,
          id_sala: sala.id_sala,
          codigo_sala: sala.codigo,
          sala: sala.nombre,
          codigo_qr: `QR-${sala.codigo}`,
          url_destino: urlDestino,
          activo: true,
        },
      });
    }

    if (qrExistente[0].url_destino !== urlDestino || !qrExistente[0].activo) {
      await connection.query(
        `
        UPDATE sala_qr
        SET url_destino = ?,
            activo = TRUE,
            fecha_ultima_regeneracion = NOW(),
            id_usuario_actualizacion = ?
        WHERE id_qr = ?
        `,
        [urlDestino, req.usuario.id_usuario, qrExistente[0].id_qr],
      );
    }

    await connection.commit();

    return res.json({
      ok: true,
      message: "QR de sala disponible.",
      data: {
        id_qr: qrExistente[0].id_qr,
        id_sala: sala.id_sala,
        codigo_sala: sala.codigo,
        sala: sala.nombre,
        codigo_qr: qrExistente[0].codigo_qr,
        url_destino: urlDestino,
        activo: true,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al obtener QR de sala.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: actualizarSala
DESCRIPCION:
Actualiza antecedentes administrativos de una sala sin modificar relaciones con
equipos, revisiones o incidencias. La auditoria queda registrada por trigger
MySQL de UPDATE sobre la tabla sala.
==============================================================================
*/
exports.actualizarSala = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_sala } = req.params;
    const {
      nombre,
      piso,
      capacidad,
      ubicacion_detalle,
      estado_sala,
      permite_reserva,
      observaciones,
    } = req.body;

    const rolesPermitidos = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"];

    if (!rolesPermitidos.includes(req.usuario.nombre_rol)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para editar salas.",
      });
    }

    if (!id_sala) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la sala a actualizar.",
      });
    }

    const nombreFinal = nombre ? nombre.trim() : "";
    const pisoFinal = piso ? piso.trim() : null;
    const ubicacionFinal = ubicacion_detalle ? ubicacion_detalle.trim() : null;
    const observacionesFinal = observaciones ? observaciones.trim() : null;
    const estadoFinal = estado_sala || "ACTIVA";
    const capacidadFinal =
      capacidad === "" || capacidad === null || capacidad === undefined
        ? null
        : Number(capacidad);
    const permiteReservaFinal = Boolean(permite_reserva);

    if (!nombreFinal || nombreFinal.length < 3) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un nombre de sala de al menos 3 caracteres.",
      });
    }

    if (nombreFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El nombre de la sala no puede superar los 100 caracteres.",
      });
    }

    if (pisoFinal && pisoFinal.length > 20) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El piso no puede superar los 20 caracteres.",
      });
    }

    if (
      capacidadFinal !== null &&
      (!Number.isInteger(capacidadFinal) || capacidadFinal < 0 || capacidadFinal > 999)
    ) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La capacidad debe ser un numero entero entre 0 y 999.",
      });
    }

    if (ubicacionFinal && ubicacionFinal.length > 255) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La ubicacion no puede superar los 255 caracteres.",
      });
    }

    if (observacionesFinal && observacionesFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Las observaciones no pueden superar los 500 caracteres.",
      });
    }

    if (!["ACTIVA", "INACTIVA", "MANTENCION"].includes(estadoFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El estado de la sala no es valido.",
      });
    }

    const [salas] = await connection.query(
      `
      SELECT id_sala, codigo
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
        message: "La sala solicitada no existe o se encuentra deshabilitada.",
      });
    }

    await connection.query(
      `
      UPDATE sala
      SET
          nombre = ?,
          piso = ?,
          capacidad = ?,
          ubicacion_detalle = ?,
          estado_sala = ?,
          permite_reserva = ?,
          observaciones = ?,
          id_usuario_actualizacion = ?
      WHERE id_sala = ?
      `,
      [
        nombreFinal,
        pisoFinal,
        capacidadFinal,
        ubicacionFinal,
        estadoFinal,
        permiteReservaFinal,
        observacionesFinal,
        req.usuario.id_usuario,
        id_sala,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Sala actualizada correctamente.",
      data: {
        id_sala: Number(id_sala),
        codigo: salas[0].codigo,
        nombre: nombreFinal,
        estado_sala: estadoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar sala.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCION: obtenerHistorialSala
DESCRIPCION:
Obtiene la trazabilidad administrativa de una sala usando auditoria_log.
No registra datos nuevos; solo presenta eventos existentes de la base de datos.
==============================================================================
*/
exports.obtenerHistorialSala = async (req, res) => {
  try {
    const { id_sala } = req.params;

    if (!id_sala) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la sala.",
      });
    }

    const [salas] = await pool.query(
      `
      SELECT id_sala
      FROM sala
      WHERE id_sala = ?
        AND eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_sala],
    );

    if (salas.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "La sala solicitada no existe o se encuentra deshabilitada.",
      });
    }

    const [historial] = await pool.query(
      `
      SELECT
          al.id_auditoria,
          al.tabla_afectada,
          al.id_registro_afectado,
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
          al.tabla_afectada = 'sala'
          AND al.id_registro_afectado = ?
        )
        OR
        (
          al.tabla_afectada = 'sala_equipo'
          AND (
            JSON_UNQUOTE(JSON_EXTRACT(al.valor_nuevo, '$.id_sala')) = ?
            OR JSON_UNQUOTE(JSON_EXTRACT(al.valor_anterior, '$.id_sala')) = ?
          )
        )
        OR
        (
          al.tabla_afectada = 'revision'
          AND al.id_registro_afectado IN (
            SELECT id_revision
            FROM revision
            WHERE id_sala = ?
          )
        )
      ORDER BY al.fecha_evento ASC
      `,
      [id_sala, id_sala, id_sala, id_sala],
    );

    const idsRevision = historial
      .filter((item) => item.tabla_afectada === "revision")
      .map((item) => item.id_registro_afectado)
      .filter(Boolean);

    if (idsRevision.length > 0) {
      const [resumenChecklist] = await pool.query(
        `
        SELECT
            r.id_revision,
            COUNT(rcd.id_revision_checklist_detalle) AS total_items_checklist,
            SUM(CASE WHEN rcd.estado_item = 'OK' THEN 1 ELSE 0 END) AS items_ok,
            SUM(CASE WHEN rcd.estado_item = 'CON_PROBLEMA' THEN 1 ELSE 0 END) AS items_con_problema,
            SUM(CASE WHEN rcd.estado_item = 'NO_APLICA' THEN 1 ELSE 0 END) AS items_no_aplica
        FROM revision r
        LEFT JOIN revision_checklist_detalle rcd
            ON r.id_revision = rcd.id_revision
        WHERE r.id_revision IN (?)
        GROUP BY r.id_revision
        `,
        [idsRevision],
      );

      const resumenPorRevision = new Map(
        resumenChecklist.map((item) => [Number(item.id_revision), item]),
      );

      historial.forEach((item) => {
        if (item.tabla_afectada !== "revision") return;

        const resumen = resumenPorRevision.get(Number(item.id_registro_afectado));
        if (!resumen) return;

        let valorNuevo = {};
        try {
          valorNuevo = item.valor_nuevo
            ? JSON.parse(item.valor_nuevo)
            : {};
        } catch {
          valorNuevo = {};
        }

        item.valor_nuevo = JSON.stringify({
          ...valorNuevo,
          total_items_checklist: Number(resumen.total_items_checklist || 0),
          items_ok: Number(resumen.items_ok || 0),
          items_con_problema: Number(resumen.items_con_problema || 0),
          items_no_aplica: Number(resumen.items_no_aplica || 0),
        });
      });
    }

    return res.json({
      ok: true,
      total: historial.length,
      data: historial,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial de la sala.",
      error: error.message,
    });
  }
};


