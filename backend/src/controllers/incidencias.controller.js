// Controlador del módulo de incidencias SGTSL.
// Gestiona registro, listado, cambio de estado, evidencias e historial.

const fs = require("fs");
const pool = require("../config/db");

/*
==============================================================================
FUNCIÓN: generarTicketIncidencia
------------------------------------------------------------------------------
Genera el ticket visual del sistema usando numero_ticket, no id_incidencia.
Ejemplo: numero_ticket 3 => SGTSL-INC-000003
==============================================================================
*/
function generarTicketIncidencia(numeroTicket) {
  return `SGTSL-INC-${String(numeroTicket).padStart(6, "0")}`;
}

function eliminarArchivoSubido(file) {
  if (!file?.path) return;

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch {
    // La limpieza del archivo no debe interrumpir la respuesta HTTP.
  }
}

/*
==============================================================================
FUNCIÓN: obtenerSiguienteNumeroTicket
------------------------------------------------------------------------------
Obtiene el próximo número visible de ticket usando sistema_correlativo.

IMPORTANTE:
Se usa FOR UPDATE dentro de una transacción para evitar duplicidad si dos
usuarios registran incidencias al mismo tiempo.
==============================================================================
*/
async function obtenerSiguienteNumeroTicket(connection) {
  const [correlativo] = await connection.query(
    `
    SELECT ultimo_numero
    FROM sistema_correlativo
    WHERE codigo = 'INCIDENCIA'
    FOR UPDATE
    `,
  );

  if (correlativo.length === 0) {
    await connection.query(
      `
      INSERT INTO sistema_correlativo
      (
        codigo,
        ultimo_numero
      )
      VALUES
      (
        'INCIDENCIA',
        0
      )
      `,
    );

    return 1;
  }

  return correlativo[0].ultimo_numero + 1;
}

