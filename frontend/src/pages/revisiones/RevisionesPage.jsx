// Página de revisiones técnicas del SGTSL.
// Permite registrar revisiones con checklist dinámico y visualizar
// el historial de revisiones realizadas.

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import MainLayout from "../../layouts/MainLayout";
import { obtenerCatalogos } from "../../services/catalogosService";

import {
  obtenerEstadoSemanalSala,
  obtenerEquiposPorSala,
  obtenerChecklistPorEquipo,
  registrarRevision,
  listarRevisiones,
  obtenerDetalleRevision,
  obtenerHistorialRevision,
  editarRevision,
  anularRevision,
} from "../../services/revisionesService";

function RevisionesPage({ vista = "completa" }) {
  const [edificios, setEdificios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [revisiones, setRevisiones] = useState([]);

  const [idEdificio, setIdEdificio] = useState("");
  const [idSala, setIdSala] = useState("");
  const [idEquipo, setIdEquipo] = useState("");

  const [estadoSemanal, setEstadoSemanal] = useState(null);
  const [observacionGeneral, setObservacionGeneral] = useState("");
  const [checklistValores, setChecklistValores] = useState({});
  const [pasoRevision, setPasoRevision] = useState(1);

  const [cargando, setCargando] = useState(false);
  const [cargandoChecklist, setCargandoChecklist] = useState(false);
  const [busquedaRevision, setBusquedaRevision] = useState("");
  const [filtroFechaRevisionDesde, setFiltroFechaRevisionDesde] = useState("");
  const [filtroFechaRevisionHasta, setFiltroFechaRevisionHasta] = useState("");
  const [filtroEstadoRevision, setFiltroEstadoRevision] = useState("TODOS");
  const [filtroSalaRevision, setFiltroSalaRevision] = useState("TODOS");
  const [filtroRevisorRevision, setFiltroRevisorRevision] = useState("TODOS");
  const [filtroProblemasRevision, setFiltroProblemasRevision] =
    useState("TODOS");
  const [filtrosRevisionesAbiertos, setFiltrosRevisionesAbiertos] =
    useState(true);
  const [listaRevisionesExpandida, setListaRevisionesExpandida] =
    useState(false);
  const pasosRevision = [
    { numero: 1, titulo: "Ubicacion y equipo" },
    { numero: 2, titulo: "Checklist tecnico" },
    { numero: 3, titulo: "Resumen y registro" },
  ];

  const limiteRevisionesContraidas = 8;

  const usuarioSesion = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sgtsl_usuario")) || {};
    } catch {
      return {};
    }
  }, []);

  const rolUsuario = usuarioSesion?.rol || "";
  const mostrarRegistro = vista !== "listado";
  const mostrarListado = vista !== "registro";

  /*
  ============================================================================
  CARGA INICIAL
  ============================================================================
  */
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    setListaRevisionesExpandida(false);
  }, [
    busquedaRevision,
    filtroFechaRevisionDesde,
    filtroFechaRevisionHasta,
    filtroEstadoRevision,
    filtroSalaRevision,
    filtroRevisorRevision,
    filtroProblemasRevision,
  ]);

  async function cargarDatosIniciales() {
    try {
      const respuestaCatalogos = await obtenerCatalogos();
      const respuestaRevisiones = await listarRevisiones();

      setEdificios(respuestaCatalogos.data.edificios || []);
      setSalas(respuestaCatalogos.data.salas || []);
      setRevisiones(respuestaRevisiones.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar datos",
        text:
          error.response?.data?.message ||
          "No fue posible cargar la información inicial.",
      });
    }
  }

  /*
  ============================================================================
  FILTRO DE SALAS POR EDIFICIO
  ============================================================================
  */
  const salasFiltradas = useMemo(() => {
    if (!idEdificio) return [];
    return salas.filter(
      (sala) => Number(sala.id_edificio) === Number(idEdificio),
    );
  }, [salas, idEdificio]);

  /*
  ============================================================================
  EQUIPO SELECCIONADO
  ============================================================================
  */
  const equipoSeleccionado = useMemo(() => {
    if (!idEquipo) return null;
    return equipos.find(
      (equipo) => Number(equipo.id_equipo) === Number(idEquipo),
    );
  }, [equipos, idEquipo]);

  const salasRevisionDisponibles = useMemo(() => {
    const mapa = new Map();

    revisiones.forEach((revision) => {
      if (revision.codigo_sala) {
        mapa.set(revision.codigo_sala, `${revision.codigo_sala} - ${revision.sala}`);
      }
    });

    return Array.from(mapa.entries()).map(([codigo, nombre]) => ({
      codigo,
      nombre,
    }));
  }, [revisiones]);

  const revisoresDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        revisiones
          .map((revision) => revision.usuario_revisor)
          .filter(Boolean),
      ),
    ).sort();
  }, [revisiones]);

  const revisionesFiltradas = useMemo(() => {
    const texto = busquedaRevision.trim().toLowerCase();

    return revisiones.filter((revision) => {
      const cumpleBusqueda =
        !texto ||
        [
          `REV-${String(revision.id_revision).padStart(6, "0")}`,
          revision.codigo_sala,
          revision.sala,
          revision.edificio,
          revision.usuario_revisor,
          revision.estado_revision_general,
          revision.origen_revision,
          revision.observacion_general,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(texto));

      const fechaRevision = revision.fecha_revision
        ? String(revision.fecha_revision).slice(0, 10)
        : "";

      const cumpleFechaDesde =
        !filtroFechaRevisionDesde ||
        (fechaRevision && fechaRevision >= filtroFechaRevisionDesde);

      const cumpleFechaHasta =
        !filtroFechaRevisionHasta ||
        (fechaRevision && fechaRevision <= filtroFechaRevisionHasta);

      const cumpleEstado =
        filtroEstadoRevision === "TODOS" ||
        revision.estado_revision_general === filtroEstadoRevision;

      const cumpleSala =
        filtroSalaRevision === "TODOS" ||
        revision.codigo_sala === filtroSalaRevision;

      const cumpleRevisor =
        filtroRevisorRevision === "TODOS" ||
        revision.usuario_revisor === filtroRevisorRevision;

      const tieneProblemas = Number(revision.total_problema || 0) > 0;
      const cumpleProblemas =
        filtroProblemasRevision === "TODOS" ||
        (filtroProblemasRevision === "CON_PROBLEMAS" && tieneProblemas) ||
        (filtroProblemasRevision === "SIN_PROBLEMAS" && !tieneProblemas);

      return (
        cumpleBusqueda &&
        cumpleFechaDesde &&
        cumpleFechaHasta &&
        cumpleEstado &&
        cumpleSala &&
        cumpleRevisor &&
        cumpleProblemas
      );
    });
  }, [
    revisiones,
    busquedaRevision,
    filtroFechaRevisionDesde,
    filtroFechaRevisionHasta,
    filtroEstadoRevision,
    filtroSalaRevision,
    filtroRevisorRevision,
    filtroProblemasRevision,
  ]);

  const revisionesVisibles = useMemo(() => {
    if (listaRevisionesExpandida) {
      return revisionesFiltradas;
    }

    return revisionesFiltradas.slice(0, limiteRevisionesContraidas);
  }, [revisionesFiltradas, listaRevisionesExpandida]);

  function limpiarFiltrosRevisiones() {
    setBusquedaRevision("");
    setFiltroFechaRevisionDesde("");
    setFiltroFechaRevisionHasta("");
    setFiltroEstadoRevision("TODOS");
    setFiltroSalaRevision("TODOS");
    setFiltroRevisorRevision("TODOS");
    setFiltroProblemasRevision("TODOS");
    setListaRevisionesExpandida(false);
  }

  function puedeEditarRevision(revision) {
    if (revision.estado_revision_general === "ANULADA") {
      return false;
    }

    if (["SUPER_ADMINISTRADOR", "ADMINISTRADOR"].includes(rolUsuario)) {
      return true;
    }

    return Number(revision.id_usuario_revisor) === Number(usuarioSesion.id_usuario);
  }

  function puedeAnularRevision(revision) {
    return (
      revision.estado_revision_general !== "ANULADA" &&
      rolUsuario === "SUPER_ADMINISTRADOR"
    );
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function contarChecklist(detalle = []) {
    return detalle.reduce(
      (totales, item) => {
        if (item.estado_item === "OK") {
          totales.ok += 1;
        } else if (item.estado_item === "CON_PROBLEMA") {
          totales.problema += 1;
        } else if (item.estado_item === "NO_APLICA") {
          totales.noAplica += 1;
        }

        totales.total += 1;
        return totales;
      },
      { total: 0, ok: 0, problema: 0, noAplica: 0 },
    );
  }

  function obtenerTotalChecklistRevision(revision) {
    return (
      Number(revision.total_ok || 0) +
      Number(revision.total_problema || 0) +
      Number(revision.total_no_aplica || 0)
    );
  }

  function manejarCambioEdificio(event) {
    setIdEdificio(event.target.value);
    setIdSala("");
    setIdEquipo("");
    setEquipos([]);
    setChecklist([]);
    setChecklistValores({});
    setEstadoSemanal(null);
    setPasoRevision(1);
  }

  async function manejarCambioSala(event) {
    const salaSeleccionada = event.target.value;

    setIdSala(salaSeleccionada);
    setIdEquipo("");
    setEquipos([]);
    setChecklist([]);
    setChecklistValores({});
    setEstadoSemanal(null);
    setPasoRevision(1);

    if (!salaSeleccionada) return;

    try {
      const estado = await obtenerEstadoSemanalSala(salaSeleccionada);
      const respuestaEquipos = await obtenerEquiposPorSala(salaSeleccionada);

      setEstadoSemanal(estado);
      setEquipos(respuestaEquipos.data || []);

      Swal.fire({
        icon: estado.estado === "AL_DIA" ? "success" : "warning",
        title:
          estado.estado === "AL_DIA" ? "Sala al día" : "Revisión pendiente",
        text: estado.message,
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al consultar sala",
        text:
          error.response?.data?.message ||
          "No fue posible consultar la sala seleccionada.",
      });
    }
  }

  async function manejarCambioEquipo(event) {
    const equipoSeleccionadoId = event.target.value;

    setIdEquipo(equipoSeleccionadoId);
    setChecklist([]);
    setChecklistValores({});
    setPasoRevision(1);

    if (!equipoSeleccionadoId) return;

    try {
      setCargandoChecklist(true);

      const respuesta = await obtenerChecklistPorEquipo(equipoSeleccionadoId);
      const items = respuesta.data || [];

      setChecklist(items);

      const valoresIniciales = {};

      items.forEach((item) => {
        valoresIniciales[item.id_checklist_item] = {
          estado_item: "OK",
          observacion: "",
        };
      });

      setChecklistValores(valoresIniciales);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar checklist",
        text:
          error.response?.data?.message ||
          "No fue posible cargar el checklist del equipo.",
      });
    } finally {
      setCargandoChecklist(false);
    }
  }

  function actualizarEstadoItem(idItem, estado) {
    setChecklistValores((prev) => ({
      ...prev,
      [idItem]: {
        ...prev[idItem],
        estado_item: estado,
      },
    }));
  }

  function actualizarObservacionItem(idItem, observacion) {
    if (observacion.length > 1000) return;

    setChecklistValores((prev) => ({
      ...prev,
      [idItem]: {
        ...prev[idItem],
        observacion,
      },
    }));
  }

  /*
  ============================================================================
  VALIDACIÓN DEL FORMULARIO
  ============================================================================
  */
  function validarFormulario() {
    if (!idEdificio) return "Debe seleccionar un edificio.";
    if (!idSala) return "Debe seleccionar una sala.";
    if (!idEquipo) return "Debe seleccionar un equipo.";
    if (checklist.length === 0)
      return "El equipo seleccionado no tiene checklist configurado.";

    if (observacionGeneral.length > 1000) {
      return "La observación general no puede superar los 1000 caracteres.";
    }

    for (const item of checklist) {
      const valor = checklistValores[item.id_checklist_item];

      if (
        valor?.estado_item === "CON_PROBLEMA" &&
        (!valor.observacion || valor.observacion.trim().length < 5)
      ) {
        return `Debe ingresar una observación para el ítem con problema: ${item.nombre}.`;
      }
    }

    return null;
  }

  function validarPasoRevision(paso) {
    if (paso === 1) {
      if (!idEdificio) return "Debe seleccionar un edificio.";
      if (!idSala) return "Debe seleccionar una sala.";
      if (!idEquipo) return "Debe seleccionar un equipo.";
      if (cargandoChecklist) return "Espere la carga del checklist del equipo.";
      if (checklist.length === 0)
        return "El equipo seleccionado no tiene checklist configurado.";
    }

    if (paso === 2) {
      for (const item of checklist) {
        const valor = checklistValores[item.id_checklist_item];

        if (
          valor?.estado_item === "CON_PROBLEMA" &&
          (!valor.observacion || valor.observacion.trim().length < 5)
        ) {
          return `Debe ingresar una observacion de al menos 5 caracteres para: ${item.nombre}.`;
        }
      }
    }

    if (paso === 3 && observacionGeneral.length > 1000) {
      return "La observacion general no puede superar los 1000 caracteres.";
    }

    return null;
  }

  function avanzarPasoRevision() {
    const errorValidacion = validarPasoRevision(pasoRevision);

    if (errorValidacion) {
      Swal.fire({
        icon: "warning",
        title: "Revise la etapa actual",
        text: errorValidacion,
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    setPasoRevision((pasoActual) => Math.min(pasoActual + 1, 3));
  }

  function retrocederPasoRevision() {
    setPasoRevision((pasoActual) => Math.max(pasoActual - 1, 1));
  }

  /*
  ============================================================================
  REGISTRO DE REVISIÓN
  ============================================================================
  */
  async function manejarRegistroRevision(event) {
    event.preventDefault();

    const errorValidacion = validarFormulario();

    if (errorValidacion) {
      Swal.fire({
        icon: "warning",
        title: "Validación requerida",
        text: errorValidacion,
      });
      return;
    }

    const confirmacion = await Swal.fire({
      title: "¿Registrar revisión?",
      text: "Se guardará la revisión técnica y el checklist del equipo seleccionado.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, registrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setCargando(true);

      const checklistDetalle = checklist.map((item) => {
        const valor = checklistValores[item.id_checklist_item];

        return {
          id_checklist_item: item.id_checklist_item,
          estado_item: valor.estado_item,
          observacion: valor.observacion,
        };
      });

      await registrarRevision({
        id_sala: Number(idSala),
        id_equipo: Number(idEquipo),
        observacion_general: observacionGeneral,
        estado_revision_general: "FINALIZADA",
        origen_revision: "MANUAL",
        checklist_detalle: checklistDetalle,
      });

      Swal.fire({
        icon: "success",
        title: "Revisión registrada",
        text: "La revisión técnica fue registrada correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      setObservacionGeneral("");
      setChecklistValores((prev) => {
        const limpio = {};

        Object.keys(prev).forEach((idItem) => {
          limpio[idItem] = {
            estado_item: "OK",
            observacion: "",
          };
        });

        return limpio;
      });
      setPasoRevision(1);

      const nuevoEstado = await obtenerEstadoSemanalSala(idSala);
      const respuestaRevisiones = await listarRevisiones();

      setEstadoSemanal(nuevoEstado);
      setRevisiones(respuestaRevisiones.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al registrar revisión",
        text:
          error.response?.data?.message ||
          "No fue posible registrar la revisión.",
      });
    } finally {
      setCargando(false);
    }
  }

  /*
==============================================================================
FUNCIÓN: verHistorialRevision
------------------------------------------------------------------------------
Muestra la trazabilidad funcional de una revisión técnica.
==============================================================================
*/
  function obtenerPresentacionHistorialRevision(accion) {
    const presentaciones = {
      REGISTRO: {
        etiqueta: "Registro inicial",
        color: "#0D2B63",
        icono: "bi-clipboard-check",
      },
      EDICION: {
        etiqueta: "Edicion tecnica",
        color: "#ffc107",
        icono: "bi-pencil-square",
      },
      ANULACION: {
        etiqueta: "Revision anulada",
        color: "#dc3545",
        icono: "bi-x-circle",
      },
      UPDATE: {
        etiqueta: "Actualizacion registrada",
        color: "#198754",
        icono: "bi-arrow-repeat",
      },
    };

    return (
      presentaciones[accion] || {
        etiqueta: accion || "Movimiento registrado",
        color: "#6c757d",
        icono: "bi-clock-history",
      }
    );
  }

  async function verHistorialRevision(revision) {
    try {
      const respuesta = await obtenerHistorialRevision(revision.id_revision);
      const historial = respuesta.data || [];

      const contenidoHistorial =
        historial.length > 0
          ? historial
              .map((item) => {
                const presentacion = obtenerPresentacionHistorialRevision(
                  item.accion,
                );

                return `
                <div style="
                  border-left:4px solid ${presentacion.color};
                  padding:12px 14px;
                  margin-bottom:12px;
                  background:#f8f9fa;
                  border-radius:8px;
                ">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
                    <span style="
                      background:${presentacion.color};
                      color:#fff;
                      border-radius:6px;
                      padding:4px 8px;
                      font-size:12px;
                      font-weight:700;
                    ">
                      <i class="bi ${presentacion.icono}" style="margin-right:4px"></i>
                      ${presentacion.etiqueta}
                    </span>
                    <small style="color:#6c757d">
                      ${new Date(item.fecha_registro).toLocaleString("es-CL")}
                    </small>
                  </div>

                  <p style="margin:6px 0;color:#343a40">
                    ${item.descripcion || "Movimiento registrado en la revision."}
                  </p>

                  <small style="color:#6c757d">
                    Responsable: ${item.usuario || "No registrado"}
                  </small>
                </div>
              `;
              })
              .join("")
          : `
          <p style="color:#6c757d">
            Esta revision no tiene historial registrado.
          </p>
        `;

      Swal.fire({
        title: `Historial REV-${String(revision.id_revision).padStart(6, "0")}`,
        width: 850,
        html: `
        <div style="text-align:left">
          <p style="color:#6c757d;margin-bottom:14px">
            Trazabilidad de acciones registradas sobre la revision tecnica.
          </p>
          ${contenidoHistorial}
        </div>
      `,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al consultar historial",
        text:
          error.response?.data?.message ||
          "No fue posible cargar el historial de la revision.",
      });
    }
  }

  async function verDetalleRevision(idRevision) {
    try {
      const respuesta = await obtenerDetalleRevision(idRevision);
      const revision = respuesta.revision;
      const detalle = respuesta.checklist || [];

      const filasChecklist = detalle.length
        ? detalle
            .map(
              (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.nombre_equipo}</td>
                <td>${item.item}</td>
                <td>
                  <span style="
                    padding:4px 8px;
                    border-radius:6px;
                    background:${
                      item.estado_item === "OK"
                        ? "#d1e7dd"
                        : item.estado_item === "CON_PROBLEMA"
                          ? "#f8d7da"
                          : "#e2e3e5"
                    };
                  ">
                    ${item.estado_item}
                  </span>
                </td>
                <td>${item.observacion || "Sin observación"}</td>
              </tr>
            `,
            )
            .join("")
        : `
          <tr>
            <td colspan="5" style="text-align:center;color:#6c757d">
              Esta revisión no tiene checklist asociado.
            </td>
          </tr>
        `;
      const totalesChecklist = contarChecklist(detalle);

      Swal.fire({
        title: `Revisión Nro. ${revision.id_revision}`,
        width: 950,
        confirmButtonColor: "#0D2B63",
        html: `
          <div style="text-align:left">
            <p><strong>Edificio:</strong> ${revision.edificio}</p>
            <p><strong>Sala:</strong> ${revision.codigo_sala} - ${revision.sala}</p>
            <p><strong>Revisor:</strong> ${revision.usuario_revisor}</p>
            <p><strong>Fecha:</strong> ${new Date(revision.fecha_revision).toLocaleString("es-CL")}</p>
            <p><strong>Estado:</strong> ${revision.estado_revision_general}</p>
            <p><strong>Origen:</strong> ${revision.origen_revision}</p>
            <p>
              <strong>Observación general:</strong><br/>
              ${revision.observacion_general || "Sin observación general"}
            </p>

            <hr/>

            <h6><strong>Checklist técnico</strong></h6>

            <p style="margin-bottom:10px;color:#495057">
              <strong>Total:</strong> ${totalesChecklist.total} |
              <strong> OK:</strong> ${totalesChecklist.ok} |
              <strong> Problema:</strong> ${totalesChecklist.problema} |
              <strong> N/A:</strong> ${totalesChecklist.noAplica}
            </p>

            <div style="max-height:350px;overflow:auto">
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                  <tr>
                    <th style="border-bottom:1px solid #dee2e6;padding:6px">N°</th>
                    <th style="border-bottom:1px solid #dee2e6;padding:6px">Equipo</th>
                    <th style="border-bottom:1px solid #dee2e6;padding:6px">Ítem</th>
                    <th style="border-bottom:1px solid #dee2e6;padding:6px">Estado</th>
                    <th style="border-bottom:1px solid #dee2e6;padding:6px">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasChecklist}
                </tbody>
              </table>
            </div>
          </div>
        `,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al obtener detalle",
        text:
          error.response?.data?.message ||
          "No fue posible cargar el detalle de la revisión.",
      });
    }
  }

  async function manejarEdicionRevision(revisionListado) {
    if (!puedeEditarRevision(revisionListado)) {
      Swal.fire({
        icon: "info",
        title: "Edicion no disponible",
        text:
          "Solo el revisor responsable o un administrador puede editar una revision vigente.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    try {
      const respuesta = await obtenerDetalleRevision(revisionListado.id_revision);
      const revision = respuesta.revision;
      const detalle = respuesta.checklist || [];

      const filasChecklist = detalle.length
        ? detalle
            .map(
              (item, index) => `
                <div class="border rounded p-3 mb-3">
                  <div class="row g-3 align-items-start">
                    <div class="col-md-4">
                      <small class="text-muted d-block">Equipo</small>
                      <strong>${escaparHtml(item.nombre_equipo)}</strong>
                      <br/>
                      <small>${index + 1}. ${escaparHtml(item.item)}</small>
                      <input
                        type="hidden"
                        id="editarRevisionDetalleId_${index}"
                        value="${item.id_revision_checklist_detalle}"
                      />
                    </div>

                    <div class="col-md-3">
                      <label class="form-label fw-semibold">Estado</label>
                      <select
                        id="editarRevisionEstado_${index}"
                        class="form-select"
                      >
                        <option value="OK" ${item.estado_item === "OK" ? "selected" : ""}>OK</option>
                        <option value="CON_PROBLEMA" ${item.estado_item === "CON_PROBLEMA" ? "selected" : ""}>CON PROBLEMA</option>
                        <option value="NO_APLICA" ${item.estado_item === "NO_APLICA" ? "selected" : ""}>NO APLICA</option>
                      </select>
                    </div>

                    <div class="col-md-5">
                      <label class="form-label fw-semibold">Observacion</label>
                      <textarea
                        id="editarRevisionObservacion_${index}"
                        class="form-control"
                        rows="2"
                        maxlength="1000"
                        placeholder="Ingrese observacion tecnica si corresponde."
                      >${escaparHtml(item.observacion)}</textarea>
                      <small class="text-muted d-block mt-1">
                        Obligatoria si el estado queda con problema. Maximo 1000.
                      </small>
                    </div>
                  </div>
                </div>
              `,
            )
            .join("")
        : `
          <div class="alert alert-info mb-0">
            Esta revision no tiene checklist asociado. Solo se editara la observacion general.
          </div>
        `;

      const resultado = await Swal.fire({
        title: `Editar REV-${String(revision.id_revision).padStart(6, "0")}`,
        width: 980,
        html: `
          <div style="text-align:left">
            <p style="margin-bottom:16px">
              Actualice solo antecedentes tecnicos necesarios. El cambio quedara
              registrado en historial y auditoria.
            </p>

            <div class="mb-3">
              <label class="form-label fw-semibold">Observacion general</label>
              <textarea
                id="editarRevisionObservacionGeneral"
                class="form-control"
                rows="3"
                maxlength="1000"
                placeholder="Ingrese observacion general de la revision."
              >${escaparHtml(revision.observacion_general)}</textarea>
              <small class="text-muted d-block mt-1">
                Campo opcional. Maximo 1000 caracteres.
              </small>
            </div>

            <div style="max-height:430px;overflow:auto">
              ${filasChecklist}
            </div>

            <div
              id="editarRevisionError"
              class="alert alert-warning py-2 px-3 mt-3 mb-0 d-none"
              style="font-size:14px"
            ></div>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Guardar cambios",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#0D2B63",
        cancelButtonColor: "#6C757D",
        preConfirm: () => {
          const error = document.getElementById("editarRevisionError");
          const observacionGeneral = document
            .getElementById("editarRevisionObservacionGeneral")
            .value.trim();

          error.classList.add("d-none");
          error.textContent = "";

          if (observacionGeneral.length > 1000) {
            error.textContent =
              "La observacion general no puede superar los 1000 caracteres.";
            error.classList.remove("d-none");
            return false;
          }

          const checklistEditado = detalle.map((item, index) => {
            const estadoItem = document.getElementById(
              `editarRevisionEstado_${index}`,
            ).value;
            const observacionItem = document
              .getElementById(`editarRevisionObservacion_${index}`)
              .value.trim();

            if (
              estadoItem === "CON_PROBLEMA" &&
              observacionItem.length < 5
            ) {
              error.textContent =
                "Todo item con problema debe incluir una observacion de al menos 5 caracteres.";
              error.classList.remove("d-none");
              return null;
            }

            if (observacionItem.length > 1000) {
              error.textContent =
                "Una observacion del checklist supera los 1000 caracteres.";
              error.classList.remove("d-none");
              return null;
            }

            return {
              id_revision_checklist_detalle:
                item.id_revision_checklist_detalle,
              estado_item: estadoItem,
              observacion: observacionItem || null,
            };
          });

          if (checklistEditado.some((item) => item === null)) {
            return false;
          }

          return {
            observacion_general: observacionGeneral || null,
            checklist_detalle: checklistEditado,
          };
        },
      });

      if (!resultado.isConfirmed) return;

      await editarRevision(revision.id_revision, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Revision actualizada",
        text: "Los datos tecnicos de la revision fueron actualizados correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaRevisiones = await listarRevisiones();
      setRevisiones(respuestaRevisiones.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al editar revision",
        text:
          error.response?.data?.message ||
          "No fue posible editar la revision.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  /*
==============================================================================
FUNCION: manejarAnulacionRevision
------------------------------------------------------------------------------
Solicita un motivo obligatorio y anula la revision manteniendo trazabilidad.
==============================================================================
*/
  async function manejarAnulacionRevision(revision) {
    if (revision.estado_revision_general === "ANULADA") {
      Swal.fire({
        icon: "info",
        title: "Revision anulada",
        text: "Esta revision ya se encuentra anulada.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const resultado = await Swal.fire({
      title: `Anular REV-${String(revision.id_revision).padStart(6, "0")}`,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            Use esta opcion solo cuando la revision fue registrada por error,
            duplicada o contiene informacion no valida para el control tecnico.
            La anulacion quedara respaldada en historial y auditoria.
          </p>
          <div class="alert alert-info py-2 px-3" style="font-size:14px">
            Si la revision solo requiere completar antecedentes, priorice la
            edicion antes de anular el registro.
          </div>

          <label style="font-weight:bold">Motivo de anulacion</label>
          <textarea
            id="motivoAnulacion"
            class="form-control"
            maxlength="500"
            placeholder="Ingrese el motivo de anulacion"
            rows="4"
            style="margin-top:8px; resize:vertical"
          ></textarea>

          <div
            id="motivoAnulacionError"
            class="alert alert-warning py-2 px-3 mt-2 mb-2 d-none"
            style="font-size:14px"
          ></div>

          <small class="text-muted d-block mt-2">
            Debe ingresar al menos 5 caracteres. Maximo 500.
          </small>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#DC3545",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const motivo = document.getElementById("motivoAnulacion").value.trim();
        const mensajeError = document.getElementById("motivoAnulacionError");

        mensajeError.classList.add("d-none");
        mensajeError.textContent = "";

        if (motivo.length < 5) {
          mensajeError.textContent =
            "Debe ingresar un motivo de anulacion de al menos 5 caracteres.";
          mensajeError.classList.remove("d-none");
          return false;
        }

        if (motivo.length > 500) {
          mensajeError.textContent =
            "El motivo de anulacion no puede superar los 500 caracteres.";
          mensajeError.classList.remove("d-none");
          return false;
        }

        return motivo;
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await anularRevision(revision.id_revision, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Revision anulada",
        text: "La revision fue anulada correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaRevisiones = await listarRevisiones();
      setRevisiones(respuestaRevisiones.data || []);

      if (idSala) {
        const nuevoEstado = await obtenerEstadoSemanalSala(idSala);
        setEstadoSemanal(nuevoEstado);
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al anular revision",
        text:
          error.response?.data?.message ||
          "No fue posible anular la revision.",
      });
    }
  }

  function obtenerClaseEstadoRevision(estado) {
    if (estado === "FINALIZADA") return "bg-success";
    if (estado === "BORRADOR") return "bg-warning text-dark";
    if (estado === "ANULADA") return "bg-secondary";
    return "bg-primary";
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h2 className="fw-bold mb-1">Revisiones técnicas</h2>
        <p className="text-muted mb-0">
          Registro y consulta de revisiones mediante edificio, sala, equipo y
          checklist técnico.
        </p>
      </div>

      {mostrarRegistro && (
      <form id="registro" onSubmit={manejarRegistroRevision}>
        <div className="card sgtsl-card mb-4">
          <div className="card-body">
            <div className="sgtsl-stepper">
              {pasosRevision.map((paso) => (
                <div
                  key={paso.numero}
                  className={`sgtsl-stepper-item ${
                    pasoRevision === paso.numero ? "active" : ""
                  } ${pasoRevision > paso.numero ? "completed" : ""}`}
                >
                  <span>{paso.numero}</span>
                  <strong>{paso.titulo}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`card sgtsl-card mb-4 ${
            pasoRevision === 1 ? "" : "d-none"
          }`}
        >
          <div className="card-header bg-white fw-bold">
            Selección de ubicación y equipo
          </div>

          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Edificio <span className="sgtsl-required">*</span>
                </label>

                <select
                  className="form-select"
                  value={idEdificio}
                  onChange={manejarCambioEdificio}
                >
                  <option value="">Seleccione edificio</option>
                  {edificios.map((edificio) => (
                    <option
                      key={edificio.id_edificio}
                      value={edificio.id_edificio}
                    >
                      {edificio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Sala <span className="sgtsl-required">*</span>
                </label>

                <select
                  className="form-select"
                  value={idSala}
                  onChange={manejarCambioSala}
                  disabled={!idEdificio}
                >
                  <option value="">Seleccione sala</option>
                  {salasFiltradas.map((sala) => (
                    <option key={sala.id_sala} value={sala.id_sala}>
                      {sala.codigo} - {sala.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">
                  Equipo <span className="sgtsl-required">*</span>
                </label>

                <select
                  className="form-select"
                  value={idEquipo}
                  onChange={manejarCambioEquipo}
                  disabled={!idSala}
                >
                  <option value="">Seleccione equipo</option>
                  {equipos.map((equipo) => (
                    <option key={equipo.id_equipo} value={equipo.id_equipo}>
                      {equipo.nombre_equipo} / {equipo.tipo_equipo}
                      {equipo.ubicacion_en_sala
                        ? ` - ${equipo.ubicacion_en_sala}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {estadoSemanal && (
                <div className="col-12">
                  <div
                    className={`alert ${
                      estadoSemanal.estado === "AL_DIA"
                        ? "alert-success"
                        : "alert-warning"
                    } mb-0`}
                  >
                    <strong>{estadoSemanal.codigo}:</strong>{" "}
                    {estadoSemanal.message}
                  </div>
                </div>
              )}

              {equipoSeleccionado && (
                <div className="col-12">
                  <div className="alert alert-info mb-0">
                    <strong>Equipo seleccionado:</strong>{" "}
                    {equipoSeleccionado.nombre_equipo}
                    <br />
                    <strong>Tipo:</strong> {equipoSeleccionado.tipo_equipo}
                    <br />
                    <strong>Ubicación:</strong>{" "}
                    {equipoSeleccionado.ubicacion_en_sala ||
                      "Sin ubicación registrada"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={`card sgtsl-card mb-4 ${
            pasoRevision === 2 ? "" : "d-none"
          }`}
        >
          <div className="card-header bg-white fw-bold">
            Checklist técnico del equipo
          </div>

          <div className="card-body">
            {cargandoChecklist && (
              <div className="alert alert-info">
                Cargando checklist del equipo...
              </div>
            )}

            {!idEquipo && (
              <p className="text-muted mb-0">
                Seleccione un equipo para cargar los ítems de revisión.
              </p>
            )}

            {idEquipo && checklist.length === 0 && !cargandoChecklist && (
              <div className="alert alert-warning mb-0">
                El equipo seleccionado no tiene checklist configurado.
              </div>
            )}

            {checklist.length > 0 && (
              <div className="alert alert-light border d-flex flex-column flex-md-row justify-content-between gap-2">
                <span>
                  <strong>Total de items:</strong> {checklist.length}
                </span>
                <span className="text-muted">
                  Complete cada punto de control antes de registrar la revision.
                </span>
              </div>
            )}

            {checklist.map((item, index) => {
              const valor = checklistValores[item.id_checklist_item] || {
                estado_item: "OK",
                observacion: "",
              };

              return (
                <div
                  key={item.id_checklist_item}
                  className="border rounded p-3 mb-3"
                >
                  <div className="row g-3 align-items-start">
                    <div className="col-md-4">
                      <h6 className="fw-bold mb-1">
                        {index + 1}. {item.nombre}
                      </h6>
                      <small className="text-muted">{item.descripcion}</small>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Estado</label>

                      <select
                        className="form-select"
                        value={valor.estado_item}
                        onChange={(e) =>
                          actualizarEstadoItem(
                            item.id_checklist_item,
                            e.target.value,
                          )
                        }
                      >
                        <option value="OK">OK</option>
                        <option value="CON_PROBLEMA">CON PROBLEMA</option>
                        <option value="NO_APLICA">NO APLICA</option>
                      </select>
                    </div>

                    <div className="col-md-5">
                      <label className="form-label fw-semibold">
                        Observación
                        {valor.estado_item === "CON_PROBLEMA" && (
                          <span className="sgtsl-required"> *</span>
                        )}
                      </label>

                      <textarea
                        className="form-control"
                        rows="2"
                        maxLength="1000"
                        value={valor.observacion}
                        onChange={(e) =>
                          actualizarObservacionItem(
                            item.id_checklist_item,
                            e.target.value,
                          )
                        }
                        placeholder="Ingrese observación si corresponde."
                      ></textarea>

                      <div className="sgtsl-counter text-end mt-1">
                        {valor.observacion.length} / 1000 caracteres
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`card sgtsl-card mb-4 ${
            pasoRevision === 3 ? "" : "d-none"
          }`}
        >
          <div className="card-header bg-white fw-bold">
            Observación general
          </div>

          <div className="card-body">
            <textarea
              className="form-control"
              rows="4"
              maxLength="1000"
              value={observacionGeneral}
              onChange={(e) => setObservacionGeneral(e.target.value)}
              placeholder="Ingrese observaciones generales de la revisión técnica."
            ></textarea>

            <div className="sgtsl-counter text-end mt-1">
              {observacionGeneral.length} / 1000 caracteres
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-between gap-2 mb-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={pasoRevision === 1 || cargando}
            onClick={retrocederPasoRevision}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Anterior
          </button>

          {pasoRevision < 3 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={cargandoChecklist || cargando}
              onClick={avanzarPasoRevision}
            >
              Siguiente
              <i className="bi bi-arrow-right ms-2"></i>
            </button>
          )}
        </div>

        {pasoRevision === 3 && (
        <div className="text-end mb-4">
          <button type="submit" className="btn btn-success" disabled={cargando}>
            <i className="bi bi-clipboard-check me-2"></i>
            {cargando ? "Registrando revisión" : "Registrar revisión"}
          </button>
        </div>
        )}
      </form>
      )}

      {mostrarListado && (
      <>
      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de revisiones</strong>
            <small className="text-muted ms-2">
              {revisionesFiltradas.length} de {revisiones.length} registros
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() =>
              setFiltrosRevisionesAbiertos((estadoActual) => !estadoActual)
            }
          >
            <i
              className={`bi ${
                filtrosRevisionesAbiertos
                  ? "bi-chevron-up"
                  : "bi-chevron-down"
              } me-1`}
            ></i>
            {filtrosRevisionesAbiertos ? "Contraer" : "Expandir"}
          </button>
        </div>

        {filtrosRevisionesAbiertos && (
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Busqueda</label>
                <input
                  type="text"
                  className="form-control"
                  value={busquedaRevision}
                  onChange={(e) => setBusquedaRevision(e.target.value)}
                  placeholder="Revision, sala, edificio, revisor o estado"
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtroFechaRevisionDesde}
                  onChange={(e) => setFiltroFechaRevisionDesde(e.target.value)}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtroFechaRevisionHasta}
                  onChange={(e) => setFiltroFechaRevisionHasta(e.target.value)}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Estado</label>
                <select
                  className="form-select"
                  value={filtroEstadoRevision}
                  onChange={(e) => setFiltroEstadoRevision(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  <option value="FINALIZADA">FINALIZADA</option>
                  <option value="ANULADA">ANULADA</option>
                  <option value="BORRADOR">BORRADOR</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Checklist</label>
                <select
                  className="form-select"
                  value={filtroProblemasRevision}
                  onChange={(e) => setFiltroProblemasRevision(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  <option value="CON_PROBLEMAS">Con problemas</option>
                  <option value="SIN_PROBLEMAS">Sin problemas</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">Sala</label>
                <select
                  className="form-select"
                  value={filtroSalaRevision}
                  onChange={(e) => setFiltroSalaRevision(e.target.value)}
                >
                  <option value="TODOS">Todas</option>
                  {salasRevisionDisponibles.map((sala) => (
                    <option key={sala.codigo} value={sala.codigo}>
                      {sala.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">Revisor</label>
                <select
                  className="form-select"
                  value={filtroRevisorRevision}
                  onChange={(e) => setFiltroRevisorRevision(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {revisoresDisponibles.map((revisor) => (
                    <option key={revisor} value={revisor}>
                      {revisor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4 d-flex align-items-end justify-content-md-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={limpiarFiltrosRevisiones}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="listado" className="card sgtsl-card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Revisiones registradas</strong>
            <small className="text-muted ms-2">
              Mostrando {revisionesVisibles.length} de{" "}
              {revisionesFiltradas.length}
            </small>
          </div>

          {revisionesFiltradas.length > limiteRevisionesContraidas && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() =>
                setListaRevisionesExpandida((estadoActual) => !estadoActual)
              }
            >
              <i
                className={`bi ${
                  listaRevisionesExpandida
                    ? "bi-arrows-collapse"
                    : "bi-arrows-expand"
                } me-1`}
              ></i>
              {listaRevisionesExpandida ? "Contraer lista" : "Expandir lista"}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Nro.</th>
                <th>Fecha</th>
                <th>Edificio</th>
                <th>Sala</th>
                <th>Revisor</th>
                <th>Checklist</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {revisionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    No existen revisiones para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                revisionesVisibles.map((revision) => (
                  <tr key={revision.id_revision}>
                    <td>
                      <strong>
                        REV-{String(revision.id_revision).padStart(6, "0")}
                      </strong>
                    </td>

                    <td>
                      {new Date(revision.fecha_revision).toLocaleString(
                        "es-CL",
                      )}
                    </td>

                    <td>{revision.edificio}</td>

                    <td>
                      {revision.codigo_sala}
                      <br />
                      <small>{revision.sala}</small>
                    </td>

                    <td>{revision.usuario_revisor}</td>

                    <td>
                      <span className="badge bg-success me-1">
                        OK: {revision.total_ok}
                      </span>
                      <span className="badge bg-danger me-1">
                        Problema: {revision.total_problema}
                      </span>
                      <span className="badge bg-secondary">
                        N/A: {revision.total_no_aplica}
                      </span>
                      <div className="small text-muted mt-1">
                        Total checks: {obtenerTotalChecklistRevision(revision)}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${obtenerClaseEstadoRevision(revision.estado_revision_general)}`}
                      >
                        {revision.estado_revision_general}
                      </span>
                      <div className="small text-muted mt-1">
                        Items registrados: {obtenerTotalChecklistRevision(revision)}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Ver detalle"
                        onClick={() => verDetalleRevision(revision.id_revision)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        title="Ver historial"
                        onClick={() => verHistorialRevision(revision)}
                      >
                        <i className="bi bi-clock-history"></i>
                      </button>

                      {puedeEditarRevision(revision) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning me-1"
                          title="Editar revision"
                          onClick={() => manejarEdicionRevision(revision)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}

                      {puedeAnularRevision(revision) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Anular revision"
                          onClick={() => manejarAnulacionRevision(revision)}
                        >
                          <i className="bi bi-x-circle"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </MainLayout>
  );
}

export default RevisionesPage;



