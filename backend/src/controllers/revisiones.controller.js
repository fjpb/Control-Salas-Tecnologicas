// Controlador del módulo de revisiones.
// Permite consultar estado semanal, equipos por sala, checklist por equipo
// y registrar revisiones técnicas con detalle de checklist.

const pool = require("../config/db");

/*
==============================================================================
FUNCIÓN: obtenerEstadoSemanalSala
DESCRIPCIÓN:
Verifica si una sala tiene una revisión registrada durante la semana actual.
==============================================================================
*/
exports.obtenerEstadoSemanalSala = async (req, res) => {
  try {
    const { id_sala } = req.params;

    if (!id_sala) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la sala a consultar.",
      });
    }

    const [salas] = await pool.query(
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
      return res.status(404).json({
        ok: false,
        message: "La sala no existe o se encuentra inactiva.",
      });
    }

    const [revisiones] = await pool.query(
      `
      SELECT 
        id_revision,
        fecha_revision,
        estado_revision_general
      FROM revision
      WHERE id_sala = ?
        AND YEARWEEK(fecha_revision, 1) = YEARWEEK(CURDATE(), 1)
        AND estado_revision_general <> 'ANULADA'
      ORDER BY fecha_revision DESC
      LIMIT 1
      `,
      [id_sala],
    );

    if (revisiones.length === 0) {
      return res.json({
        ok: true,
        id_sala: salas[0].id_sala,
        codigo: salas[0].codigo,
        sala: salas[0].nombre,
        estado: "PENDIENTE",
        message: "La sala tiene revisión semanal pendiente.",
        ultima_revision: null,
      });
    }

    return res.json({
      ok: true,
      id_sala: salas[0].id_sala,
      codigo: salas[0].codigo,
      sala: salas[0].nombre,
      estado: "AL_DIA",
      message: "La sala se encuentra al día con su revisión semanal.",
      ultima_revision: revisiones[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al consultar estado semanal de revisión.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: obtenerEquiposPorSala
DESCRIPCIÓN:
Retorna todos los equipos activos asociados a una sala.
==============================================================================
*/
exports.obtenerEquiposPorSala = async (req, res) => {
  try {
    const { id_sala } = req.params;

    if (!id_sala) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la sala.",
      });
    }

    const [equipos] = await pool.query(
      `
      SELECT
          e.id_equipo,
          e.codigo_inventario,
          e.nombre_equipo,
          te.nombre AS tipo_equipo,
          se.ubicacion_en_sala
      FROM sala_equipo se
      INNER JOIN equipo e
          ON se.id_equipo = e.id_equipo
      INNER JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo
      WHERE se.id_sala = ?
        AND se.estado_asignacion = 'ACTIVA'
        AND e.eliminado_logico = FALSE
      ORDER BY e.nombre_equipo
      `,
      [id_sala],
    );

    return res.json({
      ok: true,
      total: equipos.length,
      data: equipos,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener equipos de la sala.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: obtenerChecklistPorEquipo
DESCRIPCIÓN:
Obtiene el checklist técnico asociado al tipo de equipo seleccionado.
==============================================================================
*/
exports.obtenerChecklistPorEquipo = async (req, res) => {
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
      SELECT
          e.id_equipo,
          e.codigo_inventario,
          e.nombre_equipo,
          e.id_tipo_equipo,
          te.nombre AS tipo_equipo
      FROM equipo e
      INNER JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo
      WHERE e.id_equipo = ?
        AND e.eliminado_logico = FALSE
      LIMIT 1
      `,
      [id_equipo],
    );

    if (equipos.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "El equipo no existe o se encuentra eliminado.",
      });
    }

    const [checklist] = await pool.query(
      `
      SELECT
          ci.id_checklist_item,
          ci.codigo,
          ci.nombre,
          ci.descripcion,
          tec.obligatorio,
          tec.orden
      FROM tipo_equipo_checklist tec
      INNER JOIN checklist_item ci
          ON tec.id_checklist_item = ci.id_checklist_item
      WHERE tec.id_tipo_equipo = ?
        AND ci.activo = TRUE
      ORDER BY tec.orden, ci.nombre
      `,
      [equipos[0].id_tipo_equipo],
    );

    return res.json({
      ok: true,
      equipo: equipos[0],
      total: checklist.length,
      data: checklist,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener checklist del equipo.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: registrarRevision
DESCRIPCIÓN:
Registra una revisión técnica general y, opcionalmente, el detalle del checklist.
==============================================================================
*/
exports.registrarRevision = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      id_sala,
      id_equipo,
      observacion_general,
      estado_revision_general,
      origen_revision,
      checklist_detalle,
    } = req.body;

    const id_usuario_revisor = req.usuario.id_usuario;

    if (!id_sala) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una sala.",
      });
    }

    if (!estado_revision_general) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el estado general de la revisión.",
      });
    }

    if (observacion_general && observacion_general.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observación general no puede superar los 1000 caracteres.",
      });
    }

    const estadosPermitidos = ["BORRADOR", "FINALIZADA", "ANULADA"];

    if (!estadosPermitidos.includes(estado_revision_general)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El estado general de la revisión no es válido.",
      });
    }

    const origenesPermitidos = ["QR", "MANUAL", "PROGRAMADA"];
    const origenFinal = origen_revision || "MANUAL";

    if (!origenesPermitidos.includes(origenFinal)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El origen de la revisión no es válido.",
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

    if (id_equipo) {
      const [equipos] = await connection.query(
        `
        SELECT e.id_equipo
        FROM sala_equipo se
        INNER JOIN equipo e
            ON se.id_equipo = e.id_equipo
        WHERE se.id_sala = ?
          AND e.id_equipo = ?
          AND se.estado_asignacion = 'ACTIVA'
          AND e.eliminado_logico = FALSE
        LIMIT 1
        `,
        [id_sala, id_equipo],
      );

      if (equipos.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message:
            "El equipo seleccionado no pertenece a la sala o no se encuentra activo.",
        });
      }
    }

    if (Array.isArray(checklist_detalle)) {
      for (const item of checklist_detalle) {
        if (!item.id_checklist_item) {
          await connection.rollback();
          return res.status(400).json({
            ok: false,
            message: "Existe un ítem de checklist sin identificador.",
          });
        }

        if (!["OK", "CON_PROBLEMA", "NO_APLICA"].includes(item.estado_item)) {
          await connection.rollback();
          return res.status(400).json({
            ok: false,
            message: "Existe un estado de checklist no válido.",
          });
        }

        if (item.observacion && item.observacion.length > 1000) {
          await connection.rollback();
          return res.status(400).json({
            ok: false,
            message:
              "Una observación del checklist supera los 1000 caracteres.",
          });
        }

        if (
          item.estado_item === "CON_PROBLEMA" &&
          (!item.observacion || item.observacion.trim().length < 5)
        ) {
          await connection.rollback();
          return res.status(400).json({
            ok: false,
            message:
              "Todo ítem con problema debe incluir una observación técnica.",
          });
        }
      }
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO revision
      (
        id_sala,
        id_usuario_revisor,
        fecha_revision,
        observacion_general,
        origen_revision,
        estado_revision_general,
        id_usuario_actualizacion
      )
      VALUES (?, ?, NOW(), ?, ?, ?, ?)
      `,
      [
        id_sala,
        id_usuario_revisor,
        observacion_general || null,
        origenFinal,
        estado_revision_general,
        id_usuario_revisor,
      ],
    );

    const id_revision = resultado.insertId;

    if (
      id_equipo &&
      Array.isArray(checklist_detalle) &&
      checklist_detalle.length > 0
    ) {
      for (const item of checklist_detalle) {
        await connection.query(
          `
          INSERT INTO revision_checklist_detalle
          (
            id_revision,
            id_equipo,
            id_checklist_item,
            estado_item,
            observacion,
            id_usuario_creacion
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            id_revision,
            id_equipo,
            item.id_checklist_item,
            item.estado_item,
            item.observacion || null,
            id_usuario_revisor,
          ],
        );
      }
    }

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
        'revision',
        ?,
        'INSERT',
        'Registro de revisión técnica con checklist.',
        JSON_OBJECT(
          'id_sala', ?,
          'codigo_sala', ?,
          'nombre_sala', ?,
          'id_equipo', ?,
          'estado_revision_general', ?,
          'origen_revision', ?,
          'total_items_checklist', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_revisor,
        id_revision,
        id_sala,
        salas[0].codigo,
        salas[0].nombre,
        id_equipo || null,
        estado_revision_general,
        origenFinal,
        Array.isArray(checklist_detalle) ? checklist_detalle.length : 0,
      ],
    );

    /*
==============================================================================
HISTORIAL DE REVISIÓN
------------------------------------------------------------------------------
Registra la creación de la revisión para mantener trazabilidad funcional.
==============================================================================
*/
    await connection.query(
      `
  INSERT INTO revision_historial
  (
    id_revision,
    id_usuario,
    accion,
    descripcion
  )
  VALUES (?, ?, 'REGISTRO', ?)
  `,
      [
        id_revision,
        id_usuario_revisor,
        `Se registró la revisión REV-${String(id_revision).padStart(6, "0")} para la sala ${salas[0].codigo} - ${salas[0].nombre}.`,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Revisión registrada correctamente.",
      data: {
        id_revision,
        id_sala,
        id_equipo: id_equipo || null,
        codigo: salas[0].codigo,
        sala: salas[0].nombre,
        estado_revision_general,
        origen_revision: origenFinal,
        total_items_checklist: Array.isArray(checklist_detalle)
          ? checklist_detalle.length
          : 0,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al registrar revisión.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCIÓN: listarRevisiones
DESCRIPCIÓN:
Lista las revisiones técnicas registradas en el sistema.

OBJETIVO:
Permite visualizar el historial de revisiones realizadas, indicando sala,
edificio, usuario revisor, fecha, estado general y cantidad de ítems revisados.
==============================================================================
*/
exports.listarRevisiones = async (req, res) => {
  try {
    const [revisiones] = await pool.query(
      `
      SELECT
          r.id_revision,
          r.id_usuario_revisor,
          r.fecha_revision,
          r.estado_revision_general,
          r.origen_revision,
          r.observacion_general,

          s.codigo AS codigo_sala,
          s.nombre AS sala,

          e.nombre AS edificio,

          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_revisor,

          COUNT(rcd.id_revision_checklist_detalle) AS total_items,
          SUM(CASE WHEN rcd.estado_item = 'OK' THEN 1 ELSE 0 END) AS total_ok,
          SUM(CASE WHEN rcd.estado_item = 'CON_PROBLEMA' THEN 1 ELSE 0 END) AS total_problema,
          SUM(CASE WHEN rcd.estado_item = 'NO_APLICA' THEN 1 ELSE 0 END) AS total_no_aplica

      FROM revision r

      INNER JOIN sala s
          ON r.id_sala = s.id_sala

      INNER JOIN edificio e
          ON s.id_edificio = e.id_edificio

      INNER JOIN usuario u
          ON r.id_usuario_revisor = u.id_usuario

      LEFT JOIN revision_checklist_detalle rcd
          ON r.id_revision = rcd.id_revision

      GROUP BY
          r.id_revision,
          r.id_usuario_revisor,
          r.fecha_revision,
          r.estado_revision_general,
          r.origen_revision,
          r.observacion_general,
          s.codigo,
          s.nombre,
          e.nombre,
          u.nombres,
          u.apellidos

      ORDER BY r.fecha_revision DESC
      `,
    );

    return res.json({
      ok: true,
      total: revisiones.length,
      data: revisiones,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar revisiones.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: obtenerDetalleRevision
DESCRIPCIÓN:
Obtiene el detalle completo de una revisión técnica, incluyendo checklist,
equipo revisado, sala, edificio, usuario revisor y observaciones.
==============================================================================
*/
/*
==============================================================================
FUNCION: editarRevision
DESCRIPCION:
Actualiza observacion general y estados del checklist de una revision existente.
No modifica sala, fecha ni revisor para conservar trazabilidad del registro.
==============================================================================
*/
exports.editarRevision = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_revision } = req.params;
    const { observacion_general, checklist_detalle } = req.body;
    const id_usuario_actualizacion = req.usuario.id_usuario;
    const rolUsuario = req.usuario.nombre_rol;

    if (!id_revision) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la revision a editar.",
      });
    }

    const observacionFinal = observacion_general
      ? observacion_general.trim()
      : null;

    if (observacionFinal && observacionFinal.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La observacion general no puede superar los 1000 caracteres.",
      });
    }

    const [revisiones] = await connection.query(
      `
      SELECT
          r.id_revision,
          r.id_usuario_revisor,
          r.estado_revision_general,
          r.observacion_general,
          s.codigo AS codigo_sala,
          s.nombre AS sala
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      WHERE r.id_revision = ?
      LIMIT 1
      `,
      [id_revision],
    );

    if (revisiones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La revision solicitada no existe.",
      });
    }

    const revision = revisiones[0];
    const rolesEditanTodo = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"];
    const esRevisor =
      Number(revision.id_usuario_revisor) === Number(id_usuario_actualizacion);

    if (!rolesEditanTodo.includes(rolUsuario) && !esRevisor) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para editar esta revision.",
      });
    }

    if (revision.estado_revision_general === "ANULADA") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "No se puede editar una revision anulada.",
      });
    }

    if (checklist_detalle && !Array.isArray(checklist_detalle)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El detalle de checklist no es valido.",
      });
    }

    const detalleFinal = Array.isArray(checklist_detalle)
      ? checklist_detalle
      : [];

    for (const item of detalleFinal) {
      if (!item.id_revision_checklist_detalle) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Existe un item de checklist sin identificador.",
        });
      }

      if (!["OK", "CON_PROBLEMA", "NO_APLICA"].includes(item.estado_item)) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Existe un estado de checklist no valido.",
        });
      }

      const observacionItem = item.observacion ? item.observacion.trim() : null;

      if (observacionItem && observacionItem.length > 1000) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message: "Una observacion del checklist supera los 1000 caracteres.",
        });
      }

      if (
        item.estado_item === "CON_PROBLEMA" &&
        (!observacionItem || observacionItem.length < 5)
      ) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message:
            "Todo item con problema debe incluir una observacion tecnica.",
        });
      }

      const [detalles] = await connection.query(
        `
        SELECT id_revision_checklist_detalle
        FROM revision_checklist_detalle
        WHERE id_revision_checklist_detalle = ?
          AND id_revision = ?
        LIMIT 1
        `,
        [item.id_revision_checklist_detalle, id_revision],
      );

      if (detalles.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          ok: false,
          message: "Un item del checklist no pertenece a esta revision.",
        });
      }
    }

    await connection.query(
      `
      UPDATE revision
      SET
          observacion_general = ?,
          id_usuario_actualizacion = ?
      WHERE id_revision = ?
      `,
      [observacionFinal, id_usuario_actualizacion, id_revision],
    );

    for (const item of detalleFinal) {
      await connection.query(
        `
        UPDATE revision_checklist_detalle
        SET
            estado_item = ?,
            observacion = ?
        WHERE id_revision_checklist_detalle = ?
          AND id_revision = ?
        `,
        [
          item.estado_item,
          item.observacion ? item.observacion.trim() : null,
          item.id_revision_checklist_detalle,
          id_revision,
        ],
      );
    }

    await connection.query(
      `
      INSERT INTO revision_historial
      (
        id_revision,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'EDICION', ?)
      `,
      [
        id_revision,
        id_usuario_actualizacion,
        `Se editaron datos tecnicos de la revision REV-${String(id_revision).padStart(6, "0")} de la sala ${revision.codigo_sala} - ${revision.sala}.`,
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
        'revision',
        ?,
        'UPDATE',
        'Edicion de datos tecnicos de revision.',
        JSON_OBJECT(
          'observacion_general', ?,
          'estado_revision_general', ?
        ),
        JSON_OBJECT(
          'observacion_general', ?,
          'items_actualizados', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_actualizacion,
        id_revision,
        revision.observacion_general,
        revision.estado_revision_general,
        observacionFinal,
        detalleFinal.length,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Revision actualizada correctamente.",
      data: {
        id_revision: Number(id_revision),
        items_actualizados: detalleFinal.length,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al editar revision.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

exports.obtenerDetalleRevision = async (req, res) => {
  try {
    const { id_revision } = req.params;

    if (!id_revision) {
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la revisión.",
      });
    }

    const [revision] = await pool.query(
      `
      SELECT
          r.id_revision,
          r.fecha_revision,
          r.estado_revision_general,
          r.origen_revision,
          r.observacion_general,

          s.id_sala,
          s.codigo AS codigo_sala,
          s.nombre AS sala,

          e.nombre AS edificio,

          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_revisor

      FROM revision r

      INNER JOIN sala s
          ON r.id_sala = s.id_sala

      INNER JOIN edificio e
          ON s.id_edificio = e.id_edificio

      INNER JOIN usuario u
          ON r.id_usuario_revisor = u.id_usuario

      WHERE r.id_revision = ?
      LIMIT 1
      `,
      [id_revision],
    );

    if (revision.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "La revisión solicitada no existe.",
      });
    }

    const [checklist] = await pool.query(
      `
      SELECT
          rcd.id_revision_checklist_detalle,
          rcd.id_equipo,
          eq.nombre_equipo,
          te.nombre AS tipo_equipo,

          ci.codigo AS codigo_item,
          ci.nombre AS item,
          ci.descripcion AS descripcion_item,

          rcd.estado_item,
          rcd.observacion,
          rcd.fecha_creacion

      FROM revision_checklist_detalle rcd

      INNER JOIN equipo eq
          ON rcd.id_equipo = eq.id_equipo

      INNER JOIN tipo_equipo te
          ON eq.id_tipo_equipo = te.id_tipo_equipo

      INNER JOIN checklist_item ci
          ON rcd.id_checklist_item = ci.id_checklist_item

      WHERE rcd.id_revision = ?

      ORDER BY eq.nombre_equipo, ci.nombre
      `,
      [id_revision],
    );

    return res.json({
      ok: true,
      revision: revision[0],
      total_items: checklist.length,
      checklist,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener detalle de revisión.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: obtenerHistorialRevision
DESCRIPCIÓN:
Retorna el historial funcional de una revisión técnica.
==============================================================================
*/
exports.obtenerHistorialRevision = async (req, res) => {
  try {
    const { id_revision } = req.params;

    const [historial] = await pool.query(
      `
      SELECT
          rh.id_historial,
          rh.accion,
          rh.descripcion,
          rh.fecha_registro,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario
      FROM revision_historial rh
      INNER JOIN usuario u
          ON rh.id_usuario = u.id_usuario
      WHERE rh.id_revision = ?
      ORDER BY rh.fecha_registro ASC
      `,
      [id_revision],
    );

    return res.json({
      ok: true,
      total: historial.length,
      data: historial,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial de revisión.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCION: anularRevision
DESCRIPCION:
Anula una revision tecnica registrada, exigiendo motivo y manteniendo
trazabilidad funcional en revision_historial y auditoria_log.
==============================================================================
*/
exports.anularRevision = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_revision } = req.params;
    const { motivo_anulacion } = req.body;
    const id_usuario_anulacion = req.usuario.id_usuario;
    const rolesAnulanRevision = ["SUPER_ADMINISTRADOR"];

    const motivoFinal = motivo_anulacion ? motivo_anulacion.trim() : "";

    if (!rolesAnulanRevision.includes(req.usuario.nombre_rol)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "Solo el Super Administrador puede autorizar la anulacion de revisiones.",
      });
    }

    if (!id_revision) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la revision a anular.",
      });
    }

    if (motivoFinal.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar un motivo de anulacion de al menos 5 caracteres.",
      });
    }

    if (motivoFinal.length > 500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El motivo de anulacion no puede superar los 500 caracteres.",
      });
    }

    const [revisiones] = await connection.query(
      `
      SELECT
          r.id_revision,
          r.estado_revision_general,
          r.fecha_revision,
          r.motivo_anulacion,
          s.codigo AS codigo_sala,
          s.nombre AS sala
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      WHERE r.id_revision = ?
      LIMIT 1
      `,
      [id_revision],
    );

    if (revisiones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La revision solicitada no existe.",
      });
    }

    const revision = revisiones[0];

    if (revision.estado_revision_general === "ANULADA") {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La revision ya se encuentra anulada.",
      });
    }

    await connection.query(
      `
      UPDATE revision
      SET
          estado_revision_general = 'ANULADA',
          id_usuario_anulacion = ?,
          fecha_anulacion = NOW(),
          motivo_anulacion = ?,
          id_usuario_actualizacion = ?
      WHERE id_revision = ?
      `,
      [
        id_usuario_anulacion,
        motivoFinal,
        id_usuario_anulacion,
        id_revision,
      ],
    );

    /*
==============================================================================
HISTORIAL DE ANULACION
------------------------------------------------------------------------------
Registra el motivo funcional visible para usuarios del sistema.
==============================================================================
*/
    await connection.query(
      `
      INSERT INTO revision_historial
      (
        id_revision,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'ANULACION', ?)
      `,
      [
        id_revision,
        id_usuario_anulacion,
        `Se anulo la revision REV-${String(id_revision).padStart(6, "0")} de la sala ${revision.codigo_sala} - ${revision.sala}. Motivo: ${motivoFinal}.`,
      ],
    );

    /*
==============================================================================
AUDITORIA
------------------------------------------------------------------------------
Se usa accion UPDATE porque el ENUM de auditoria_log no contempla ANULACION.
==============================================================================
*/
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
        'revision',
        ?,
        'UPDATE',
        'Anulacion de revision tecnica.',
        JSON_OBJECT(
          'estado_revision_general', ?,
          'motivo_anulacion', ?
        ),
        JSON_OBJECT(
          'estado_revision_general', 'ANULADA',
          'motivo_anulacion', ?,
          'id_usuario_anulacion', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_anulacion,
        id_revision,
        revision.estado_revision_general,
        revision.motivo_anulacion,
        motivoFinal,
        id_usuario_anulacion,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Revision anulada correctamente.",
      data: {
        id_revision: Number(id_revision),
        estado_revision_general: "ANULADA",
        motivo_anulacion: motivoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al anular revision.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
