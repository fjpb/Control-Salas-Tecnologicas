// Dashboard principal SGTSL.
// Presenta indicadores ejecutivos y operativos usando datos reales de la API.

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Doughnut, Bar } from "react-chartjs-2";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

import MainLayout from "../../layouts/MainLayout";
import { obtenerKpiDashboard } from "../../services/dashboardService";
import { listarSalas } from "../../services/salasService";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

function formatearRangoSemana(registro) {
  if (!registro?.semana_desde || !registro?.semana_hasta) {
    return "Sin semana";
  }

  return registro.semana_desde + " al " + registro.semana_hasta;
}

function DashboardPage() {
  const [kpi, setKpi] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [periodoRapido, setPeriodoRapido] = useState("TODOS");
  const [salas, setSalas] = useState([]);
  const [filtroEdificio, setFiltroEdificio] = useState("TODOS");
  const [filtroSala, setFiltroSala] = useState("TODOS");
  const [vistaDashboard, setVistaDashboard] = useState("RESUMEN");

  const usuarioSesion = (() => {
    try {
      return JSON.parse(localStorage.getItem("sgtsl_usuario")) || {};
    } catch {
      return {};
    }
  })();

  const rolUsuario = usuarioSesion?.rol || "";
  const esAdministracion = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"].includes(
    rolUsuario,
  );
  const esTecnico = rolUsuario === "TECNICO_SOPORTE";
  const esAlumno = rolUsuario === "ALUMNO_PRACTICA";
  const esDocente = rolUsuario === "DOCENTE";
  const puedeVerInventario = !esDocente;
  const puedeVerBajas = esAdministracion;
  const puedeVerGestionTecnica = esAdministracion || esTecnico || esAlumno;

  const opcionesDashboard = useMemo(() => {
    const opciones = [
      { id: "RESUMEN", texto: "Resumen", icono: "bi-speedometer2" },
      { id: "INCIDENCIAS", texto: "Incidencias", icono: "bi-exclamation-triangle" },
    ];

    if (puedeVerGestionTecnica) {
      opciones.push({
        id: "REVISIONES",
        texto: "Revisiones",
        icono: "bi-clipboard-check",
      });
    }

    if (puedeVerInventario) {
      opciones.push({
        id: "INVENTARIO",
        texto: "Inventario",
        icono: "bi-pc-display",
      });
    }

    if (puedeVerBajas) {
      opciones.push({
        id: "BAJAS",
        texto: "Bajas",
        icono: "bi-archive",
      });
    }

    return opciones;
  }, [puedeVerBajas, puedeVerGestionTecnica, puedeVerInventario]);

  useEffect(() => {
    cargarKpi();
    cargarSalasDashboard();
  }, []);

  const edificiosDisponibles = useMemo(() => {
    return Array.from(
      new Set(salas.map((sala) => sala.edificio).filter(Boolean)),
    ).sort();
  }, [salas]);

  const salasDisponibles = useMemo(() => {
    return salas
      .filter(
        (sala) =>
          filtroEdificio === "TODOS" || sala.edificio === filtroEdificio,
      )
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [salas, filtroEdificio]);

  async function cargarKpi(filtros = {}) {
    try {
      setCargando(true);

      const respuesta = await obtenerKpiDashboard(filtros);

      if (!respuesta.ok) {
        throw new Error(respuesta.message);
      }

      setKpi(respuesta.data);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar dashboard",
        text:
          error.response?.data?.message ||
          "No fue posible obtener los indicadores KPI.",
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarSalasDashboard() {
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

    if (periodo === "TODOS") {
      setFechaDesde("");
      setFechaHasta("");
      return;
    }

    const hoy = obtenerFechaActual();
    setFechaHasta(hoy);

    if (periodo === "HOY") {
      setFechaDesde(hoy);
      return;
    }

    if (periodo === "ULTIMOS_7") {
      setFechaDesde(obtenerFechaDiasAtras(6));
      return;
    }

    if (periodo === "MES_ACTUAL") {
      setFechaDesde(obtenerInicioMesActual());
      return;
    }

    if (periodo === "ANIO_ACTUAL") {
      setFechaDesde(obtenerInicioAnioActual());
    }
  }

  function aplicarFiltrosDashboard() {
    cargarKpi({
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      edificio: filtroEdificio !== "TODOS" ? filtroEdificio : undefined,
      sala: filtroSala !== "TODOS" ? filtroSala : undefined,
    });
  }

  function limpiarFiltrosDashboard() {
    setPeriodoRapido("TODOS");
    setFechaDesde("");
    setFechaHasta("");
    setFiltroEdificio("TODOS");
    setFiltroSala("TODOS");
    cargarKpi();
  }

  function obtenerDescripcionDashboard() {
    if (esDocente) {
      return "Seguimiento de incidencias y comportamiento de salas reportadas.";
    }

    if (esAlumno) {
      return "Indicadores operativos para apoyo en revisiones, salas e inventario.";
    }

    if (esTecnico) {
      return "Panel tecnico para seguimiento de revisiones, incidencias y equipos.";
    }

    return "Indicadores ejecutivos de salas, equipos, revisiones e incidencias.";
  }

  if (cargando) {
    return (
      <MainLayout>
        <div className="alert alert-info">
          Cargando indicadores del sistema...
        </div>
      </MainLayout>
    );
  }

  if (!kpi) {
    return (
      <MainLayout>
        <div className="alert alert-danger">
          No fue posible cargar la informacion del dashboard.
        </div>
      </MainLayout>
    );
  }

  const resumen = kpi.resumen || {};
  const equiposAsignacion = kpi.equiposAsignacion || [];
  const equiposEstado = kpi.equiposEstado || [];
  const equiposTipo = kpi.equiposTipo || [];
  const incidenciasEstado = kpi.incidenciasEstado || [];
  const incidenciasSala = kpi.incidenciasSala || [];
  const revisionesMensuales = kpi.revisionesMensuales || [];
  const bajasEstado = kpi.bajasEstado || [];
  const salasRevisionSemanal = kpi.salasRevisionSemanal || {};
  const salasRevisadasSemana = kpi.salasRevisadasSemana || [];
  const salasPendientesRevision = kpi.salasPendientesRevision || [];
  const salasRevisadasMensuales = kpi.salasRevisadasMensuales || [];
  const revisionesDetalle = kpi.revisionesDetalle || [];

  const totalEquiposAsignados =
    equiposAsignacion.find((item) => item.estado_asignacion === "ASIGNADO")
      ?.total_equipos || 0;

  const totalEquiposNoAsignados =
    equiposAsignacion.find(
      (item) => item.estado_asignacion === "NO_ASIGNADO",
    )?.total_equipos || 0;

  const totalEquiposConFalla =
    equiposEstado.find((item) => item.estado_activo === "CON_FALLA")
      ?.total_equipos || 0;

  const totalEquiposBaja = kpi.equiposBaja?.total_equipos_baja || 0;

  const totalBajasSolicitadas =
    bajasEstado.find((item) => item.estado_baja === "SOLICITADA")
      ?.total_bajas || 0;

  const totalBajasAprobadas =
    bajasEstado.find((item) => item.estado_baja === "APROBADA")
      ?.total_bajas || 0;

  const totalBajasEjecutadas =
    bajasEstado.find((item) => item.estado_baja === "EJECUTADA")
      ?.total_bajas || 0;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  const horizontalBarOptions = {
    ...chartOptions,
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  const dataEquiposAsignacion = {
    labels: equiposAsignacion.map((item) =>
      item.estado_asignacion === "ASIGNADO" ? "Asignados" : "No asignados",
    ),
    datasets: [
      {
        label: "Equipos",
        data: equiposAsignacion.map((item) => item.total_equipos),
        backgroundColor: ["#198754", "#6C757D"],
        borderColor: "#FFFFFF",
        borderWidth: 2,
      },
    ],
  };

  const dataIncidenciasEstado = {
    labels: incidenciasEstado.map((item) => item.estado_incidencia),
    datasets: [
      {
        label: "Incidencias",
        data: incidenciasEstado.map((item) => item.total_incidencias),
        backgroundColor: ["#0D2B63", "#1D70B8", "#FFC000", "#198754", "#DC3545"],
        borderColor: "#FFFFFF",
        borderWidth: 2,
      },
    ],
  };

  const dataSalasRevisionSemanal = {
    labels: ["Al dia", "Pendientes"],
    datasets: [
      {
        label: "Salas",
        data: [
          salasRevisionSemanal.salas_al_dia || 0,
          salasRevisionSemanal.salas_pendientes || 0,
        ],
        backgroundColor: ["#198754", "#FFC000"],
        borderColor: "#FFFFFF",
        borderWidth: 2,
      },
    ],
  };

  const dataRevisionesMensuales = {
    labels: revisionesMensuales.map((item) => `${item.mes}/${item.anio}`),
    datasets: [
      {
        label: "Revisiones",
        data: revisionesMensuales.map((item) => item.total_revisiones),
        backgroundColor: "#1D70B8",
      },
    ],
  };

  const dataSalasRevisadasMensuales = {
    labels: salasRevisadasMensuales.map((item) => `${item.mes}/${item.anio}`),
    datasets: [
      {
        label: "Salas revisadas",
        data: salasRevisadasMensuales.map(
          (item) => item.total_salas_revisadas,
        ),
        backgroundColor: "#198754",
      },
    ],
  };

  const dataEquiposTipo = {
    labels: equiposTipo.map((item) => item.tipo_equipo),
    datasets: [
      {
        label: "Equipos",
        data: equiposTipo.map((item) => item.total_equipos),
        backgroundColor: "#0D2B63",
      },
    ],
  };

  const dataBajasEstado = {
    labels: bajasEstado.map((item) => item.estado_baja),
    datasets: [
      {
        label: "Bajas",
        data: bajasEstado.map((item) => item.total_bajas),
        backgroundColor: ["#FFC000", "#1D70B8", "#198754", "#DC3545", "#6C757D"],
        borderColor: "#FFFFFF",
        borderWidth: 2,
      },
    ],
  };

  function mostrarDetalleTarjeta(titulo, descripcion, registros, columnas) {
    const filas = registros || [];
    const contenido = filas.length
      ? `
        <div style="max-height:360px;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr>
                ${columnas
                  .map(
                    (columna) =>
                      `<th style="border-bottom:1px solid #dee2e6;padding:6px;text-align:left">${columna.titulo}</th>`,
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${filas
                .map(
                  (fila) => `
                    <tr>
                      ${columnas
                        .map(
                          (columna) =>
                            `<td style="border-bottom:1px solid #f1f3f5;padding:6px">${fila[columna.campo] ?? "Sin dato"}</td>`,
                        )
                        .join("")}
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : `<p class="text-muted mb-0">No existen datos disponibles para este detalle.</p>`;

    Swal.fire({
      title: titulo,
      width: 820,
      html: `
        <div style="text-align:left">
          <p style="color:#6c757d">${descripcion}</p>
          ${contenido}
        </div>
      `,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#0D2B63",
    });
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h2 className="fw-bold mb-1">Dashboard SGTSL</h2>
        <p className="text-muted mb-0">{obtenerDescripcionDashboard()}</p>
      </div>

      <div className="mb-3">
        <h6 className="fw-bold mb-1">Indicadores generales</h6>
        <small className="text-muted">
          Estos datos corresponden al estado global del sistema y no dependen
          de los filtros aplicados.
        </small>
      </div>

      <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-4">
        <div className="col">
          <div
            className="card sgtsl-card h-100 border-start border-5 border-primary"
            title={`${resumen.total_salas_activas || 0} salas activas: espacios institucionales vigentes y disponibles para gestion tecnologica, revisiones e incidencias.`}
            aria-label="Detalle de salas activas"
          >
            <div className="card-body">
              <h6 className="text-muted">Salas activas</h6>
              <h2 className="fw-bold">{resumen.total_salas_activas || 0}</h2>
              <small>Espacios vigentes para gestion tecnologica</small>
            </div>
          </div>
        </div>

        {puedeVerInventario && (
          <div className="col">
            <div
              className="card sgtsl-card h-100 border-start border-5 border-success"
              title={`${resumen.total_equipos_activos || 0} equipos activos: inventario tecnologico vigente, sin baja ejecutada y disponible para seguimiento del sistema.`}
              aria-label="Detalle de equipos activos"
            >
              <div className="card-body">
                <h6 className="text-muted">Equipos activos</h6>
                <h2 className="fw-bold">{resumen.total_equipos_activos || 0}</h2>
                <small>Inventario vigente en sistema</small>
              </div>
            </div>
          </div>
        )}

        {puedeVerInventario && (
          <div className="col">
            <div
              className="card sgtsl-card h-100 border-start border-5 border-info"
              title={`${totalEquiposAsignados} equipos asignados: dispositivos con una sala activa asociada para uso operativo o seguimiento tecnico.`}
              aria-label="Detalle de equipos asignados"
            >
              <div className="card-body">
                <h6 className="text-muted">Equipos asignados</h6>
                <h2 className="fw-bold">{totalEquiposAsignados}</h2>
                <small>Con sala activa asociada</small>
              </div>
            </div>
          </div>
        )}

        {puedeVerInventario && (
          <div className="col">
            <div
              className="card sgtsl-card h-100 border-start border-5 border-secondary"
              title={`${totalEquiposNoAsignados} equipos no asignados: dispositivos disponibles en bodega, recambio o pendientes de asignacion a sala.`}
              aria-label="Detalle de equipos no asignados"
            >
              <div className="card-body">
                <h6 className="text-muted">Equipos No Asignados</h6>
                <h2 className="fw-bold">{totalEquiposNoAsignados}</h2>
                <small>Disponibles, en bodega o recambio</small>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros del dashboard</strong>
            <small className="text-muted ms-2">
              Aplican a incidencias, revisiones y bajas
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setFiltrosAbiertos((estadoActual) => !estadoActual)}
          >
            <i
              className={`bi ${
                filtrosAbiertos ? "bi-chevron-up" : "bi-chevron-down"
              } me-1`}
            ></i>
            {filtrosAbiertos ? "Contraer" : "Expandir"}
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
                    setPeriodoRapido("PERSONALIZADO");
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
                    setPeriodoRapido("PERSONALIZADO");
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
                    setFiltroSala("TODOS");
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
                  onClick={aplicarFiltrosDashboard}
                >
                  <i className="bi bi-funnel me-2"></i>
                  Aplicar
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  onClick={limpiarFiltrosDashboard}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card sgtsl-card mb-4">
        <div className="card-body py-3">
          <div className="sgtsl-dashboard-tabs" role="tablist">
            {opcionesDashboard.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                className={`sgtsl-dashboard-tab ${
                  vistaDashboard === opcion.id ? "active" : ""
                }`}
                onClick={() => setVistaDashboard(opcion.id)}
              >
                <i className={`bi ${opcion.icono}`}></i>
                <span>{opcion.texto}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {vistaDashboard === "RESUMEN" && (
        <>
          <div className="mb-3">
            <h6 className="fw-bold mb-1">Indicadores segun filtros</h6>
            <small className="text-muted">
              Estos datos se actualizan segun periodo, edificio o sala
              seleccionada cuando el indicador tiene informacion historica.
            </small>
          </div>

          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3 mb-4">
            <div className="col">
              <div className="card sgtsl-card h-100 border-start border-5 border-danger">
                <div className="card-body">
                  <h6 className="text-muted">Incidencias abiertas</h6>
                  <h2 className="fw-bold">
                    {resumen.incidencias_abiertas || 0}
                  </h2>
                  <small>Casos pendientes de atencion</small>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger mt-3"
                    onClick={() =>
                      mostrarDetalleTarjeta(
                        "Salas con incidencias",
                        "Detalle de salas con incidencias registradas segun los filtros aplicados.",
                        incidenciasSala,
                        [
                          { titulo: "Codigo", campo: "codigo_sala" },
                          { titulo: "Sala", campo: "nombre_sala" },
                          { titulo: "Total", campo: "total_incidencias" },
                        ],
                      )
                    }
                  >
                    Ver salas
                  </button>
                </div>
              </div>
            </div>

            {puedeVerGestionTecnica && (
              <div className="col">
                <div className="card sgtsl-card h-100 border-start border-5 border-success">
                  <div className="card-body">
                    <h6 className="text-muted">Salas al dia</h6>
                    <h2 className="fw-bold">
                      {salasRevisionSemanal.salas_al_dia || 0}
                    </h2>
                    <small>Con revision registrada esta semana</small>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success mt-3"
                      onClick={() =>
                        mostrarDetalleTarjeta(
                          "Salas revisadas esta semana",
                          "Salas con revision vigente, fecha e identificacion del revisor.",
                          salasRevisadasSemana,
                          [
                            { titulo: "Codigo", campo: "codigo_sala" },
                            { titulo: "Sala", campo: "sala" },
                            { titulo: "Revisor", campo: "usuario_revisor" },
                            { titulo: "Iniciales", campo: "iniciales_revisor" },
                            { titulo: "Fecha", campo: "fecha_revision" },
                          ],
                        )
                      }
                    >
                      Ver detalle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {puedeVerGestionTecnica && (
              <div className="col">
                <div className="card sgtsl-card h-100 border-start border-5 border-warning">
                  <div className="card-body">
                    <h6 className="text-muted">Salas pendientes</h6>
                    <h2 className="fw-bold">
                      {salasRevisionSemanal.salas_pendientes || 0}
                    </h2>
                    <small>Sin revision semanal vigente</small>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning mt-3"
                      onClick={() =>
                        mostrarDetalleTarjeta(
                          "Salas pendientes de revision",
                          "Salas sin revision registrada durante la semana actual.",
                          salasPendientesRevision,
                          [
                            { titulo: "Edificio", campo: "edificio" },
                            { titulo: "Codigo", campo: "codigo_sala" },
                            { titulo: "Sala", campo: "sala" },
                          ],
                        )
                      }
                    >
                      Ver salas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Incidencias por estado
                </div>
                <div className="card-body" style={{ height: "300px" }}>
                  {incidenciasEstado.length > 0 ? (
                    <Doughnut
                      data={dataIncidenciasEstado}
                      options={chartOptions}
                    />
                  ) : (
                    <p className="text-muted">
                      No existen incidencias registradas.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {puedeVerGestionTecnica && (
              <div className="col-lg-6">
                <div className="card sgtsl-card h-100">
                  <div className="card-header bg-white fw-bold">
                    Salas revisadas por mes
                  </div>
                  <div className="card-body" style={{ height: "300px" }}>
                    {salasRevisadasMensuales.length > 0 ? (
                      <Bar
                        data={dataSalasRevisadasMensuales}
                        options={barOptions}
                      />
                    ) : (
                      <p className="text-muted">
                        No existen salas revisadas para los filtros
                        seleccionados.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {vistaDashboard === "INCIDENCIAS" && (
        <div className="row g-3">
          <div className="col-lg-5">
            <div className="card sgtsl-card h-100">
              <div className="card-header bg-white fw-bold">
                Incidencias por estado
              </div>
              <div className="card-body" style={{ height: "320px" }}>
                {incidenciasEstado.length > 0 ? (
                  <Doughnut
                    data={dataIncidenciasEstado}
                    options={chartOptions}
                  />
                ) : (
                  <p className="text-muted">
                    No existen incidencias registradas.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card sgtsl-card h-100">
              <div className="card-header bg-white fw-bold">
                Salas con mas incidencias
              </div>

              <div className="table-responsive">
                <table className="table table-hover table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Sala</th>
                      <th>Total incidencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidenciasSala.length > 0 ? (
                      incidenciasSala.map((item) => (
                        <tr key={item.codigo_sala}>
                          <td>{item.codigo_sala}</td>
                          <td>{item.nombre_sala}</td>
                          <td>
                            <span className="badge bg-danger">
                              {item.total_incidencias}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No existen datos disponibles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {vistaDashboard === "REVISIONES" && puedeVerGestionTecnica && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-lg-4">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Revision semanal de salas
                </div>
                <div className="card-body" style={{ height: "320px" }}>
                  <Doughnut
                    data={dataSalasRevisionSemanal}
                    options={chartOptions}
                  />
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Revisiones mensuales
                </div>
                <div className="card-body" style={{ height: "320px" }}>
                  {revisionesMensuales.length > 0 ? (
                    <Bar data={dataRevisionesMensuales} options={barOptions} />
                  ) : (
                    <p className="text-muted">
                      No existen revisiones registradas.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Salas revisadas por mes
                </div>
                <div className="card-body" style={{ height: "320px" }}>
                  {salasRevisadasMensuales.length > 0 ? (
                    <Bar
                      data={dataSalasRevisadasMensuales}
                      options={barOptions}
                    />
                  ) : (
                    <p className="text-muted">
                      No existen salas revisadas para los filtros seleccionados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card sgtsl-card">
            <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>Revisiones realizadas</strong>
                <small className="text-muted ms-2">
                  Fecha, semana, sala, revisor y avance de checklist
                </small>
              </div>
              <span className="badge bg-primary">
                {revisionesDetalle.length} registros
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-hover table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Revision</th>
                    <th>Fecha</th>
                    <th>Semana</th>
                    <th>Sala</th>
                    <th>Revisor</th>
                    <th>Estado</th>
                    <th>Checks</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionesDetalle.length > 0 ? (
                    revisionesDetalle.map((revision) => (
                      <tr key={revision.codigo_revision}>
                        <td className="fw-semibold">
                          {revision.codigo_revision}
                        </td>
                        <td>{revision.fecha_revision || "Sin fecha"}</td>
                        <td>{formatearRangoSemana(revision)}</td>
                        <td>
                          <strong>{revision.codigo_sala}</strong>
                          <br />
                          <small className="text-muted">{revision.sala}</small>
                        </td>
                        <td>
                          <span className="badge bg-secondary me-2">
                            {revision.iniciales_revisor || "--"}
                          </span>
                          {revision.usuario_revisor || "Sin revisor"}
                        </td>
                        <td>
                          <span className="badge bg-success">
                            {revision.estado_revision_general || "Sin estado"}
                          </span>
                        </td>
                        <td>
                          <strong>{revision.total_checks || 0}</strong>
                          <small className="text-muted d-block">
                            OK {revision.total_ok || 0} / Problema {revision.total_problema || 0} / N/A {revision.total_no_aplica || 0}
                          </small>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No existen revisiones para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {vistaDashboard === "INVENTARIO" && puedeVerInventario && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-info">
                <div className="card-body">
                  <h6 className="text-muted">Equipos asignados</h6>
                  <h2 className="fw-bold">{totalEquiposAsignados}</h2>
                  <small>Con sala activa asociada</small>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-secondary">
                <div className="card-body">
                  <h6 className="text-muted">Equipos No Asignados</h6>
                  <h2 className="fw-bold">{totalEquiposNoAsignados}</h2>
                  <small>Disponibles, en bodega o recambio</small>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-warning">
                <div className="card-body">
                  <h6 className="text-muted">Equipos con falla</h6>
                  <h2 className="fw-bold">{totalEquiposConFalla}</h2>
                  <small>Requieren seguimiento tecnico</small>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Equipos por asignacion
                </div>
                <div className="card-body" style={{ height: "320px" }}>
                  {equiposAsignacion.length > 0 ? (
                    <Doughnut
                      data={dataEquiposAsignacion}
                      options={chartOptions}
                    />
                  ) : (
                    <p className="text-muted">No existen equipos registrados.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card sgtsl-card h-100">
                <div className="card-header bg-white fw-bold">
                  Equipos por tipo
                </div>
                <div className="card-body" style={{ height: "320px" }}>
                  {equiposTipo.length > 0 ? (
                    <Bar
                      data={dataEquiposTipo}
                      options={horizontalBarOptions}
                    />
                  ) : (
                    <p className="text-muted">No existen equipos registrados.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {vistaDashboard === "BAJAS" && puedeVerBajas && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-secondary">
                <div className="card-body">
                  <h6 className="text-muted">Equipos dados de baja</h6>
                  <h2 className="fw-bold">{totalEquiposBaja}</h2>
                  <small>Retirados del inventario activo</small>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-warning">
                <div className="card-body">
                  <h6 className="text-muted">Bajas solicitadas</h6>
                  <h2 className="fw-bold">{totalBajasSolicitadas}</h2>
                  <small>Pendientes de autorizacion</small>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-info">
                <div className="card-body">
                  <h6 className="text-muted">Bajas aprobadas</h6>
                  <h2 className="fw-bold">{totalBajasAprobadas}</h2>
                  <small>Autorizadas para ejecucion</small>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card sgtsl-card h-100 border-start border-5 border-success">
                <div className="card-body">
                  <h6 className="text-muted">Bajas ejecutadas</h6>
                  <h2 className="fw-bold">{totalBajasEjecutadas}</h2>
                  <small>Procesos cerrados correctamente</small>
                </div>
              </div>
            </div>
          </div>

          <div className="card sgtsl-card">
            <div className="card-header bg-white fw-bold">Bajas por estado</div>
            <div className="card-body" style={{ height: "320px" }}>
              {bajasEstado.length > 0 ? (
                <Doughnut data={dataBajasEstado} options={chartOptions} />
              ) : (
                <p className="text-muted">No existen bajas registradas.</p>
              )}
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}

export default DashboardPage;