/*
==============================================================================
FUNCIÓN: registrarIncidencia
------------------------------------------------------------------------------
Registra una nueva incidencia técnica.

El id_incidencia queda como clave interna.
El numero_ticket queda como número visible para el usuario.
==============================================================================
*/
exports.registrarIncidencia = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      id_sala,
      id_equipo,
      id_tipo_incidencia,
      prioridad,
      titulo,
      descripcion,
    } = req.body;

    const id_usuario_reporta = req.usuario.id_usuario;

    if (!id_sala) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una sala.",
      });
    }

    if (!id_tipo_incidencia) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar un tipo de incidencia.",
      });
    }

    if (!prioridad) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una prioridad.",
      });
    }

    if (!titulo || titulo.trim().length < 5) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El título debe tener al menos 5 caracteres.",
      });
    }

    if (!descripcion || descripcion.trim().length < 20) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La descripción debe tener al menos 20 caracteres.",
      });
    }

    if (titulo.length > 150) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El título no puede superar los 150 caracteres.",
      });
    }

    if (descripcion.length > 1500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La descripción no puede superar los 1500 caracteres.",
      });
    }

    const prioridadesPermitidas = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

    if (!prioridadesPermitidas.includes(prioridad)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La prioridad seleccionada no es válida.",
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
        message: "La sala seleccionada no existe.",
      });
    }

    let idSalaEquipo = null;

    if (id_equipo) {
      const [asignaciones] = await connection.query(
        `
        SELECT id_sala_equipo
        FROM sala_equipo
        WHERE id_sala = ?
          AND id_equipo = ?
          AND estado_asignacion = 'ACTIVA'
        LIMIT 1
        `,
        [id_sala, id_equipo],
      );

      if (asignaciones.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message:
            "El equipo seleccionado no pertenece a la sala o no se encuentra activo.",
        });
      }

      idSalaEquipo = asignaciones[0].id_sala_equipo;
    }

    const [tipos] = await connection.query(
      `
      SELECT id_tipo_incidencia, nombre
      FROM tipo_incidencia
      WHERE id_tipo_incidencia = ?
      LIMIT 1
      `,
      [id_tipo_incidencia],
    );

    if (tipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El tipo de incidencia seleccionado no existe.",
      });
    }

    const [estadoInicial] = await connection.query(
      `
      SELECT id_estado_incidencia
      FROM estado_incidencia
      WHERE nombre = 'ABIERTA'
      LIMIT 1
      `,
    );

    if (estadoInicial.length === 0) {
      await connection.rollback();
      return res.status(500).json({
        ok: false,
        message: "No existe el estado inicial ABIERTA.",
      });
    }

    const numeroTicket = await obtenerSiguienteNumeroTicket(connection);
    const ticketNuevo = generarTicketIncidencia(numeroTicket);

    const [resultado] = await connection.query(
      `
      INSERT INTO incidencia
      (
        numero_ticket,
        id_sala,
        id_sala_equipo,
        id_tipo_incidencia,
        id_estado_incidencia,
        id_usuario_reporta,
        titulo,
        descripcion,
        prioridad,
        fecha_reporte,
        id_usuario_actualizacion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        numeroTicket,
        id_sala,
        idSalaEquipo,
        id_tipo_incidencia,
        estadoInicial[0].id_estado_incidencia,
        id_usuario_reporta,
        titulo.trim(),
        descripcion.trim(),
        prioridad,
        id_usuario_reporta,
      ],
    );

    await connection.query(
      `
      UPDATE sistema_correlativo
      SET ultimo_numero = ?
      WHERE codigo = 'INCIDENCIA'
      `,
      [numeroTicket],
    );

    const idIncidenciaNueva = resultado.insertId;

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
        'incidencia',
        ?,
        'INSERT',
        'Registro de incidencia técnica.',
        JSON_OBJECT(
          'ticket', ?,
          'numero_ticket', ?,
          'id_sala', ?,
          'codigo_sala', ?,
          'id_sala_equipo', ?,
          'titulo', ?,
          'prioridad', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_reporta,
        idIncidenciaNueva,
        ticketNuevo,
        numeroTicket,
        id_sala,
        salas[0].codigo,
        idSalaEquipo,
        titulo.trim(),
        prioridad,
      ],
    );

    await connection.query(
      `
      INSERT INTO incidencia_historial
      (
        id_incidencia,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'REGISTRO', ?)
      `,
      [
        idIncidenciaNueva,
        id_usuario_reporta,
        `Se registró la incidencia ${ticketNuevo} con prioridad ${prioridad}.`,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: "Incidencia registrada correctamente.",
      data: {
        id_incidencia: idIncidenciaNueva,
        numero_ticket: numeroTicket,
        ticket: ticketNuevo,
        sala: salas[0].nombre,
        prioridad,
        titulo: titulo.trim(),
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al registrar incidencia.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCIÓN: listarIncidencias
------------------------------------------------------------------------------
Lista incidencias usando numero_ticket como ticket visible.
==============================================================================
*/
exports.listarIncidencias = async (req, res) => {
  try {
    const [incidencias] = await pool.query(
      `
      SELECT
          i.id_incidencia,
          i.numero_ticket,
          CONCAT('SGTSL-INC-', LPAD(i.numero_ticket, 6, '0')) AS ticket,
          i.id_sala,
          i.id_sala_equipo,
          i.id_tipo_incidencia,
          i.id_usuario_reporta,
          i.titulo,
          i.descripcion,
          i.prioridad,
          i.requiere_ticket_externo,
          i.ticket_externo,
          i.observacion_cierre,
          i.fecha_reporte,
          i.fecha_cierre,
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          se.id_equipo,
          e.nombre_equipo,
          te.nombre AS tipo_equipo,
          ti.nombre AS tipo_incidencia,
          ei.id_estado_incidencia,
          ei.nombre AS estado_incidencia,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_reporta,
          ev.ruta_archivo AS evidencia_ruta
      FROM incidencia i
      INNER JOIN sala s
          ON i.id_sala = s.id_sala
      INNER JOIN tipo_incidencia ti
          ON i.id_tipo_incidencia = ti.id_tipo_incidencia
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      INNER JOIN usuario u
          ON i.id_usuario_reporta = u.id_usuario
      LEFT JOIN sala_equipo se
          ON i.id_sala_equipo = se.id_sala_equipo
      LEFT JOIN equipo e
          ON se.id_equipo = e.id_equipo
      LEFT JOIN tipo_equipo te
          ON e.id_tipo_equipo = te.id_tipo_equipo
      LEFT JOIN (
          SELECT
              ie.id_incidencia,
              ie.ruta_archivo
          FROM incidencia_evidencia ie
          INNER JOIN (
              SELECT
                  id_incidencia,
                  MAX(id_evidencia) AS id_evidencia
              FROM incidencia_evidencia
              GROUP BY id_incidencia
          ) ultima
              ON ie.id_evidencia = ultima.id_evidencia
      ) ev
          ON i.id_incidencia = ev.id_incidencia
      ORDER BY i.fecha_reporte DESC
      `,
    );

    return res.json({
      ok: true,
      total: incidencias.length,
      data: incidencias,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al listar incidencias.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: cambiarEstadoIncidencia
------------------------------------------------------------------------------
Actualiza estado, ticket institucional y observación.
==============================================================================
*/
/*
==============================================================================
FUNCION: editarIncidencia
------------------------------------------------------------------------------
Actualiza datos generales de una incidencia sin alterar el flujo de cambio de
estado. Registra el movimiento en incidencia_historial y auditoria_log.
==============================================================================
*/
exports.editarIncidencia = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_incidencia } = req.params;
    const {
      id_sala,
      id_equipo,
      id_tipo_incidencia,
      prioridad,
      titulo,
      descripcion,
    } = req.body;

    const id_usuario_actualizacion = req.usuario.id_usuario;
    const rolUsuario = req.usuario.nombre_rol;

    const [incidencias] = await connection.query(
      `
      SELECT
          i.id_incidencia,
          i.numero_ticket,
          i.id_sala,
          i.id_sala_equipo,
          i.id_tipo_incidencia,
          i.id_usuario_reporta,
          i.titulo,
          i.descripcion,
          i.prioridad,
          ei.nombre AS estado_incidencia
      FROM incidencia i
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      WHERE i.id_incidencia = ?
      LIMIT 1
      `,
      [id_incidencia],
    );

    if (incidencias.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La incidencia no existe.",
      });
    }

    const incidenciaActual = incidencias[0];
    const rolesGestionan = [
      "SUPER_ADMINISTRADOR",
      "ADMINISTRADOR",
      "TECNICO_SOPORTE",
    ];
    const esReportante =
      Number(incidenciaActual.id_usuario_reporta) ===
      Number(id_usuario_actualizacion);
    const rolesReportantesEditan = ["DOCENTE", "ALUMNO_PRACTICA"];
    const puedeEditar =
      rolesGestionan.includes(rolUsuario) ||
      (rolesReportantesEditan.includes(rolUsuario) && esReportante);

    if (!puedeEditar) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para editar esta incidencia.",
      });
    }

    if (["RESUELTA", "CERRADA"].includes(incidenciaActual.estado_incidencia)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "No se pueden editar datos generales de una incidencia resuelta o cerrada.",
      });
    }

    if (!id_sala) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una sala.",
      });
    }

    if (!id_tipo_incidencia) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar un tipo de incidencia.",
      });
    }

    if (!prioridad) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una prioridad.",
      });
    }

    const tituloFinal = titulo ? titulo.trim() : "";
    const descripcionFinal = descripcion ? descripcion.trim() : "";

    if (tituloFinal.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El titulo debe tener al menos 5 caracteres.",
      });
    }

    if (tituloFinal.length > 150) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El titulo no puede superar los 150 caracteres.",
      });
    }

    if (descripcionFinal.length < 20) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La descripcion debe tener al menos 20 caracteres.",
      });
    }

    if (descripcionFinal.length > 1500) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La descripcion no puede superar los 1500 caracteres.",
      });
    }

    const prioridadesPermitidas = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

    if (!prioridadesPermitidas.includes(prioridad)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "La prioridad seleccionada no es valida.",
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
        message: "La sala seleccionada no existe.",
      });
    }

    let idSalaEquipo = null;
    let nombreEquipo = null;

    if (id_equipo) {
      const [asignaciones] = await connection.query(
        `
        SELECT
            se.id_sala_equipo,
            e.nombre_equipo
        FROM sala_equipo se
        INNER JOIN equipo e
            ON se.id_equipo = e.id_equipo
        WHERE se.id_sala = ?
          AND se.id_equipo = ?
          AND se.estado_asignacion = 'ACTIVA'
        LIMIT 1
        `,
        [id_sala, id_equipo],
      );

      if (asignaciones.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          message:
            "El equipo seleccionado no pertenece a la sala o no se encuentra activo.",
        });
      }

      idSalaEquipo = asignaciones[0].id_sala_equipo;
      nombreEquipo = asignaciones[0].nombre_equipo;
    }

    const [tipos] = await connection.query(
      `
      SELECT id_tipo_incidencia, nombre
      FROM tipo_incidencia
      WHERE id_tipo_incidencia = ?
      LIMIT 1
      `,
      [id_tipo_incidencia],
    );

    if (tipos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El tipo de incidencia seleccionado no existe.",
      });
    }

    await connection.query(
      `
      UPDATE incidencia
      SET
          id_sala = ?,
          id_sala_equipo = ?,
          id_tipo_incidencia = ?,
          titulo = ?,
          descripcion = ?,
          prioridad = ?,
          id_usuario_actualizacion = ?
      WHERE id_incidencia = ?
      `,
      [
        id_sala,
        idSalaEquipo,
        id_tipo_incidencia,
        tituloFinal,
        descripcionFinal,
        prioridad,
        id_usuario_actualizacion,
        id_incidencia,
      ],
    );

    const ticket = generarTicketIncidencia(incidenciaActual.numero_ticket);

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
        'incidencia',
        ?,
        'UPDATE',
        'Actualizacion de datos generales de incidencia.',
        JSON_OBJECT(
          'id_sala', ?,
          'id_sala_equipo', ?,
          'id_tipo_incidencia', ?,
          'titulo', ?,
          'descripcion', ?,
          'prioridad', ?
        ),
        JSON_OBJECT(
          'id_sala', ?,
          'codigo_sala', ?,
          'id_sala_equipo', ?,
          'id_tipo_incidencia', ?,
          'tipo_incidencia', ?,
          'titulo', ?,
          'descripcion', ?,
          'prioridad', ?,
          'equipo', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_actualizacion,
        id_incidencia,
        incidenciaActual.id_sala,
        incidenciaActual.id_sala_equipo,
        incidenciaActual.id_tipo_incidencia,
        incidenciaActual.titulo,
        incidenciaActual.descripcion,
        incidenciaActual.prioridad,
        id_sala,
        salas[0].codigo,
        idSalaEquipo,
        id_tipo_incidencia,
        tipos[0].nombre,
        tituloFinal,
        descripcionFinal,
        prioridad,
        nombreEquipo,
      ],
    );

    await connection.query(
      `
      INSERT INTO incidencia_historial
      (
        id_incidencia,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'EDICION', ?)
      `,
      [
        id_incidencia,
        id_usuario_actualizacion,
        `Se actualizaron datos generales de la incidencia ${ticket}.`,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Incidencia actualizada correctamente.",
      data: {
        id_incidencia: Number(id_incidencia),
        ticket,
        titulo: tituloFinal,
        prioridad,
        tipo_incidencia: tipos[0].nombre,
        sala: salas[0].nombre,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al editar incidencia.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

exports.cambiarEstadoIncidencia = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_incidencia } = req.params;

    const {
      id_estado_incidencia,
      observacion_cierre,
      requiere_ticket_externo,
      ticket_externo,
    } = req.body;

    const id_usuario_actualizacion = req.usuario.id_usuario;
    const rolesGestionanEstado = [
      "SUPER_ADMINISTRADOR",
      "ADMINISTRADOR",
      "TECNICO_SOPORTE",
    ];

    if (!rolesGestionanEstado.includes(req.usuario.nombre_rol)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para cambiar el estado de la incidencia.",
      });
    }

    if (!id_incidencia) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la incidencia.",
      });
    }

    if (!id_estado_incidencia) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar el nuevo estado.",
      });
    }

    const [incidencias] = await connection.query(
      `
      SELECT
          i.id_incidencia,
          i.numero_ticket,
          i.id_estado_incidencia,
          i.ticket_externo,
          i.requiere_ticket_externo,
          ei.nombre AS estado_actual
      FROM incidencia i
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      WHERE i.id_incidencia = ?
      LIMIT 1
      `,
      [id_incidencia],
    );

    if (incidencias.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La incidencia no existe.",
      });
    }

    const [estados] = await connection.query(
      `
      SELECT id_estado_incidencia, nombre
      FROM estado_incidencia
      WHERE id_estado_incidencia = ?
      LIMIT 1
      `,
      [id_estado_incidencia],
    );

    if (estados.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "El estado seleccionado no existe.",
      });
    }

    const estadoNuevo = estados[0].nombre;
    const estadoActual = incidencias[0].estado_actual;

    const transicionesPermitidas = {
      ABIERTA: ["EN_REVISION", "RECHAZADA"],
      EN_REVISION: ["EN_PROCESO", "RECHAZADA"],
      EN_PROCESO: ["RESUELTA"],
      RESUELTA: ["CERRADA"],
      CERRADA: [],
      RECHAZADA: [],
    };

    if (
      Number(incidencias[0].id_estado_incidencia) ===
      Number(id_estado_incidencia)
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        message: "La incidencia ya se encuentra en ese estado.",
      });
    }

    if (["CERRADA", "RECHAZADA"].includes(estadoActual)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "La incidencia se encuentra cerrada o rechazada y no admite nuevos cambios de estado.",
      });
    }

    if (!transicionesPermitidas[estadoActual]?.includes(estadoNuevo)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: `Transicion de estado no permitida. La incidencia debe avanzar de forma secuencial desde ${estadoActual}.`,
      });
    }

    const requiereCierre = ["RESUELTA", "CERRADA"].includes(estadoNuevo);
    const requiereTicketExternoFinal = Boolean(requiere_ticket_externo);
    const ticketExternoFinal =
      requiereTicketExternoFinal && ticket_externo
        ? ticket_externo.trim()
        : null;
    const observacionFinal = observacion_cierre
      ? observacion_cierre.trim()
      : null;

    if (requiereCierre && (!observacionFinal || observacionFinal.length < 5)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar una observación de cierre o resolución.",
      });
    }

    if (observacionFinal && observacionFinal.length > 1000) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "La observación de cierre no puede superar los 1000 caracteres.",
      });
    }

    if (
      requiereTicketExternoFinal &&
      (!ticketExternoFinal || ticketExternoFinal.length < 3)
    ) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar el número de ticket institucional.",
      });
    }

    if (ticketExternoFinal && ticketExternoFinal.length > 100) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "El ticket institucional no puede superar los 100 caracteres.",
      });
    }

    await connection.query(
      `
      UPDATE incidencia
      SET
          id_estado_incidencia = ?,
          observacion_cierre = CASE WHEN ? = TRUE THEN ? ELSE NULL END,
          requiere_ticket_externo = ?,
          ticket_externo = ?,
          fecha_cierre = CASE WHEN ? = TRUE THEN NOW() ELSE NULL END,
          id_usuario_cierre = CASE WHEN ? = TRUE THEN ? ELSE NULL END,
          id_usuario_actualizacion = ?
      WHERE id_incidencia = ?
      `,
      [
        id_estado_incidencia,
        requiereCierre,
        observacionFinal,
        requiereTicketExternoFinal,
        ticketExternoFinal,
        requiereCierre,
        requiereCierre,
        id_usuario_actualizacion,
        id_usuario_actualizacion,
        id_incidencia,
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
        'incidencia',
        ?,
        'UPDATE',
        'Cambio de estado de incidencia y actualización de ticket institucional.',
        JSON_OBJECT(
          'estado_anterior', ?,
          'ticket_externo_anterior', ?
        ),
        JSON_OBJECT(
          'estado_nuevo', ?,
          'observacion_cierre', ?,
          'requiere_ticket_externo', ?,
          'ticket_externo', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_actualizacion,
        id_incidencia,
        incidencias[0].estado_actual,
        incidencias[0].ticket_externo,
        estadoNuevo,
        observacionFinal,
        requiereTicketExternoFinal,
        ticketExternoFinal,
      ],
    );

    await connection.query(
      `
      INSERT INTO incidencia_historial
      (
        id_incidencia,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'CAMBIO_ESTADO', ?)
      `,
      [
        id_incidencia,
        id_usuario_actualizacion,
        `Se actualizó el estado desde ${incidencias[0].estado_actual} a ${estadoNuevo}.${
          ticketExternoFinal
            ? ` Ticket institucional asociado: ${ticketExternoFinal}.`
            : ""
        }${observacionFinal ? ` Observación: ${observacionFinal}.` : ""}`,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Estado de incidencia actualizado correctamente.",
      data: {
        id_incidencia: Number(id_incidencia),
        numero_ticket: incidencias[0].numero_ticket,
        ticket: generarTicketIncidencia(incidencias[0].numero_ticket),
        estado: estadoNuevo,
        requiere_ticket_externo: requiereTicketExternoFinal,
        ticket_externo: ticketExternoFinal,
      },
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar estado de incidencia.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};


/*
==============================================================================
FUNCION: reabrirIncidencia
------------------------------------------------------------------------------
Permite que solo el Super Administrador reactive una incidencia cerrada o
rechazada cuando existe un motivo formal. Se registra auditoria e historial.
==============================================================================
*/
exports.reabrirIncidencia = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id_incidencia } = req.params;
    const motivo = req.body?.motivo ? String(req.body.motivo).trim() : "";
    const idUsuario = req.usuario.id_usuario;

    if (req.usuario.nombre_rol !== "SUPER_ADMINISTRADOR") {
      await connection.rollback();
      return res.status(403).json({ ok: false, message: "Solo el Super Administrador puede reabrir una incidencia finalizada." });
    }

    if (!id_incidencia) {
      await connection.rollback();
      return res.status(400).json({ ok: false, message: "Debe indicar la incidencia." });
    }

    if (motivo.length < 5) {
      await connection.rollback();
      return res.status(400).json({ ok: false, message: "Debe ingresar un motivo de reapertura de al menos 5 caracteres." });
    }

    if (motivo.length > 500) {
      await connection.rollback();
      return res.status(400).json({ ok: false, message: "El motivo de reapertura no puede superar los 500 caracteres." });
    }

    const [incidencias] = await connection.query(
      `
      SELECT
          i.id_incidencia,
          i.numero_ticket,
          i.observacion_cierre,
          i.ticket_externo,
          ei.nombre AS estado_actual
      FROM incidencia i
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      WHERE i.id_incidencia = ?
      LIMIT 1
      `,
      [id_incidencia],
    );

    if (incidencias.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, message: "La incidencia no existe." });
    }

    const incidenciaActual = incidencias[0];

    if (!["CERRADA", "RECHAZADA"].includes(incidenciaActual.estado_actual)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, message: "Solo se pueden reabrir incidencias cerradas o rechazadas." });
    }

    const [estados] = await connection.query(
      `
      SELECT id_estado_incidencia
      FROM estado_incidencia
      WHERE nombre = 'EN_REVISION'
      LIMIT 1
      `,
    );

    if (estados.length === 0) {
      await connection.rollback();
      return res.status(500).json({ ok: false, message: "No existe el estado EN_REVISION configurado." });
    }

    await connection.query(
      `
      UPDATE incidencia
      SET
          id_estado_incidencia = ?,
          observacion_cierre = CASE WHEN ? = TRUE THEN ? ELSE NULL END,
          fecha_cierre = NULL,
          id_usuario_cierre = NULL,
          id_usuario_actualizacion = ?
      WHERE id_incidencia = ?
      `,
      [
        estados[0].id_estado_incidencia,
        `Reabierta por Super Administrador. Motivo: ${motivo}`,
        idUsuario,
        id_incidencia,
      ],
    );

    await connection.query(
      `
      INSERT INTO auditoria_log
      (id_usuario, tabla_afectada, id_registro_afectado, accion, descripcion, valor_anterior, valor_nuevo, user_agent)
      VALUES
      (?, 'incidencia', ?, 'UPDATE', 'Reapertura controlada de incidencia por Super Administrador.',
        JSON_OBJECT('estado_anterior', ?, 'observacion_cierre_anterior', ?, 'ticket_externo', ?),
        JSON_OBJECT('estado_nuevo', 'EN_REVISION', 'motivo_reapertura', ?),
        'API Node.js')
      `,
      [
        idUsuario,
        id_incidencia,
        incidenciaActual.estado_actual,
        incidenciaActual.observacion_cierre,
        incidenciaActual.ticket_externo,
        motivo,
      ],
    );

    await connection.query(
      `
      INSERT INTO incidencia_historial (id_incidencia, id_usuario, accion, descripcion)
      VALUES (?, ?, 'REAPERTURA', ?)
      `,
      [
        id_incidencia,
        idUsuario,
        `Se reabrio la incidencia desde ${incidenciaActual.estado_actual} a EN_REVISION. Motivo: ${motivo}.`,
      ],
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Incidencia reabierta correctamente.",
      data: {
        id_incidencia: Number(id_incidencia),
        ticket: generarTicketIncidencia(incidenciaActual.numero_ticket),
        estado: "EN_REVISION",
      },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ ok: false, message: "Error al reabrir incidencia.", error: error.message });
  } finally {
    connection.release();
  }
};

/*
==============================================================================
FUNCIÓN: subirEvidenciaIncidencia
------------------------------------------------------------------------------
Guarda una imagen asociada a una incidencia.
==============================================================================
*/
exports.subirEvidenciaIncidencia = async (req, res) => {
  const connection = await pool.getConnection();
  let cargaConfirmada = false;

  try {
    await connection.beginTransaction();

    const { id_incidencia } = req.params;
    const id_usuario_subida = req.usuario.id_usuario;

    if (!id_incidencia) {
      eliminarArchivoSubido(req.file);
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe indicar la incidencia.",
      });
    }

    if (!req.file) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar una imagen.",
      });
    }

    const [incidencias] = await connection.query(
      `
      SELECT
          i.id_incidencia,
          i.numero_ticket,
          i.id_usuario_reporta,
          ei.nombre AS estado_incidencia
      FROM incidencia i
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      WHERE i.id_incidencia = ?
      LIMIT 1
      `,
      [id_incidencia],
    );

    if (incidencias.length === 0) {
      eliminarArchivoSubido(req.file);
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: "La incidencia no existe.",
      });
    }

    const incidenciaActual = incidencias[0];
    const rolesGestionan = [
      "SUPER_ADMINISTRADOR",
      "ADMINISTRADOR",
      "TECNICO_SOPORTE",
    ];
    const esReportante =
      Number(incidenciaActual.id_usuario_reporta) ===
      Number(id_usuario_subida);
    const rolesReportantesEditan = ["DOCENTE", "ALUMNO_PRACTICA"];
    const puedeAgregarEvidencia =
      rolesGestionan.includes(req.usuario.nombre_rol) ||
      (rolesReportantesEditan.includes(req.usuario.nombre_rol) &&
        esReportante);

    if (!puedeAgregarEvidencia) {
      eliminarArchivoSubido(req.file);
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        message: "No tiene permisos para agregar evidencia a esta incidencia.",
      });
    }

    if (["RESUELTA", "CERRADA"].includes(incidenciaActual.estado_incidencia)) {
      eliminarArchivoSubido(req.file);
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        message:
          "No se puede agregar evidencia a una incidencia resuelta o cerrada.",
      });
    }

    const rutaArchivo = `/uploads/incidencias/${req.file.filename}`;

    const [resultado] = await connection.query(
      `
      INSERT INTO incidencia_evidencia
      (
        id_incidencia,
        nombre_archivo,
        ruta_archivo,
        tipo_mime,
        tamano_bytes,
        id_usuario_subida
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        id_incidencia,
        req.file.originalname,
        rutaArchivo,
        req.file.mimetype,
        req.file.size,
        id_usuario_subida,
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
        'incidencia_evidencia',
        ?,
        'INSERT',
        'Carga de evidencia fotográfica asociada a incidencia.',
        JSON_OBJECT(
          'id_incidencia', ?,
          'ruta_archivo', ?,
          'tipo_mime', ?
        ),
        'API Node.js'
      )
      `,
      [
        id_usuario_subida,
        resultado.insertId,
        id_incidencia,
        rutaArchivo,
        req.file.mimetype,
      ],
    );

    await connection.query(
      `
      INSERT INTO incidencia_historial
      (
        id_incidencia,
        id_usuario,
        accion,
        descripcion
      )
      VALUES (?, ?, 'EVIDENCIA', ?)
      `,
      [
        id_incidencia,
        id_usuario_subida,
        `Se agrego evidencia fotografica a la incidencia ${generarTicketIncidencia(
          incidenciaActual.numero_ticket,
        )}.`,
      ],
    );

    await connection.commit();
    cargaConfirmada = true;

    return res.status(201).json({
      ok: true,
      message: "Evidencia subida correctamente.",
      data: {
        id_evidencia: resultado.insertId,
        id_incidencia,
        nombre_archivo: req.file.originalname,
        ruta_archivo: rutaArchivo,
        url_publica: `http://localhost:${process.env.PORT || 3000}${rutaArchivo}`,
      },
    });
  } catch (error) {
    if (!cargaConfirmada) {
      eliminarArchivoSubido(req.file);
    }

    await connection.rollback();

    return res.status(500).json({
      ok: false,
      message: "Error al subir evidencia.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};


/*
==============================================================================
FUNCION: listarEvidenciasIncidencia
------------------------------------------------------------------------------
Retorna todas las evidencias fotograficas de una incidencia, dejando marcada la
ultima carga como evidencia vigente para el visor del frontend.
==============================================================================
*/
exports.listarEvidenciasIncidencia = async (req, res) => {
  try {
    const { id_incidencia } = req.params;

    const [incidencias] = await pool.query(
      `
      SELECT id_incidencia
      FROM incidencia
      WHERE id_incidencia = ?
      LIMIT 1
      `,
      [id_incidencia],
    );

    if (incidencias.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "La incidencia no existe.",
      });
    }

    const [evidencias] = await pool.query(
      `
      SELECT
          ie.id_evidencia,
          ie.id_incidencia,
          ie.nombre_archivo,
          ie.ruta_archivo,
          ie.tipo_mime,
          ie.tamano_bytes,
          ie.fecha_subida,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_subida
      FROM incidencia_evidencia ie
      LEFT JOIN usuario u
          ON ie.id_usuario_subida = u.id_usuario
      WHERE ie.id_incidencia = ?
      ORDER BY ie.fecha_subida DESC, ie.id_evidencia DESC
      `,
      [id_incidencia],
    );

    const evidenciasConEstado = evidencias.map((evidencia, index) => ({
      ...evidencia,
      vigente: index === 0,
    }));

    return res.json({
      ok: true,
      total: evidenciasConEstado.length,
      data: evidenciasConEstado,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener evidencias de incidencia.",
      error: error.message,
    });
  }
};

/*
==============================================================================
FUNCIÓN: obtenerHistorialIncidencia
------------------------------------------------------------------------------
Retorna el historial de acciones realizadas sobre una incidencia.
==============================================================================
*/
exports.obtenerHistorialIncidencia = async (req, res) => {
  try {
    const { id_incidencia } = req.params;

    const [historial] = await pool.query(
      `
      SELECT
          h.id_historial,
          h.accion,
          h.descripcion,
          h.fecha_registro,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario
      FROM incidencia_historial h
      INNER JOIN usuario u
          ON h.id_usuario = u.id_usuario
      WHERE h.id_incidencia = ?
      ORDER BY h.fecha_registro ASC
      `,
      [id_incidencia],
    );

    return res.json({
      ok: true,
      total: historial.length,
      data: historial,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error al obtener historial de incidencia.",
      error: error.message,
    });
  }
};



