// Controlador encargado de entregar indicadores KPI para el dashboard SGTSL.
const pool = require('../config/db');

/*
==============================================================================
FUNCION: obtenerKpiDashboard
DESCRIPCION:
Consulta las vistas KPI creadas en MySQL y retorna un resumen para el dashboard.
Se mantiene la logica estable del sistema y se aplican filtros de fecha sobre
incidencias, revisiones y bajas, que son los indicadores historicos.
==============================================================================
*/
exports.obtenerKpiDashboard = async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, edificio, sala } = req.query;
    const rolUsuario = req.usuario.nombre_rol;
    const puedeVerInventario = rolUsuario !== 'DOCENTE';
    const puedeVerBajas = ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR'].includes(
      rolUsuario
    );
    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
    const fechaDesde = formatoFecha.test(fecha_desde || "")
      ? fecha_desde
      : null;
    const fechaHasta = formatoFecha.test(fecha_hasta || "")
      ? fecha_hasta
      : null;
    const edificioFiltro =
      edificio && edificio !== "TODOS" ? String(edificio).trim() : null;
    const salaFiltro = sala && sala !== "TODOS" ? String(sala).trim() : null;

    const crearFiltroRevisiones = () => {
      const condiciones = [];
      const parametros = [];

      if (fechaDesde) {
        condiciones.push("DATE(r.fecha_revision) >= ?");
        parametros.push(fechaDesde);
      }

      if (fechaHasta) {
        condiciones.push("DATE(r.fecha_revision) <= ?");
        parametros.push(fechaHasta);
      }

      if (edificioFiltro) {
        condiciones.push("ed.nombre = ?");
        parametros.push(edificioFiltro);
      }

      if (salaFiltro) {
        condiciones.push("s.codigo = ?");
        parametros.push(salaFiltro);
      }

      return {
        sql: condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "",
        parametros,
      };
    };

    const crearFiltroIncidencias = () => {
      const condiciones = [];
      const parametros = [];

      if (fechaDesde) {
        condiciones.push("DATE(i.fecha_reporte) >= ?");
        parametros.push(fechaDesde);
      }

      if (fechaHasta) {
        condiciones.push("DATE(i.fecha_reporte) <= ?");
        parametros.push(fechaHasta);
      }

      if (edificioFiltro) {
        condiciones.push("ed.nombre = ?");
        parametros.push(edificioFiltro);
      }

      if (salaFiltro) {
        condiciones.push("s.codigo = ?");
        parametros.push(salaFiltro);
      }

      return {
        sql: condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "",
        parametros,
      };
    };

    const crearFiltroBajas = () => {
      const condiciones = [];
      const parametros = [];

      if (fechaDesde) {
        condiciones.push("DATE(b.fecha_solicitud) >= ?");
        parametros.push(fechaDesde);
      }

      if (fechaHasta) {
        condiciones.push("DATE(b.fecha_solicitud) <= ?");
        parametros.push(fechaHasta);
      }

      if (edificioFiltro) {
        condiciones.push("ed.nombre = ?");
        parametros.push(edificioFiltro);
      }

      if (salaFiltro) {
        condiciones.push("s.codigo = ?");
        parametros.push(salaFiltro);
      }

      return {
        sql: condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "",
        parametros,
      };
    };

    const crearFiltroAuditoria = () => {
      const condiciones = [];
      const parametros = [];

      if (fechaDesde) {
        condiciones.push("DATE(al.fecha_evento) >= ?");
        parametros.push(fechaDesde);
      }

      if (fechaHasta) {
        condiciones.push("DATE(al.fecha_evento) <= ?");
        parametros.push(fechaHasta);
      }

      if (edificioFiltro) {
        condiciones.push(
          `COALESCE(
            ed_sala.nombre,
            ed_revision.nombre,
            ed_incidencia.nombre,
            ed_equipo.nombre,
            ed_sala_equipo.nombre,
            ed_baja.nombre
          ) = ?`
        );
        parametros.push(edificioFiltro);
      }

      if (salaFiltro) {
        condiciones.push(
          `COALESCE(
            s_aud.codigo,
            s_revision.codigo,
            s_incidencia.codigo,
            s_equipo.codigo,
            s_sala_equipo.codigo,
            s_baja.codigo
          ) = ?`
        );
        parametros.push(salaFiltro);
      }

      return {
        joins: `
          LEFT JOIN sala s_aud
              ON al.tabla_afectada = 'sala'
             AND al.id_registro_afectado = s_aud.id_sala
          LEFT JOIN edificio ed_sala
              ON s_aud.id_edificio = ed_sala.id_edificio
          LEFT JOIN revision r_aud
              ON al.tabla_afectada = 'revision'
             AND al.id_registro_afectado = r_aud.id_revision
          LEFT JOIN sala s_revision
              ON r_aud.id_sala = s_revision.id_sala
          LEFT JOIN edificio ed_revision
              ON s_revision.id_edificio = ed_revision.id_edificio
          LEFT JOIN incidencia i_aud
              ON al.tabla_afectada = 'incidencia'
             AND al.id_registro_afectado = i_aud.id_incidencia
          LEFT JOIN sala s_incidencia
              ON i_aud.id_sala = s_incidencia.id_sala
          LEFT JOIN edificio ed_incidencia
              ON s_incidencia.id_edificio = ed_incidencia.id_edificio
          LEFT JOIN equipo e_aud
              ON al.tabla_afectada = 'equipo'
             AND al.id_registro_afectado = e_aud.id_equipo
          LEFT JOIN (
              SELECT se1.*
              FROM sala_equipo se1
              INNER JOIN (
                  SELECT id_equipo, MAX(id_sala_equipo) AS id_sala_equipo
                  FROM sala_equipo
                  GROUP BY id_equipo
              ) ultima_equipo
                  ON se1.id_sala_equipo = ultima_equipo.id_sala_equipo
          ) se_equipo
              ON e_aud.id_equipo = se_equipo.id_equipo
          LEFT JOIN sala s_equipo
              ON se_equipo.id_sala = s_equipo.id_sala
          LEFT JOIN edificio ed_equipo
              ON s_equipo.id_edificio = ed_equipo.id_edificio
          LEFT JOIN sala_equipo se_aud
              ON al.tabla_afectada = 'sala_equipo'
             AND al.id_registro_afectado = se_aud.id_sala_equipo
          LEFT JOIN sala s_sala_equipo
              ON se_aud.id_sala = s_sala_equipo.id_sala
          LEFT JOIN edificio ed_sala_equipo
              ON s_sala_equipo.id_edificio = ed_sala_equipo.id_edificio
          LEFT JOIN baja_equipo b_aud
              ON al.tabla_afectada = 'baja_equipo'
             AND al.id_registro_afectado = b_aud.id_baja_equipo
          LEFT JOIN equipo e_baja
              ON b_aud.id_equipo = e_baja.id_equipo
          LEFT JOIN (
              SELECT se2.*
              FROM sala_equipo se2
              INNER JOIN (
                  SELECT id_equipo, MAX(id_sala_equipo) AS id_sala_equipo
                  FROM sala_equipo
                  GROUP BY id_equipo
              ) ultima_baja
                  ON se2.id_sala_equipo = ultima_baja.id_sala_equipo
          ) se_baja
              ON e_baja.id_equipo = se_baja.id_equipo
          LEFT JOIN sala s_baja
              ON se_baja.id_sala = s_baja.id_sala
          LEFT JOIN edificio ed_baja
              ON s_baja.id_edificio = ed_baja.id_edificio
        `,
        ubicacion: `
          COALESCE(
            ed_sala.nombre,
            ed_revision.nombre,
            ed_incidencia.nombre,
            ed_equipo.nombre,
            ed_sala_equipo.nombre,
            ed_baja.nombre,
            'No asociado'
          ) AS edificio,
          COALESCE(
            s_aud.codigo,
            s_revision.codigo,
            s_incidencia.codigo,
            s_equipo.codigo,
            s_sala_equipo.codigo,
            s_baja.codigo,
            'No asociado'
          ) AS codigo_sala,
          COALESCE(
            s_aud.nombre,
            s_revision.nombre,
            s_incidencia.nombre,
            s_equipo.nombre,
            s_sala_equipo.nombre,
            s_baja.nombre,
            'No asociado'
          ) AS sala
        `,
        sql: condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "",
        parametros,
      };
    };
    const filtroIncidencias = crearFiltroIncidencias();
    const filtroRevisiones = crearFiltroRevisiones();
    const filtroBajas = crearFiltroBajas();
    const filtroAuditoria = crearFiltroAuditoria();

    const [resumen] = await pool.query('SELECT * FROM vw_kpi_resumen_general');
    const [incidenciasEstado] = await pool.query(
      `
      SELECT
          ei.nombre AS estado_incidencia,
          COUNT(i.id_incidencia) AS total_incidencias
      FROM incidencia i
      INNER JOIN estado_incidencia ei
          ON i.id_estado_incidencia = ei.id_estado_incidencia
      INNER JOIN sala s
          ON i.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroIncidencias.sql}
      GROUP BY ei.nombre
      ORDER BY total_incidencias DESC
      `,
      filtroIncidencias.parametros
    );
    const [incidenciasPrioridad] = await pool.query(
      `
      SELECT
          i.prioridad,
          COUNT(i.id_incidencia) AS total_incidencias
      FROM incidencia i
      INNER JOIN sala s
          ON i.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroIncidencias.sql}
      GROUP BY i.prioridad
      ORDER BY total_incidencias DESC
      `,
      filtroIncidencias.parametros
    );
    const [incidenciasSala] = await pool.query(
      `
      SELECT
          s.codigo AS codigo_sala,
          s.nombre AS nombre_sala,
          COUNT(i.id_incidencia) AS total_incidencias
      FROM incidencia i
      INNER JOIN sala s
          ON i.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroIncidencias.sql}
      GROUP BY s.codigo, s.nombre
      ORDER BY total_incidencias DESC
      LIMIT 10
      `,
      filtroIncidencias.parametros
    );
    const [incidenciasDetalle] = await pool.query(
      `
      SELECT
          CONCAT('SGTSL-INC-', LPAD(i.numero_ticket, 6, '0')) AS ticket,
          DATE_FORMAT(i.fecha_reporte, '%Y-%m-%d') AS fecha_reporte,
          ed.nombre AS edificio,
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          COALESCE(e.nombre_equipo, 'Sin equipo especifico') AS equipo,
          ti.nombre AS tipo_incidencia,
          i.prioridad,
          ei.nombre AS estado_incidencia,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_reporta,
          CASE WHEN ev.id_evidencia IS NULL THEN 'No' ELSE 'Si' END AS tiene_evidencia,
          CASE WHEN i.ticket_externo IS NULL OR i.ticket_externo = '' THEN 'No' ELSE 'Si' END AS tiene_ticket_institucional,
          COALESCE(i.ticket_externo, 'No asociado') AS ticket_institucional
      FROM incidencia i
      INNER JOIN sala s
          ON i.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
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
      LEFT JOIN (
          SELECT id_incidencia, MAX(id_evidencia) AS id_evidencia
          FROM incidencia_evidencia
          GROUP BY id_incidencia
      ) ev
          ON i.id_incidencia = ev.id_incidencia
      ${filtroIncidencias.sql}
      ORDER BY i.fecha_reporte DESC
      LIMIT 150
      `,
      filtroIncidencias.parametros
    );
    const [equiposEstado] = await pool.query('SELECT * FROM vw_kpi_equipos_por_estado');
    const [equiposTipo] = await pool.query('SELECT * FROM vw_kpi_equipos_por_tipo');
    const [bajasEstado] = await pool.query(
      `
      SELECT
          b.estado_baja,
          COUNT(b.id_baja_equipo) AS total_bajas
      FROM baja_equipo b
      INNER JOIN equipo e
          ON b.id_equipo = e.id_equipo
      LEFT JOIN (
          SELECT se.*
          FROM sala_equipo se
          INNER JOIN (
              SELECT id_equipo, MAX(id_sala_equipo) AS id_sala_equipo
              FROM sala_equipo
              GROUP BY id_equipo
          ) ultima
              ON se.id_sala_equipo = ultima.id_sala_equipo
      ) se
          ON e.id_equipo = se.id_equipo
      LEFT JOIN sala s
          ON se.id_sala = s.id_sala
      LEFT JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroBajas.sql}
      GROUP BY b.estado_baja
      ORDER BY total_bajas DESC
      `,
      filtroBajas.parametros
    );
    const [equiposBaja] = await pool.query(`
      SELECT COUNT(*) AS total_equipos_baja
      FROM equipo
      WHERE estado_activo = 'BAJA'
         OR eliminado_logico = TRUE
    `);
    const [revisionesMensuales] = await pool.query(
      `
      SELECT
          YEAR(r.fecha_revision) AS anio,
          MONTH(r.fecha_revision) AS mes,
          COUNT(r.id_revision) AS total_revisiones
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroRevisiones.sql}
      GROUP BY YEAR(r.fecha_revision), MONTH(r.fecha_revision)
      ORDER BY anio DESC, mes DESC
      LIMIT 12
      `,
      filtroRevisiones.parametros
    );
    const [salasRevisadasMensuales] = await pool.query(
      `
      SELECT
          YEAR(r.fecha_revision) AS anio,
          MONTH(r.fecha_revision) AS mes,
          COUNT(DISTINCT r.id_sala) AS total_salas_revisadas
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      ${filtroRevisiones.sql}
      GROUP BY YEAR(r.fecha_revision), MONTH(r.fecha_revision)
      ORDER BY anio DESC, mes DESC
      LIMIT 12
      `,
      filtroRevisiones.parametros
    );
    const [revisionesDetalle] = await pool.query(
      `
      SELECT
          CONCAT('REV-', LPAD(r.id_revision, 6, '0')) AS codigo_revision,
          DATE_FORMAT(r.fecha_revision, '%Y-%m-%d') AS fecha_revision,
          DATE_FORMAT(
            DATE_SUB(r.fecha_revision, INTERVAL WEEKDAY(r.fecha_revision) DAY),
            '%Y-%m-%d'
          ) AS semana_desde,
          DATE_FORMAT(
            DATE_ADD(
              DATE_SUB(r.fecha_revision, INTERVAL WEEKDAY(r.fecha_revision) DAY),
              INTERVAL 6 DAY
            ),
            '%Y-%m-%d'
          ) AS semana_hasta,
          YEARWEEK(r.fecha_revision, 1) AS semana_codigo,
          ed.nombre AS edificio,
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_revisor,
          UPPER(
            CONCAT(
              LEFT(COALESCE(u.nombres, ''), 1),
              LEFT(COALESCE(u.apellidos, ''), 1)
            )
          ) AS iniciales_revisor,
          r.estado_revision_general,
          COUNT(rcd.id_revision_checklist_detalle) AS total_checks,
          SUM(CASE WHEN rcd.estado_item = 'OK' THEN 1 ELSE 0 END) AS total_ok,
          SUM(CASE WHEN rcd.estado_item = 'CON_PROBLEMA' THEN 1 ELSE 0 END) AS total_problema,
          SUM(CASE WHEN rcd.estado_item = 'NO_APLICA' THEN 1 ELSE 0 END) AS total_no_aplica
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      INNER JOIN usuario u
          ON r.id_usuario_revisor = u.id_usuario
      LEFT JOIN revision_checklist_detalle rcd
          ON r.id_revision = rcd.id_revision
      ${filtroRevisiones.sql}
      GROUP BY
          r.id_revision,
          r.fecha_revision,
          ed.nombre,
          s.codigo,
          s.nombre,
          u.nombres,
          u.apellidos,
          r.estado_revision_general
      ORDER BY r.fecha_revision DESC
      LIMIT 100
      `,
      filtroRevisiones.parametros
    );
    const [auditoriaAccion] = await pool.query('SELECT * FROM vw_kpi_auditoria_por_accion');
    const [auditoriaActividadUsuario] = await pool.query(
      `
      SELECT
          COALESCE(CONCAT(u.nombres, ' ', u.apellidos), 'Usuario no identificado') AS usuario,
          COUNT(al.id_auditoria) AS total_eventos,
          COUNT(DISTINCT al.tabla_afectada) AS modulos_afectados,
          SUM(CASE WHEN al.accion = 'INSERT' THEN 1 ELSE 0 END) AS altas_registradas,
          SUM(CASE WHEN al.accion = 'UPDATE' THEN 1 ELSE 0 END) AS actualizaciones,
          SUM(CASE WHEN al.accion IN ('BAJA_EQUIPO', 'GENERACION_QR') THEN 1 ELSE 0 END) AS acciones_especiales,
          DATE_FORMAT(MIN(al.fecha_evento), '%Y-%m-%d %H:%i') AS primer_evento,
          DATE_FORMAT(MAX(al.fecha_evento), '%Y-%m-%d %H:%i') AS ultimo_evento
      FROM auditoria_log al
      LEFT JOIN usuario u
          ON al.id_usuario = u.id_usuario
      ${filtroAuditoria.joins}
      ${filtroAuditoria.sql}
      GROUP BY u.id_usuario, u.nombres, u.apellidos
      ORDER BY total_eventos DESC, ultimo_evento DESC
      LIMIT 25
      `,
      filtroAuditoria.parametros
    );
    const [auditoriaModulo] = await pool.query(
      `
      SELECT
          al.tabla_afectada AS modulo,
          al.accion,
          COUNT(al.id_auditoria) AS total_eventos,
          DATE_FORMAT(MAX(al.fecha_evento), '%Y-%m-%d %H:%i') AS ultimo_evento
      FROM auditoria_log al
      ${filtroAuditoria.joins}
      ${filtroAuditoria.sql}
      GROUP BY al.tabla_afectada, al.accion
      ORDER BY total_eventos DESC, ultimo_evento DESC
      LIMIT 50
      `,
      filtroAuditoria.parametros
    );
    const [auditoriaEventosRecientes] = await pool.query(
      `
      SELECT
          DATE_FORMAT(al.fecha_evento, '%Y-%m-%d %H:%i') AS fecha_evento,
          COALESCE(CONCAT(u.nombres, ' ', u.apellidos), 'Usuario no identificado') AS usuario,
          al.tabla_afectada AS modulo,
          al.accion,
          al.descripcion,
          ${filtroAuditoria.ubicacion},
          al.id_registro_afectado AS registro_afectado
      FROM auditoria_log al
      LEFT JOIN usuario u
          ON al.id_usuario = u.id_usuario
      ${filtroAuditoria.joins}
      ${filtroAuditoria.sql}
      ORDER BY al.fecha_evento DESC
      LIMIT 80
      `,
      filtroAuditoria.parametros
    );

    const filtroAuditoriaSensibles = filtroAuditoria.sql
      ? `${filtroAuditoria.sql} AND (
          al.tabla_afectada IN ('usuario', 'usuario_rol', 'baja_equipo')
          OR al.accion IN ('BAJA_EQUIPO', 'GENERACION_QR')
          OR LOWER(al.descripcion) LIKE '%anul%'
          OR LOWER(al.descripcion) LIKE '%rol%'
          OR LOWER(al.descripcion) LIKE '%password%'
          OR LOWER(al.descripcion) LIKE '%contrasena%'
        )`
      : `WHERE (
          al.tabla_afectada IN ('usuario', 'usuario_rol', 'baja_equipo')
          OR al.accion IN ('BAJA_EQUIPO', 'GENERACION_QR')
          OR LOWER(al.descripcion) LIKE '%anul%'
          OR LOWER(al.descripcion) LIKE '%rol%'
          OR LOWER(al.descripcion) LIKE '%password%'
          OR LOWER(al.descripcion) LIKE '%contrasena%'
        )`;

    const [auditoriaEventosSensibles] = await pool.query(
      `
      SELECT
          DATE_FORMAT(al.fecha_evento, '%Y-%m-%d %H:%i') AS fecha_evento,
          COALESCE(CONCAT(u.nombres, ' ', u.apellidos), 'Usuario no identificado') AS usuario,
          al.tabla_afectada AS modulo,
          al.accion,
          al.descripcion,
          ${filtroAuditoria.ubicacion},
          al.id_registro_afectado AS registro_afectado
      FROM auditoria_log al
      LEFT JOIN usuario u
          ON al.id_usuario = u.id_usuario
      ${filtroAuditoria.joins}
      ${filtroAuditoriaSensibles}
      ORDER BY al.fecha_evento DESC
      LIMIT 80
      `,
      filtroAuditoria.parametros
    );
    const [equiposAsignacion] = await pool.query(`
      SELECT
          CASE
            WHEN se.id_sala_equipo IS NULL THEN 'NO_ASIGNADO'
            ELSE 'ASIGNADO'
          END AS estado_asignacion,
          COUNT(e.id_equipo) AS total_equipos
      FROM equipo e
      LEFT JOIN (
          SELECT id_equipo, MIN(id_sala_equipo) AS id_sala_equipo
          FROM sala_equipo
          WHERE estado_asignacion = 'ACTIVA'
          GROUP BY id_equipo
      ) se
          ON e.id_equipo = se.id_equipo
      WHERE e.eliminado_logico = FALSE
        AND e.estado_activo <> 'BAJA'
        AND (
          se.id_sala_equipo IS NOT NULL
          OR e.estado_activo = 'OPERATIVO'
        )
      GROUP BY estado_asignacion
      ORDER BY estado_asignacion
    `);
    const [salasRevisionSemanal] = await pool.query(`
      SELECT
          SUM(
            CASE
              WHEN r.id_revision IS NULL THEN 1
              ELSE 0
            END
          ) AS salas_pendientes,
          SUM(
            CASE
              WHEN r.id_revision IS NULL THEN 0
              ELSE 1
            END
          ) AS salas_al_dia
      FROM sala s
      LEFT JOIN (
          SELECT id_sala, MAX(id_revision) AS id_revision
          FROM revision
          WHERE YEARWEEK(fecha_revision, 1) = YEARWEEK(CURDATE(), 1)
            AND estado_revision_general <> 'ANULADA'
          GROUP BY id_sala
      ) r
          ON s.id_sala = r.id_sala
      WHERE s.eliminado_logico = FALSE
    `);
    const [salasRevisadasSemana] = await pool.query(`
      SELECT
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          ed.nombre AS edificio,
          DATE_FORMAT(r.fecha_revision, '%Y-%m-%d %H:%i') AS fecha_revision,
          CONCAT(u.nombres, ' ', u.apellidos) AS usuario_revisor,
          UPPER(
            CONCAT(
              LEFT(COALESCE(u.nombres, ''), 1),
              LEFT(COALESCE(u.apellidos, ''), 1)
            )
          ) AS iniciales_revisor
      FROM revision r
      INNER JOIN sala s
          ON r.id_sala = s.id_sala
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      INNER JOIN usuario u
          ON r.id_usuario_revisor = u.id_usuario
      WHERE YEARWEEK(r.fecha_revision, 1) = YEARWEEK(CURDATE(), 1)
        AND r.estado_revision_general <> 'ANULADA'
        AND s.eliminado_logico = FALSE
      ORDER BY r.fecha_revision DESC
      LIMIT 100
    `);
    const [salasPendientesRevision] = await pool.query(`
      SELECT
          s.codigo AS codigo_sala,
          s.nombre AS sala,
          ed.nombre AS edificio
      FROM sala s
      INNER JOIN edificio ed
          ON s.id_edificio = ed.id_edificio
      LEFT JOIN (
          SELECT id_sala, MAX(id_revision) AS id_revision
          FROM revision
          WHERE YEARWEEK(fecha_revision, 1) = YEARWEEK(CURDATE(), 1)
            AND estado_revision_general <> 'ANULADA'
          GROUP BY id_sala
      ) r
          ON s.id_sala = r.id_sala
      WHERE s.eliminado_logico = FALSE
        AND r.id_revision IS NULL
      ORDER BY ed.nombre, s.codigo
      LIMIT 150
    `);

    return res.json({
      ok: true,
      message: 'KPI del dashboard obtenidos correctamente.',
      data: {
        resumen: resumen[0],
        incidenciasEstado,
        incidenciasPrioridad,
        incidenciasSala,
        incidenciasDetalle,
        equiposEstado: puedeVerInventario ? equiposEstado : [],
        equiposTipo: puedeVerInventario ? equiposTipo : [],
        bajasEstado: puedeVerBajas ? bajasEstado : [],
        equiposBaja: puedeVerBajas
          ? equiposBaja[0]
          : { total_equipos_baja: 0 },
        equiposAsignacion: puedeVerInventario ? equiposAsignacion : [],
        salasRevisionSemanal: salasRevisionSemanal[0],
        salasRevisadasSemana,
        salasPendientesRevision,
        revisionesMensuales,
        salasRevisadasMensuales,
        revisionesDetalle,
        auditoriaAccion,
        auditoriaActividadUsuario,
        auditoriaModulo,
        auditoriaEventosRecientes,
        auditoriaEventosSensibles,
        filtros: {
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          edificio: edificioFiltro,
          sala: salaFiltro
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener KPI del dashboard.',
      error: error.message
    });
  }
};

