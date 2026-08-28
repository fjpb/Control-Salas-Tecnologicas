// Pantalla de reportes SGTSL.
// Reutiliza los KPI del dashboard y presenta vistas diferenciadas segun el rol activo.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

import MainLayout from '../../layouts/MainLayout';
import { obtenerKpiDashboard } from '../../services/dashboardService';
import { listarSalas } from '../../services/salasService';

function ReportesPage({ vista = 'general' }) {
  const [kpi, setKpi] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [periodoRapido, setPeriodoRapido] = useState('TODOS');
  const [salas, setSalas] = useState([]);
  const [filtroEdificio, setFiltroEdificio] = useState('TODOS');
  const [filtroSala, setFiltroSala] = useState('TODOS');
  const [tablasExpandidas, setTablasExpandidas] = useState({});

  const usuarioSesion = (() => {
    try {
      return JSON.parse(localStorage.getItem('sgtsl_usuario')) || {};
    } catch {
      return {};
    }
  })();

  const rolUsuario = usuarioSesion?.rol || '';
  const esAdministracion = ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR'].includes(
    rolUsuario
  );
  const esTecnico = rolUsuario === 'TECNICO_SOPORTE';
  const esAlumno = rolUsuario === 'ALUMNO_PRACTICA';

  const puedeVerEjecutivo = esAdministracion;
  const puedeVerTecnico = esAdministracion || esTecnico || esAlumno;
  const puedeVerAuditoria = esAdministracion;

  useEffect(() => {
    cargarReportes();
    cargarSalasReporte();
  }, []);

  const edificiosDisponibles = useMemo(() => {
    return Array.from(
      new Set(salas.map((sala) => sala.edificio).filter(Boolean))
    ).sort();
  }, [salas]);

  const salasDisponibles = useMemo(() => {
    return salas
      .filter(
        (sala) =>
          filtroEdificio === 'TODOS' || sala.edificio === filtroEdificio
      )
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [salas, filtroEdificio]);

  const salasPorCodigo = useMemo(() => {
    return salas.reduce((acumulador, sala) => {
      acumulador[sala.codigo] = sala;
      return acumulador;
    }, {});
  }, [salas]);

  async function cargarReportes(filtros = {}) {
    try {
      setCargando(true);

      const respuesta = await obtenerKpiDashboard(filtros);

      if (!respuesta.ok) {
        throw new Error(respuesta.message);
      }

      setKpi(respuesta.data);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar reportes',
        text:
          error.response?.data?.message ||
          'No fue posible obtener la informacion de reportes.'
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarSalasReporte() {
    try {
      const respuesta = await listarSalas();
      setSalas(respuesta.data || []);
    } catch {
      setSalas([]);
    }
  }

  function obtenerFechaActual() {
    return new Date().toISOString().slice(0, 10);
  }

  function obtenerInicioMesActual() {
    const fecha = new Date();
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  }

  function obtenerInicioAnioActual() {
    const fecha = new Date();
    return new Date(fecha.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }

  function obtenerFechaDiasAtras(dias) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return fecha.toISOString().slice(0, 10);
  }

  function aplicarPeriodoRapido(periodo) {
    setPeriodoRapido(periodo);

    if (periodo === 'TODOS') {
      setFechaDesde('');
      setFechaHasta('');
      return;
    }

    const hoy = obtenerFechaActual();
    setFechaHasta(hoy);

    if (periodo === 'HOY') {
      setFechaDesde(hoy);
      return;
    }

    if (periodo === 'ULTIMOS_7') {
      setFechaDesde(obtenerFechaDiasAtras(6));
      return;
    }

    if (periodo === 'MES_ACTUAL') {
      setFechaDesde(obtenerInicioMesActual());
      return;
    }

    if (periodo === 'ANIO_ACTUAL') {
      setFechaDesde(obtenerInicioAnioActual());
    }
  }

  function aplicarFiltrosReportes() {
    cargarReportes({
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      edificio: filtroEdificio !== 'TODOS' ? filtroEdificio : undefined,
      sala: filtroSala !== 'TODOS' ? filtroSala : undefined
    });
  }

  function limpiarFiltrosReportes() {
    setPeriodoRapido('TODOS');
    setFechaDesde('');
    setFechaHasta('');
    setFiltroEdificio('TODOS');
    setFiltroSala('TODOS');
    cargarReportes();
  }

  function valorNumero(valor) {
    return Number(valor || 0);
  }

  function formatearEtiqueta(campo) {
    const etiquetas = {
      accion: 'Tipo de movimiento',
      acciones_especiales: 'Acciones especiales',
      actualizaciones: 'Actualizaciones',
      altas_registradas: 'Altas registradas',
      anio: 'Anio',
      codigo_sala: 'Codigo sala',
      descripcion: 'Detalle del movimiento',
      edificio: 'Edificio',
      estado_activo: 'Estado equipo',
      estado_asignacion: 'Asignacion',
      estado_baja: 'Estado baja',
      estado_incidencia: 'Estado incidencia',
      fecha_evento: 'Fecha evento',
      id_accion: 'Accion',
      mes: 'Mes',
      modulo: 'Area del sistema',
      modulos_afectados: 'Areas afectadas',
      nombre_sala: 'Sala',
      primer_evento: 'Primer evento',
      prioridad: 'Prioridad',
      registro_afectado: 'Registro interno',
      tipo_equipo: 'Tipo equipo',
      total: 'Total',
      total_bajas: 'Total bajas',
      total_equipos: 'Total equipos',
      total_incidencias: 'Total incidencias',
      total_revisiones: 'Total revisiones',
      ultimo_evento: 'Ultimo evento',
      usuario: 'Usuario'
    };

    return (
      etiquetas[campo] ||
      campo
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letra) => letra.toUpperCase())
    );
  }


  function obtenerColumnasReporte(titulo, registros = []) {
    const columnasPorTitulo = {
      'Anexo - revisiones realizadas': [
        'codigo_revision',
        'fecha_revision',
        'semana_desde',
        'semana_hasta',
        'codigo_sala',
        'sala',
        'usuario_revisor',
        'iniciales_revisor',
        'estado_revision_general'
      ],
      'Revisiones realizadas': [
        'codigo_revision',
        'fecha_revision',
        'semana_desde',
        'semana_hasta',
        'codigo_sala',
        'sala',
        'usuario_revisor',
        'iniciales_revisor',
        'estado_revision_general',
        'total_checks',
        'total_ok',
        'total_problema',
        'total_no_aplica'
      ],
      'Salas con mas incidencias': [
        'codigo_sala',
        'nombre_sala',
        'total_incidencias'
      ],
      'Incidencias por estado': ['estado_incidencia', 'total_incidencias'],
      'Incidencias por prioridad': ['prioridad', 'total_incidencias'],
      'Detalle de incidencias': [
        'ticket',
        'fecha_reporte',
        'codigo_sala',
        'sala',
        'equipo',
        'tipo_incidencia',
        'prioridad',
        'estado_incidencia',
        'usuario_reporta',
        'tiene_evidencia',
        'tiene_ticket_institucional'
      ],
      'Revisiones mensuales': ['anio', 'mes', 'total_revisiones'],
      'Salas revisadas por mes': ['anio', 'mes', 'total_salas_revisadas'],
      'Bajas por estado': ['estado_baja', 'total_bajas'],
      'Equipos por estado': ['estado_activo', 'total_equipos'],
      'Equipos por asignacion': ['estado_asignacion', 'total_equipos'],
      'Equipos por tipo': ['tipo_equipo', 'total_equipos'],
      'Actividad por usuario': [
        'usuario',
        'total_eventos',
        'modulos_afectados',
        'altas_registradas',
        'actualizaciones',
        'acciones_especiales',
        'primer_evento',
        'ultimo_evento'
      ],
      'Actividad por area del sistema': ['modulo', 'accion', 'total_eventos', 'ultimo_evento'],
      'Actividad reciente del sistema': [
        'fecha_evento',
        'usuario',
        'modulo',
        'accion',
        'descripcion',
        'edificio',
        'codigo_sala',
        'sala',
        'registro_afectado'
      ],
      'Movimientos administrativos sensibles': [
        'fecha_evento',
        'usuario',
        'modulo',
        'accion',
        'descripcion',
        'edificio',
        'codigo_sala',
        'sala',
        'registro_afectado'
      ]
    };

    const columnasDefinidas = columnasPorTitulo[titulo];

    if (columnasDefinidas) {
      return columnasDefinidas;
    }

    return registros.length > 0 ? Object.keys(registros[0]) : [];
  }

  function obtenerTituloReporte() {
    if (vista === 'ejecutivo') {
      return 'Reporte ejecutivo';
    }

    if (vista === 'tecnico') {
      return 'Reporte tecnico operativo';
    }

    if (vista === 'auditoria') {
      return 'Reporte de auditoria';
    }

    return 'Reportes SGTSL';
  }

  function obtenerDescripcionReporte() {
    if (vista === 'ejecutivo') {
      return 'Vista institucional con indicadores agregados para toma de decisiones y seguimiento general.';
    }

    if (vista === 'tecnico') {
      return 'Vista operativa para priorizar trabajo diario, revisiones, incidencias y salas que requieren atencion.';
    }

    if (vista === 'auditoria') {
      return 'Consolidado de acciones registradas para trazabilidad y control interno.';
    }

    return 'Seleccione un reporte disponible segun el rol activo en el sistema.';
  }

  function tieneAccesoVistaActual() {
    if (vista === 'ejecutivo') {
      return puedeVerEjecutivo;
    }

    if (vista === 'tecnico') {
      return puedeVerTecnico;
    }

    if (vista === 'auditoria') {
      return puedeVerAuditoria;
    }

    return puedeVerEjecutivo || puedeVerTecnico || puedeVerAuditoria;
  }

  function renderTarjeta(titulo, valor, descripcion, color = 'primary') {
    return (
      <div className="col" key={titulo}>
        <div className={`card sgtsl-card h-100 border-start border-5 border-${color}`}>
          <div className="card-body">
            <h6 className="text-muted">{titulo}</h6>
            <h2 className="fw-bold">{valorNumero(valor)}</h2>
            <small>{descripcion}</small>
          </div>
        </div>
      </div>
    );
  }

  function renderAccesoReporte(titulo, descripcion, ruta, icono, color = 'primary') {
    return (
      <div className="col" key={ruta}>
        <div className={`card sgtsl-card h-100 border-start border-5 border-${color}`}>
          <div className="card-body d-flex flex-column">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className={`bi ${icono} fs-4 text-${color}`}></i>
              <h5 className="fw-bold mb-0">{titulo}</h5>
            </div>

            <p className="text-muted flex-grow-1 mb-3">{descripcion}</p>

            <Link to={ruta} className="btn btn-outline-primary align-self-start">
              Abrir reporte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function alternarTablaExpandida(titulo) {
    setTablasExpandidas((estadoActual) => ({
      ...estadoActual,
      [titulo]: !estadoActual[titulo]
    }));
  }

  function renderTabla(titulo, registros, descripcion = '') {
    const filas = registros || [];
    const columnas = obtenerColumnasReporte(titulo, filas);
    const limiteInicial = 8;
    const estaExpandida = Boolean(tablasExpandidas[titulo]);
    const permiteContraer = filas.length > limiteInicial;
    const filasVisibles = permiteContraer && !estaExpandida
      ? filas.slice(0, limiteInicial)
      : filas;

    return (
      <div className="card sgtsl-card h-100">
        <div className="card-header bg-white d-flex flex-column flex-lg-row justify-content-between gap-2">
          <div>
            <strong>{titulo}</strong>
            {filas.length > 0 && (
              <small className="text-muted ms-2">
                Mostrando {filasVisibles.length} de {filas.length}
              </small>
            )}
            {descripcion && <small className="text-muted ms-2">{descripcion}</small>}
          </div>

          {permiteContraer && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary align-self-start align-self-lg-center"
              onClick={() => alternarTablaExpandida(titulo)}
            >
              <i className={`bi ${estaExpandida ? 'bi-arrows-collapse' : 'bi-arrows-expand'} me-1`}></i>
              {estaExpandida ? 'Contraer lista' : 'Expandir lista'}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-striped align-middle mb-0">
            <thead>
              <tr>
                {columnas.length > 0 ? (
                  columnas.map((columna) => (
                    <th key={columna}>{formatearEtiqueta(columna)}</th>
                  ))
                ) : (
                  <th>Resultado</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filasVisibles.length > 0 ? (
                filasVisibles.map((fila, indice) => (
                  <tr key={`${titulo}-${indice}`}>
                    {columnas.map((columna) => (
                      <td key={columna}>{fila[columna] ?? 'Sin dato'}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={Math.max(columnas.length, 1)}
                    className="text-center text-muted"
                  >
                    No existen datos disponibles para este reporte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function obtenerFiltrosAplicadosTexto() {
    const filtros = [];

    if (fechaDesde && fechaHasta) {
      filtros.push(`Desde ${fechaDesde} hasta ${fechaHasta}`);
    } else if (fechaDesde) {
      filtros.push(`Desde ${fechaDesde}`);
    } else if (fechaHasta) {
      filtros.push(`Hasta ${fechaHasta}`);
    }

    if (filtroEdificio !== 'TODOS') {
      filtros.push(`Edificio: ${filtroEdificio}`);
    }

    if (filtroSala !== 'TODOS') {
      filtros.push(`Sala: ${filtroSala}`);
    }

    return filtros.length > 0 ? filtros.join(' | ') : 'Todos los registros';
  }

  function filtrarRegistrosPorSala(registros = []) {
    return registros.filter((registro) => {
      const codigoSala = registro.codigo_sala || registro.codigo;
      const nombreSala = registro.nombre_sala || registro.sala;

      // Si la seccion no contiene datos de sala, se mantiene completa.
      if (!codigoSala && !nombreSala) {
        return true;
      }

      const salaRelacionada = salasPorCodigo[codigoSala];

      const cumpleEdificio =
        filtroEdificio === 'TODOS' ||
        salaRelacionada?.edificio === filtroEdificio ||
        registro.edificio === filtroEdificio;

      const cumpleSala =
        filtroSala === 'TODOS' ||
        codigoSala === filtroSala ||
        nombreSala === filtroSala;

      return cumpleEdificio && cumpleSala;
    });
  }

  function obtenerRevisionesEjecutivas() {
    return filtrarRegistrosPorSala(kpi.revisionesDetalle || []).map(
      (revision) => ({
        codigo_revision: revision.codigo_revision,
        fecha_revision: revision.fecha_revision,
        semana_desde: revision.semana_desde,
        semana_hasta: revision.semana_hasta,
        edificio: revision.edificio,
        codigo_sala: revision.codigo_sala,
        sala: revision.sala,
        usuario_revisor: revision.usuario_revisor,
        iniciales_revisor: revision.iniciales_revisor,
        estado_revision_general: revision.estado_revision_general,
      }),
    );
  }

  function hayFiltrosActivosReporte() {
    return Boolean(fechaDesde || fechaHasta || filtroEdificio !== 'TODOS' || filtroSala !== 'TODOS');
  }
  function esEventoSensibleAuditoria(evento = {}) {
    const modulo = String(evento.modulo || '').toLowerCase();
    const accion = String(evento.accion || '').toUpperCase();
    const descripcion = String(evento.descripcion || '').toLowerCase();

    return (
      ['usuario', 'usuario_rol', 'baja_equipo'].includes(modulo) ||
      ['BAJA_EQUIPO', 'GENERACION_QR'].includes(accion) ||
      descripcion.includes('anul') ||
      descripcion.includes('rol') ||
      descripcion.includes('password') ||
      descripcion.includes('contrasena')
    );
  }

  function obtenerNombreModuloAuditoria(modulo) {
    const modulos = {
      auditoria_log: 'Auditoria del sistema',
      baja_equipo: 'Baja de equipos',
      equipo: 'Inventario de equipos',
      incidencia: 'Gestion de incidencias',
      incidencia_evidencia: 'Evidencias de incidencias',
      revision: 'Revisiones tecnicas',
      sala: 'Gestion de salas',
      sala_equipo: 'Asignacion de equipos',
      tipo_equipo: 'Tipos de equipo',
      usuario: 'Usuarios',
      usuario_rol: 'Roles de usuario'
    };

    return modulos[modulo] || formatearEtiqueta(String(modulo || 'Sin modulo'));
  }

  function obtenerNombreAccionAuditoria(accion) {
    const acciones = {
      INSERT: 'Registro creado',
      UPDATE: 'Actualizacion de datos',
      BAJA_EQUIPO: 'Proceso de baja',
      GENERACION_QR: 'Generacion de QR'
    };

    return acciones[accion] || formatearEtiqueta(String(accion || 'Sin accion'));
  }

  function prepararEventosAuditoria(registros = []) {
    return registros.map((evento) => ({
      ...evento,
      modulo: obtenerNombreModuloAuditoria(evento.modulo),
      accion: obtenerNombreAccionAuditoria(evento.accion),
      descripcion: evento.descripcion || 'Movimiento registrado para trazabilidad.',
      edificio: evento.edificio || 'No asociado',
      codigo_sala: evento.codigo_sala || 'No asociado',
      sala: evento.sala || 'No asociado',
    }));
  }


  function obtenerSeccionesReporte() {
    if (!kpi) {
      return [];
    }

    if (vista === 'ejecutivo') {
      return [
        {
          titulo: 'Incidencias por estado',
          descripcion: 'Respeta los filtros aplicados de fecha, edificio y sala.',
          registros: filtrarRegistrosPorSala(kpi.incidenciasEstado)
        },
        {
          titulo: 'Revisiones mensuales',
          descripcion: 'Respeta los filtros aplicados de fecha, edificio y sala.',
          registros: filtrarRegistrosPorSala(kpi.revisionesMensuales)
        },
        {
          titulo: 'Salas revisadas por mes',
          descripcion: 'Respeta los filtros aplicados de fecha, edificio y sala.',
          registros: filtrarRegistrosPorSala(kpi.salasRevisadasMensuales)
        },
        {
          titulo: 'Bajas por estado',
          descripcion: 'Respeta fecha y, cuando existe asignacion historica, edificio y sala.',
          registros: filtrarRegistrosPorSala(kpi.bajasEstado)
        },
        {
          titulo: 'Equipos por estado',
          descripcion: 'Consolidado general del inventario; se muestra solo sin filtros aplicados.',
          consolidadoGeneral: true,
          registros: filtrarRegistrosPorSala(kpi.equiposEstado)
        },
        {
          titulo: 'Anexo - revisiones realizadas',
          descripcion: 'Vista ejecutiva: fecha, semana, sala, revisor y estado. El detalle de checks queda en Operacion tecnica.',
          registros: obtenerRevisionesEjecutivas()
        }
      ];
    }

    if (vista === 'tecnico') {
      return [
        {
          titulo: 'Detalle de incidencias',
          descripcion: 'Listado operativo de tickets, sala, estado, prioridad, evidencia y ticket institucional.',
          registros: filtrarRegistrosPorSala(kpi.incidenciasDetalle)
        },
        {
          titulo: 'Salas con mas incidencias',
          descripcion: 'Respeta los filtros aplicados y prioriza seguimiento operativo.',
          registros: filtrarRegistrosPorSala(kpi.incidenciasSala)
        },
        {
          titulo: 'Incidencias por prioridad',
          descripcion: 'Respeta los filtros aplicados de fecha, edificio y sala.',
          registros: filtrarRegistrosPorSala(kpi.incidenciasPrioridad)
        },
        {
          titulo: 'Revisiones realizadas',
          descripcion: 'Detalle operativo con semana, sala, revisor, iniciales y resultados del checklist.',
          registros: filtrarRegistrosPorSala(kpi.revisionesDetalle)
        },
        {
          titulo: 'Equipos por asignacion',
          descripcion: 'Consolidado general del inventario; se muestra solo sin filtros aplicados.',
          consolidadoGeneral: true,
          registros: filtrarRegistrosPorSala(kpi.equiposAsignacion)
        },
        {
          titulo: 'Equipos por tipo',
          descripcion: 'Consolidado general del inventario; se muestra solo sin filtros aplicados.',
          consolidadoGeneral: true,
          registros: filtrarRegistrosPorSala(kpi.equiposTipo)
        }
      ];
    }

    if (vista === 'auditoria') {
      const eventosRecientes = filtrarRegistrosPorSala(
        kpi.auditoriaEventosRecientes
      );
      const eventosSensibles = filtrarRegistrosPorSala(
        kpi.auditoriaEventosSensibles
      );

      return [
        {
          titulo: 'Actividad reciente del sistema',
          descripcion: 'Muestra movimientos operativos recientes. Las acciones administrativas sensibles se separan para evitar duplicidad.',
          registros: prepararEventosAuditoria(
            eventosRecientes.filter((evento) => !esEventoSensibleAuditoria(evento))
          )
        },
        {
          titulo: 'Movimientos administrativos sensibles',
          descripcion: 'Concentra cambios que requieren mayor control: usuarios, roles, bajas, anulaciones, QR y seguridad.',
          registros: prepararEventosAuditoria(eventosSensibles)
        },
        {
          titulo: 'Actividad por usuario',
          descripcion: 'Resumen filtrable de acciones registradas por cada usuario del sistema.',
          registros: filtrarRegistrosPorSala(kpi.auditoriaActividadUsuario)
        },
        {
          titulo: 'Actividad por area del sistema',
          descripcion: 'Distribucion filtrable de movimientos por area del sistema y tipo de accion.',
          registros: prepararEventosAuditoria(filtrarRegistrosPorSala(kpi.auditoriaModulo))
        },
        {
          titulo: 'Auditoria por accion',
          descripcion: 'Consolidado general historico; se muestra solo sin filtros aplicados para no mezclarlo con tablas filtrables.',
          consolidadoGeneral: true,
          registros: filtrarRegistrosPorSala(kpi.auditoriaAccion)
        }
      ];
    }

    return [
      puedeVerEjecutivo
        ? {
            titulo: 'Resumen ejecutivo',
            descripcion: 'Indicadores ejecutivos segun filtros aplicados.',
            registros: filtrarRegistrosPorSala(kpi.incidenciasEstado)
          }
        : null,
      puedeVerTecnico
        ? {
            titulo: 'Operacion tecnica',
            descripcion: 'Priorizacion tecnica segun filtros aplicados.',
            registros: filtrarRegistrosPorSala(kpi.incidenciasSala)
          }
        : null,
      puedeVerAuditoria
        ? {
            titulo: 'Auditoria por accion',
            descripcion: 'Consolidado general de trazabilidad; se muestra solo sin filtros aplicados.',
            consolidadoGeneral: true,
            registros: filtrarRegistrosPorSala(kpi.auditoriaAccion)
          }
        : null
    ].filter(Boolean);
  }

  function obtenerSeccionesConDatosReporte() {
    const tieneFiltros = hayFiltrosActivosReporte();

    return obtenerSeccionesReporte().filter(
      (seccion) =>
        Array.isArray(seccion.registros) &&
        seccion.registros.length > 0 &&
        !(tieneFiltros && seccion.consolidadoGeneral),
    );
  }

  function obtenerClaseSeccionReporte(seccion) {
    const registros = seccion.registros || [];
    const esDetalle = registros.length > 0 && obtenerColumnasReporte(seccion.titulo, registros).length > 6;
    return esDetalle ? 'col-12' : 'col-lg-6';
  }

  function renderSeccionesReporte() {
    const secciones = obtenerSeccionesConDatosReporte();

    if (secciones.length === 0) {
      return (
        <div className="alert alert-info mb-0">
          No existen datos para los filtros seleccionados. Ajuste el rango de fechas, edificio o sala para generar el reporte.
        </div>
      );
    }

    return (
      <div className="row g-3">
        {secciones.map((seccion) => (
          <div className={obtenerClaseSeccionReporte(seccion)} key={seccion.titulo}>
            {renderTabla(seccion.titulo, seccion.registros, seccion.descripcion)}
          </div>
        ))}
      </div>
    );
  }

  function escaparCsv(valor) {
    const texto = String(valor ?? '');
    return `"${texto.replaceAll('"', '""')}"`;
  }

  function escaparHtml(valor) {
    return String(valor ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function descargarExcel() {
    const secciones = obtenerSeccionesConDatosReporte();
    const lineas = [
      ['Reporte', obtenerTituloReporte()],
      ['Rol', rolUsuario || 'Sin rol'],
      ['Usuario', usuarioSesion?.nombre || 'Usuario'],
      ['Filtros', obtenerFiltrosAplicadosTexto()],
      []
    ];

    if (secciones.length === 0) {
      lineas.push(['Sin datos para los filtros seleccionados']);
      lineas.push([]);
    }

    secciones.forEach((seccion) => {
      const registros = seccion.registros || [];
      const columnas = obtenerColumnasReporte(seccion.titulo, registros);

      lineas.push([seccion.titulo]);
      if (seccion.descripcion) {
        lineas.push(['Alcance', seccion.descripcion]);
      }

      if (columnas.length === 0) {
        lineas.push(['Sin datos disponibles']);
        lineas.push([]);
        return;
      }

      lineas.push(columnas.map(formatearEtiqueta));

      registros.forEach((registro) => {
        lineas.push(columnas.map((columna) => registro[columna] ?? ''));
      });

      lineas.push([]);
    });

    const contenidoCsv = lineas
      .map((linea) => linea.map(escaparCsv).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${contenidoCsv}`], {
      type: 'text/csv;charset=utf-8;'
    });
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);

    enlace.href = url;
    enlace.download = `${obtenerTituloReporte()
      .toLowerCase()
      .replaceAll(' ', '_')}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  function generarTablaHtml(seccion) {
    const registros = seccion.registros || [];
    const columnas = obtenerColumnasReporte(seccion.titulo, registros);

    if (columnas.length === 0) {
      return `
        <h3>${escaparHtml(seccion.titulo)}</h3>
        ${seccion.descripcion ? `<p class="muted">${escaparHtml(seccion.descripcion)}</p>` : ''}
        <p class="muted">No existen datos disponibles para este reporte.</p>
      `;
    }

    return `
      <h3>${escaparHtml(seccion.titulo)}</h3>
      ${seccion.descripcion ? `<p class="muted">${escaparHtml(seccion.descripcion)}</p>` : ''}
      <table>
        <thead>
          <tr>
            ${columnas
              .map((columna) => `<th>${escaparHtml(formatearEtiqueta(columna))}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${registros
            .map(
              (registro) => `
                <tr>
                  ${columnas
                    .map((columna) => `<td>${escaparHtml(registro[columna] ?? 'Sin dato')}</td>`)
                    .join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  function descargarPdf() {
    const ventana = window.open('', '_blank');

    if (!ventana) {
      Swal.fire({
        icon: 'warning',
        title: 'No fue posible abrir el reporte',
        text: 'El navegador bloqueo la ventana de impresion. Revise la configuracion de ventanas emergentes.'
      });
      return;
    }

    const secciones = obtenerSeccionesConDatosReporte();

    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escaparHtml(obtenerTituloReporte())}</title>
          <style>
            body {
              color: #1f2937;
              font-family: Arial, sans-serif;
              margin: 28px;
            }
            h1 {
              color: #0d2b63;
              margin-bottom: 4px;
            }
            h3 {
              color: #0d2b63;
              margin: 24px 0 10px;
            }
            .muted {
              color: #6b7280;
            }
            .meta {
              border-bottom: 2px solid #0d2b63;
              margin-bottom: 18px;
              padding-bottom: 12px;
            }
            table {
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 14px;
              width: 100%;
            }
            th {
              background: #0d2b63;
              color: #ffffff;
              text-align: left;
            }
            th,
            td {
              border: 1px solid #d1d5db;
              padding: 7px;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
          </style>
        </head>
        <body>
          <div class="meta">
            <h1>${escaparHtml(obtenerTituloReporte())}</h1>
            <p>${escaparHtml(obtenerDescripcionReporte())}</p>
            <p><strong>Usuario:</strong> ${escaparHtml(usuarioSesion?.nombre || 'Usuario')}</p>
            <p><strong>Rol:</strong> ${escaparHtml(rolUsuario || 'Sin rol')}</p>
            <p><strong>Filtros:</strong> ${escaparHtml(obtenerFiltrosAplicadosTexto())}</p>
          </div>
          ${secciones.length > 0 ? secciones.map(generarTablaHtml).join('') : '<p class="muted">No existen datos para los filtros seleccionados.</p>'}
        </body>
      </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  if (cargando) {
    return (
      <MainLayout>
        <div className="alert alert-info">
          Cargando reportes del sistema...
        </div>
      </MainLayout>
    );
  }

  if (!tieneAccesoVistaActual()) {
    return (
      <MainLayout>
        <div className="mb-4">
          <h2 className="fw-bold mb-1">Reportes</h2>
          <p className="text-muted mb-0">
            El rol activo no tiene reportes habilitados para esta seccion.
          </p>
        </div>

        <div className="alert alert-warning">
          Para resguardar la informacion institucional, este reporte se muestra
          solo a perfiles autorizados.
        </div>
      </MainLayout>
    );
  }

  if (!kpi) {
    return (
      <MainLayout>
        <div className="alert alert-danger">
          No fue posible cargar la informacion de reportes.
        </div>
      </MainLayout>
    );
  }

  const resumen = kpi.resumen || {};
  const salasRevisionSemanal = kpi.salasRevisionSemanal || {};
  const equiposBaja = kpi.equiposBaja || {};
  const bajasEstado = kpi.bajasEstado || [];
  const bajasSolicitadas =
    bajasEstado.find((item) => item.estado_baja === 'SOLICITADA')
      ?.total_bajas || 0;

  return (
    <MainLayout>
      <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">{obtenerTituloReporte()}</h2>
          <p className="text-muted mb-0">{obtenerDescripcionReporte()}</p>
        </div>

        <div className="d-flex gap-2 align-items-start">
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={descargarExcel}
          >
            <i className="bi bi-file-earmark-spreadsheet me-2"></i>
            Excel
          </button>

          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={descargarPdf}
          >
            <i className="bi bi-file-earmark-pdf me-2"></i>
            PDF
          </button>
        </div>
      </div>

      <div className="mb-3">
        <h6 className="fw-bold mb-1">Indicadores generales del reporte</h6>
        <small className="text-muted">
          Estas tarjetas entregan contexto general del modulo. Las tablas y
          exportaciones aplican los filtros cuando el indicador tiene
          informacion historica asociada.
        </small>
      </div>

      <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-5 g-3 mb-4">
        {renderTarjeta(
          'Salas activas',
          resumen.total_salas_activas,
          'Espacios institucionales vigentes',
          'primary'
        )}

        {(vista !== 'auditoria') &&
          renderTarjeta(
            'Equipos activos',
            resumen.total_equipos_activos,
            'Inventario tecnologico vigente',
            'success'
          )}

        {renderTarjeta(
          'Incidencias abiertas',
          resumen.incidencias_abiertas,
          'Casos pendientes de atencion',
          'danger'
        )}

        {vista !== 'auditoria' &&
          renderTarjeta(
            'Salas al dia',
            salasRevisionSemanal.salas_al_dia,
            'Con revision semanal vigente',
            'success'
          )}

        {vista !== 'auditoria' &&
          renderTarjeta(
              'Salas pendientes',
              salasRevisionSemanal.salas_pendientes,
              'Sin revision semanal vigente',
              'warning'
            )}

        {vista === 'auditoria' &&
          renderTarjeta(
              'Equipos dados de baja',
              equiposBaja.total_equipos_baja,
              'Retirados del inventario activo',
              'secondary'
            )}

        {vista === 'auditoria' &&
          renderTarjeta(
            'Bajas solicitadas',
            bajasSolicitadas,
            'Pendientes de autorizacion',
            'warning'
          )}
      </div>

      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de reportes</strong>
            <small className="text-muted ms-2">
              Aplican a indicadores con informacion historica
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setFiltrosAbiertos((estadoActual) => !estadoActual)}
          >
            <i
              className={`bi ${
                filtrosAbiertos ? 'bi-chevron-up' : 'bi-chevron-down'
              } me-1`}
            ></i>
            {filtrosAbiertos ? 'Contraer' : 'Expandir'}
          </button>
        </div>

        {filtrosAbiertos && (
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label fw-semibold">Periodo</label>
                <select
                  className="form-select"
                  value={periodoRapido}
                  onChange={(e) => aplicarPeriodoRapido(e.target.value)}
                >
                  <option value="TODOS">Todos los registros</option>
                  <option value="HOY">Hoy</option>
                  <option value="ULTIMOS_7">Ultimos 7 dias</option>
                  <option value="MES_ACTUAL">Mes actual</option>
                  <option value="ANIO_ACTUAL">Anio actual</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesde}
                  onChange={(e) => {
                    setPeriodoRapido('PERSONALIZADO');
                    setFechaDesde(e.target.value);
                  }}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHasta}
                  onChange={(e) => {
                    setPeriodoRapido('PERSONALIZADO');
                    setFechaHasta(e.target.value);
                  }}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Edificio</label>
                <select
                  className="form-select"
                  value={filtroEdificio}
                  onChange={(e) => {
                    setFiltroEdificio(e.target.value);
                    setFiltroSala('TODOS');
                  }}
                >
                  <option value="TODOS">Todos</option>
                  {edificiosDisponibles.map((edificio) => (
                    <option key={edificio} value={edificio}>
                      {edificio}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Sala</label>
                <select
                  className="form-select"
                  value={filtroSala}
                  onChange={(e) => setFiltroSala(e.target.value)}
                >
                  <option value="TODOS">Todas</option>
                  {salasDisponibles.map((sala) => (
                    <option key={sala.id_sala} value={sala.codigo}>
                      {sala.codigo} - {sala.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary flex-fill"
                  onClick={aplicarFiltrosReportes}
                >
                  <i className="bi bi-funnel me-2"></i>
                  Aplicar
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  onClick={limpiarFiltrosReportes}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {vista === 'general' && (
        <div className="row row-cols-1 row-cols-lg-3 g-3">
          {puedeVerEjecutivo && (
            renderAccesoReporte(
              'Resumen ejecutivo',
              'Indicadores institucionales para revisar salas, incidencias, revisiones, inventario y bajas.',
              '/reportes/ejecutivo',
              'bi-clipboard-data',
              'primary'
            )
          )}

          {puedeVerTecnico && (
            renderAccesoReporte(
              'Operacion tecnica',
              'Priorizacion operativa de incidencias, salas y equipos para soporte o apoyo tecnico.',
              '/reportes/tecnico',
              'bi-tools',
              'success'
            )
          )}

          {puedeVerAuditoria && (
            renderAccesoReporte(
              'Auditoria',
              'Resumen de trazabilidad del sistema para control administrativo y revision interna.',
              '/reportes/auditoria',
              'bi-shield-check',
              'secondary'
            )
          )}
        </div>
      )}

      {vista !== 'general' && renderSeccionesReporte()}
    </MainLayout>
  );
}

export default ReportesPage;




