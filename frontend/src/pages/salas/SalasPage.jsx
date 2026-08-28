// Pagina de salas y laboratorios SGTSL.
// Presenta una vista operativa de ubicaciones, equipamiento, incidencias y revision semanal.

import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import Swal from "sweetalert2";

import MainLayout from "../../layouts/MainLayout";
import { listarIncidencias } from "../../services/incidenciasService";
import { obtenerEquiposPorSala } from "../../services/revisionesService";
import {
  editarSala,
  listarSalas,
  obtenerHistorialSala,
  obtenerQrSala,
  registrarSala,
} from "../../services/salasService";

function SalasPage({ vista = "completa" }) {
  const navigate = useNavigate();
  const [salas, setSalas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEdificio, setFiltroEdificio] = useState("TODOS");
  const [filtroTipoSala, setFiltroTipoSala] = useState("TODOS");
  const [filtroEstadoSala, setFiltroEstadoSala] = useState("TODOS");
  const [filtroRevision, setFiltroRevision] = useState("TODOS");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [salasExpandidas, setSalasExpandidas] = useState({});
  const [busquedaSeguimiento, setBusquedaSeguimiento] = useState("");
  const [filtroEdificioSeguimiento, setFiltroEdificioSeguimiento] =
    useState("TODOS");
  const [filtroTipoSeguimiento, setFiltroTipoSeguimiento] = useState("TODOS");
  const [filtrosSeguimientoAbiertos, setFiltrosSeguimientoAbiertos] =
    useState(true);
  const [listaSeguimientoExpandida, setListaSeguimientoExpandida] =
    useState(false);
  const [guardandoSala, setGuardandoSala] = useState(false);
  const [formSala, setFormSala] = useState({
    codigo: "",
    nombre: "",
    id_edificio: "",
    id_tipo_sala: "",
    piso: "",
    capacidad: "",
    ubicacion_detalle: "",
    estado_sala: "ACTIVA",
    permite_reserva: false,
    observaciones: "",
  });

  const limiteSalasContraidas = 10;
  const limiteSeguimientoContraido = 8;
  const usuarioSesion = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sgtsl_usuario")) || {};
    } catch {
      return {};
    }
  }, []);
  const rolUsuario = usuarioSesion?.rol || "";
  const puedeGestionarRevision = [
    "SUPER_ADMINISTRADOR",
    "ADMINISTRADOR",
    "TECNICO_SOPORTE",
    "ALUMNO_PRACTICA",
  ].includes(rolUsuario);
  const puedeEditarSala = ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"].includes(
    rolUsuario,
  );
  const puedeVerQrSala = [
    "SUPER_ADMINISTRADOR",
    "ADMINISTRADOR",
    "TECNICO_SOPORTE",
    "ALUMNO_PRACTICA",
  ].includes(rolUsuario);
  const mostrarSeguimiento = vista === "completa" || vista === "seguimiento";
  const mostrarListado = vista === "completa" || vista === "listado";
  const mostrarRegistro = vista === "completa" || vista === "registro";

  useEffect(() => {
    cargarSalas();
  }, []);

  useEffect(() => {
    setListaExpandida(false);
    setSalasExpandidas({});
  }, [
    busqueda,
    filtroEdificio,
    filtroTipoSala,
    filtroEstadoSala,
    filtroRevision,
  ]);

  useEffect(() => {
    setListaSeguimientoExpandida(false);
  }, [busquedaSeguimiento, filtroEdificioSeguimiento, filtroTipoSeguimiento]);

  async function cargarSalas() {
    try {
      setCargando(true);
      const respuesta = await listarSalas();
      setSalas(respuesta.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar salas",
        text:
          error.response?.data?.message ||
          "No fue posible cargar las salas y laboratorios.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setCargando(false);
    }
  }

  const edificiosDisponibles = useMemo(() => {
    return Array.from(new Set(salas.map((sala) => sala.edificio).filter(Boolean))).sort();
  }, [salas]);

  const edificiosCatalogo = useMemo(() => {
    const edificios = new Map();

    salas.forEach((sala) => {
      if (!sala.id_edificio) return;
      edificios.set(sala.id_edificio, {
        id_edificio: sala.id_edificio,
        nombre: sala.edificio,
        campus: sala.campus,
      });
    });

    return Array.from(edificios.values()).sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre)),
    );
  }, [salas]);

  const tiposSalaDisponibles = useMemo(() => {
    return Array.from(new Set(salas.map((sala) => sala.tipo_sala).filter(Boolean))).sort();
  }, [salas]);

  const tiposSalaCatalogo = useMemo(() => {
    const tipos = new Map();

    salas.forEach((sala) => {
      if (!sala.id_tipo_sala) return;
      tipos.set(sala.id_tipo_sala, {
        id_tipo_sala: sala.id_tipo_sala,
        nombre: sala.tipo_sala,
      });
    });

    return Array.from(tipos.values()).sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre)),
    );
  }, [salas]);

  const estadosSalaDisponibles = useMemo(() => {
    return Array.from(new Set(salas.map((sala) => sala.estado_sala).filter(Boolean))).sort();
  }, [salas]);

  const resumen = useMemo(() => {
    const activas = salas.filter((sala) => sala.estado_sala === "ACTIVA").length;
    const mantencion = salas.filter(
      (sala) => sala.estado_sala === "MANTENCION",
    ).length;
    const conRevision = salas.filter(
      (sala) => sala.estado_revision_semanal === "AL_DIA",
    ).length;
    const pendientes = salas.filter(
      (sala) => sala.estado_revision_semanal !== "AL_DIA",
    ).length;
    const conIncidenciasAbiertas = salas.filter(
      (sala) => Number(sala.incidencias_abiertas || 0) > 0,
    ).length;

    return {
      total: salas.length,
      activas,
      mantencion,
      conRevision,
      pendientes,
      conIncidenciasAbiertas,
    };
  }, [salas]);

  const salasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return salas.filter((sala) => {
      const cumpleBusqueda =
        !texto ||
        [
          sala.codigo,
          sala.nombre,
          sala.edificio,
          sala.campus,
          sala.tipo_sala,
          sala.ubicacion_detalle,
          sala.observaciones,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(texto));

      const cumpleEdificio =
        filtroEdificio === "TODOS" || sala.edificio === filtroEdificio;

      const cumpleTipo =
        filtroTipoSala === "TODOS" || sala.tipo_sala === filtroTipoSala;

      const cumpleEstado =
        filtroEstadoSala === "TODOS" || sala.estado_sala === filtroEstadoSala;

      const cumpleRevision =
        filtroRevision === "TODOS" ||
        sala.estado_revision_semanal === filtroRevision;

      return (
        cumpleBusqueda &&
        cumpleEdificio &&
        cumpleTipo &&
        cumpleEstado &&
        cumpleRevision
      );
    });
  }, [
    salas,
    busqueda,
    filtroEdificio,
    filtroTipoSala,
    filtroEstadoSala,
    filtroRevision,
  ]);

  const salasVisibles = useMemo(() => {
    if (listaExpandida) return salasFiltradas;
    return salasFiltradas.slice(0, limiteSalasContraidas);
  }, [salasFiltradas, listaExpandida]);

  const salasSeguimiento = useMemo(() => {
    const texto = busquedaSeguimiento.trim().toLowerCase();

    return salas
      .filter((sala) => {
        const requiereSeguimiento =
          sala.estado_sala === "MANTENCION" ||
          sala.estado_revision_semanal !== "AL_DIA" ||
          Number(sala.incidencias_abiertas || 0) > 0;

        if (!requiereSeguimiento) return false;

        const cumpleBusqueda =
          !texto ||
          [
            sala.codigo,
            sala.nombre,
            sala.edificio,
            sala.campus,
            sala.tipo_sala,
            sala.estado_sala,
          ]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(texto));

        const cumpleEdificio =
          filtroEdificioSeguimiento === "TODOS" ||
          sala.edificio === filtroEdificioSeguimiento;

        const cumpleTipo =
          filtroTipoSeguimiento === "TODOS" ||
          (filtroTipoSeguimiento === "CON_INCIDENCIAS" &&
            Number(sala.incidencias_abiertas || 0) > 0) ||
          (filtroTipoSeguimiento === "MANTENCION" &&
            sala.estado_sala === "MANTENCION") ||
          (filtroTipoSeguimiento === "PENDIENTE_REVISION" &&
            sala.estado_revision_semanal === "PENDIENTE") ||
          (filtroTipoSeguimiento === "SIN_REVISION" &&
            sala.estado_revision_semanal === "SIN_REVISION");

        return cumpleBusqueda && cumpleEdificio && cumpleTipo;
      })
      .sort((a, b) => {
        const incidenciaA = Number(a.incidencias_abiertas || 0);
        const incidenciaB = Number(b.incidencias_abiertas || 0);

        if (incidenciaB !== incidenciaA) return incidenciaB - incidenciaA;

        const revisionA = a.estado_revision_semanal === "AL_DIA" ? 1 : 0;
        const revisionB = b.estado_revision_semanal === "AL_DIA" ? 1 : 0;

        return revisionA - revisionB;
      });
  }, [
    salas,
    busquedaSeguimiento,
    filtroEdificioSeguimiento,
    filtroTipoSeguimiento,
  ]);

  const salasSeguimientoVisibles = useMemo(() => {
    if (listaSeguimientoExpandida) return salasSeguimiento;
    return salasSeguimiento.slice(0, limiteSeguimientoContraido);
  }, [salasSeguimiento, listaSeguimientoExpandida]);

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroEdificio("TODOS");
    setFiltroTipoSala("TODOS");
    setFiltroEstadoSala("TODOS");
    setFiltroRevision("TODOS");
    setListaExpandida(false);
    setSalasExpandidas({});
  }

  function limpiarFiltrosSeguimiento() {
    setBusquedaSeguimiento("");
    setFiltroEdificioSeguimiento("TODOS");
    setFiltroTipoSeguimiento("TODOS");
    setListaSeguimientoExpandida(false);
  }

  function actualizarCampoSala(campo, valor) {
    setFormSala((estadoActual) => ({
      ...estadoActual,
      [campo]: valor,
    }));
  }

  function limpiarFormularioSala() {
    setFormSala({
      codigo: "",
      nombre: "",
      id_edificio: "",
      id_tipo_sala: "",
      piso: "",
      capacidad: "",
      ubicacion_detalle: "",
      estado_sala: "ACTIVA",
      permite_reserva: false,
      observaciones: "",
    });
  }

  function validarFormularioSala() {
    const codigo = formSala.codigo.trim();
    const nombre = formSala.nombre.trim();
    const capacidadTexto = String(formSala.capacidad).trim();

    if (codigo.length < 3) {
      return "Debe ingresar un codigo de sala de al menos 3 caracteres.";
    }

    if (codigo.length > 30) {
      return "El codigo de la sala no puede superar los 30 caracteres.";
    }

    if (nombre.length < 3) {
      return "Debe ingresar un nombre de sala de al menos 3 caracteres.";
    }

    if (nombre.length > 100) {
      return "El nombre de la sala no puede superar los 100 caracteres.";
    }

    if (!formSala.id_edificio || !formSala.id_tipo_sala) {
      return "Debe seleccionar edificio y tipo de sala.";
    }

    if (formSala.piso.trim().length > 20) {
      return "El piso no puede superar los 20 caracteres.";
    }

    if (capacidadTexto) {
      const capacidad = Number(capacidadTexto);

      if (!Number.isInteger(capacidad) || capacidad < 0 || capacidad > 999) {
        return "La capacidad debe ser un numero entero entre 0 y 999.";
      }
    }

    if (formSala.ubicacion_detalle.trim().length > 255) {
      return "La ubicacion no puede superar los 255 caracteres.";
    }

    if (formSala.observaciones.trim().length > 500) {
      return "Las observaciones no pueden superar los 500 caracteres.";
    }

    return null;
  }

  async function manejarRegistroSala(event) {
    event.preventDefault();

    const mensajeValidacion = validarFormularioSala();

    if (mensajeValidacion) {
      Swal.fire({
        icon: "warning",
        title: "Revise los datos de la sala",
        text: mensajeValidacion,
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    try {
      setGuardandoSala(true);

      const payload = {
        codigo: formSala.codigo.trim().toUpperCase(),
        nombre: formSala.nombre.trim(),
        id_edificio: Number(formSala.id_edificio),
        id_tipo_sala: Number(formSala.id_tipo_sala),
        piso: formSala.piso.trim() || null,
        capacidad:
          formSala.capacidad === "" ? null : Number(formSala.capacidad),
        ubicacion_detalle: formSala.ubicacion_detalle.trim() || null,
        estado_sala: formSala.estado_sala,
        permite_reserva: formSala.permite_reserva,
        observaciones: formSala.observaciones.trim() || null,
      };

      const respuesta = await registrarSala(payload);

      await Swal.fire({
        icon: "success",
        title: "Sala registrada",
        text:
          respuesta.message ||
          "La sala fue incorporada correctamente al registro institucional.",
        confirmButtonColor: "#0D2B63",
      });

      limpiarFormularioSala();
      await cargarSalas();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al registrar sala",
        text:
          error.response?.data?.message ||
          "No fue posible registrar la sala.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setGuardandoSala(false);
    }
  }

  function alternarSalaExpandida(idSala) {
    setSalasExpandidas((prev) => ({
      ...prev,
      [idSala]: !prev[idSala],
    }));
  }

  function obtenerClaseEstadoSala(estado) {
    if (estado === "ACTIVA") return "bg-success";
    if (estado === "MANTENCION") return "bg-warning text-dark";
    if (estado === "INACTIVA") return "bg-secondary";
    return "bg-primary";
  }

  function obtenerClaseRevision(estado) {
    if (estado === "AL_DIA") return "bg-success";
    if (estado === "PENDIENTE") return "bg-warning text-dark";
    return "bg-secondary";
  }

  function formatearRevision(estado) {
    if (estado === "AL_DIA") return "AL DIA";
    if (estado === "PENDIENTE") return "PENDIENTE";
    return "SIN REVISION";
  }

  function formatearFecha(fecha) {
    return fecha ? new Date(fecha).toLocaleString("es-CL") : "No registrada";
  }

  function verDetalleSala(sala) {
    Swal.fire({
      title: `${sala.codigo} - ${sala.nombre}`,
      width: 850,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#0D2B63",
      html: `
        <div style="text-align:left">
          <p><strong>Edificio:</strong> ${sala.edificio}</p>
          <p><strong>Campus:</strong> ${sala.campus}</p>
          <p><strong>Tipo de sala:</strong> ${sala.tipo_sala}</p>
          <p><strong>Piso:</strong> ${sala.piso || "No registrado"}</p>
          <p><strong>Capacidad:</strong> ${sala.capacidad || "No registrada"}</p>
          <p><strong>Estado:</strong> ${sala.estado_sala}</p>
          <p><strong>Permite reserva:</strong> ${
            sala.permite_reserva ? "Si" : "No"
          }</p>

          <hr/>

          <p><strong>Equipos asignados:</strong> ${sala.total_equipos_asignados}</p>
          <p><strong>Incidencias abiertas:</strong> ${sala.incidencias_abiertas}</p>
          <p><strong>Total incidencias:</strong> ${sala.total_incidencias}</p>
          <p><strong>Ultima revision:</strong> ${formatearFecha(sala.ultima_revision)}</p>
          <p><strong>Revision semanal:</strong> ${formatearRevision(
            sala.estado_revision_semanal,
          )}</p>

          <hr/>

          <p>
            <strong>Ubicacion:</strong><br/>
            ${sala.ubicacion_detalle || "Sin ubicacion detallada."}
          </p>
          <p>
            <strong>Observaciones:</strong><br/>
            ${sala.observaciones || "Sin observaciones registradas."}
          </p>
        </div>
      `,
    });
  }

  async function verQrSala(sala) {
    try {
      const respuesta = await obtenerQrSala(sala.id_sala);
      const qr = respuesta.data;
      const imagenQr = await QRCode.toDataURL(qr.url_destino, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 260,
      });

      Swal.fire({
        title: `QR ${sala.codigo}`,
        width: 720,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#0D2B63",
        html: `
          <div style="text-align:center">
            <p style="margin-bottom:12px">
              Al escanear este codigo, el usuario sera dirigido al registro de
              incidencias con la sala preseleccionada.
            </p>

            <img
              src="${imagenQr}"
              alt="QR sala ${escaparHtml(sala.codigo)}"
              style="width:260px;height:260px;border:1px solid #dee2e6;border-radius:8px;padding:10px;background:#fff"
            />

            <div style="text-align:left;margin-top:16px">
              <p class="mb-1"><strong>Sala:</strong> ${escaparHtml(sala.codigo)} - ${escaparHtml(sala.nombre)}</p>
              <p class="mb-1"><strong>Destino:</strong></p>
              <input class="form-control" readonly value="${escaparHtml(qr.url_destino)}" />
            </div>

            <div class="d-flex justify-content-center gap-2 mt-3">
              <a
                class="btn btn-outline-primary"
                href="${imagenQr}"
                download="QR-${escaparHtml(sala.codigo)}.png"
              >
                Descargar PNG
              </a>
              <button
                type="button"
                class="btn btn-outline-secondary"
                id="btnImprimirQrSala"
              >
                Imprimir
              </button>
            </div>
          </div>
        `,
        didOpen: () => {
          const botonImprimir = document.getElementById("btnImprimirQrSala");

          botonImprimir?.addEventListener("click", () => {
            const ventana = window.open("", "_blank");

            if (!ventana) return;

            ventana.document.write(`
              <!doctype html>
              <html>
                <head>
                  <title>QR ${escaparHtml(sala.codigo)}</title>
                  <style>
                    body {
                      font-family: Arial, sans-serif;
                      margin: 32px;
                      text-align: center;
                    }
                    img {
                      height: 320px;
                      width: 320px;
                    }
                    h1 {
                      color: #0D2B63;
                    }
                  </style>
                </head>
                <body>
                  <h1>${escaparHtml(sala.codigo)}</h1>
                  <h2>${escaparHtml(sala.nombre)}</h2>
                  <p>Escanee para reportar una incidencia de la sala.</p>
                  <img src="${imagenQr}" />
                </body>
              </html>
            `);
            ventana.document.close();
            ventana.focus();
            ventana.print();
          });
        },
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al generar QR",
        text:
          error.response?.data?.message ||
          "No fue posible generar el QR de la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function verEquiposSala(sala) {
    try {
      const respuesta = await obtenerEquiposPorSala(sala.id_sala);
      const equipos = respuesta.data || [];

      const contenido =
        equipos.length > 0
          ? `
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Tipo</th>
                    <th>Ubicacion</th>
                  </tr>
                </thead>
                <tbody>
                  ${equipos
                    .map(
                      (equipo) => `
                        <tr>
                          <td>
                            <strong>${equipo.nombre_equipo}</strong><br/>
                            <small>${equipo.codigo_inventario || "Sin codigo"}</small>
                          </td>
                          <td>${equipo.tipo_equipo}</td>
                          <td>${equipo.ubicacion_en_sala || "No registrada"}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="text-muted mb-0">La sala no tiene equipos asignados actualmente.</p>`;

      Swal.fire({
        title: `Equipos ${sala.codigo}`,
        width: 850,
        html: contenido,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al consultar equipos",
        text:
          error.response?.data?.message ||
          "No fue posible cargar los equipos asignados a la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function verIncidenciasSala(sala) {
    try {
      const respuesta = await listarIncidencias();
      const incidencias = (respuesta.data || []).filter(
        (incidencia) => Number(incidencia.id_sala) === Number(sala.id_sala),
      );

      const contenido =
        incidencias.length > 0
          ? `
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Reporta</th>
                  </tr>
                </thead>
                <tbody>
                  ${incidencias
                    .map(
                      (incidencia) => `
                        <tr>
                          <td>
                            <strong>${incidencia.ticket}</strong><br/>
                            <small>${incidencia.titulo}</small>
                          </td>
                          <td>${incidencia.prioridad}</td>
                          <td>${incidencia.estado_incidencia}</td>
                          <td>${incidencia.usuario_reporta || "No registrado"}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="text-muted mb-0">La sala no tiene incidencias registradas.</p>`;

      Swal.fire({
        title: `Incidencias ${sala.codigo}`,
        width: 900,
        html: contenido,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al consultar incidencias",
        text:
          error.response?.data?.message ||
          "No fue posible cargar las incidencias de la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarEdicionSala(sala) {
    if (!puedeEditarSala) {
      Swal.fire({
        icon: "info",
        title: "Edicion no disponible",
        text: "Solo administracion puede modificar antecedentes de salas.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const resultado = await Swal.fire({
      title: `Editar ${sala.codigo}`,
      width: 850,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            Actualice solo antecedentes administrativos de la sala. El cambio
            quedara registrado en auditoria del sistema.
          </p>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Nombre sala</label>
              <input
                id="editarSalaNombre"
                class="form-control"
                maxlength="100"
                value="${escaparHtml(sala.nombre)}"
              />
              <small class="text-muted">Minimo 3 caracteres. Maximo 100.</small>
            </div>

            <div class="col-md-3">
              <label class="form-label fw-semibold">Piso</label>
              <input
                id="editarSalaPiso"
                class="form-control"
                maxlength="20"
                value="${escaparHtml(sala.piso || "")}"
              />
              <small class="text-muted">Maximo 20.</small>
            </div>

            <div class="col-md-3">
              <label class="form-label fw-semibold">Capacidad</label>
              <input
                id="editarSalaCapacidad"
                type="number"
                class="form-control"
                min="0"
                max="999"
                value="${sala.capacidad ?? ""}"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Estado</label>
              <select id="editarSalaEstado" class="form-select">
                <option value="ACTIVA" ${
                  sala.estado_sala === "ACTIVA" ? "selected" : ""
                }>ACTIVA</option>
                <option value="MANTENCION" ${
                  sala.estado_sala === "MANTENCION" ? "selected" : ""
                }>MANTENCION</option>
                <option value="INACTIVA" ${
                  sala.estado_sala === "INACTIVA" ? "selected" : ""
                }>INACTIVA</option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold d-block">Reserva</label>
              <div class="form-check mt-2">
                <input
                  id="editarSalaPermiteReserva"
                  class="form-check-input"
                  type="checkbox"
                  ${sala.permite_reserva ? "checked" : ""}
                />
                <label class="form-check-label" for="editarSalaPermiteReserva">
                  Permite reserva institucional
                </label>
              </div>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Ubicacion</label>
              <input
                id="editarSalaUbicacion"
                class="form-control"
                maxlength="255"
                value="${escaparHtml(sala.ubicacion_detalle || "")}"
              />
              <small class="text-muted">Maximo 255 caracteres.</small>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Observaciones</label>
              <textarea
                id="editarSalaObservaciones"
                class="form-control"
                rows="3"
                maxlength="500"
              >${escaparHtml(sala.observaciones || "")}</textarea>
              <small class="text-muted">Maximo 500 caracteres.</small>
            </div>

            <div class="col-12">
              <div
                id="editarSalaError"
                class="alert alert-warning py-2 px-3 mb-0 d-none"
                style="font-size:14px"
              ></div>
            </div>
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const error = document.getElementById("editarSalaError");
        const nombre = document.getElementById("editarSalaNombre").value.trim();
        const piso = document.getElementById("editarSalaPiso").value.trim();
        const capacidadTexto = document
          .getElementById("editarSalaCapacidad")
          .value.trim();
        const estado = document.getElementById("editarSalaEstado").value;
        const permiteReserva = document.getElementById(
          "editarSalaPermiteReserva",
        ).checked;
        const ubicacion = document
          .getElementById("editarSalaUbicacion")
          .value.trim();
        const observaciones = document
          .getElementById("editarSalaObservaciones")
          .value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (!nombre || nombre.length < 3) {
          error.textContent =
            "Debe ingresar un nombre de sala de al menos 3 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (nombre.length > 100) {
          error.textContent = "El nombre de la sala no puede superar los 100 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (piso.length > 20) {
          error.textContent = "El piso no puede superar los 20 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        const capacidad =
          capacidadTexto === "" ? null : Number(capacidadTexto);

        if (
          capacidad !== null &&
          (!Number.isInteger(capacidad) || capacidad < 0 || capacidad > 999)
        ) {
          error.textContent =
            "La capacidad debe ser un numero entero entre 0 y 999.";
          error.classList.remove("d-none");
          return false;
        }

        if (ubicacion.length > 255) {
          error.textContent = "La ubicacion no puede superar los 255 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (observaciones.length > 500) {
          error.textContent = "Las observaciones no pueden superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          nombre,
          piso: piso || null,
          capacidad,
          estado_sala: estado,
          permite_reserva: permiteReserva,
          ubicacion_detalle: ubicacion || null,
          observaciones: observaciones || null,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await editarSala(sala.id_sala, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Sala actualizada",
        text: "Los antecedentes de la sala fueron actualizados correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      await cargarSalas();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar sala",
        text:
          error.response?.data?.message ||
          "No fue posible actualizar la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  function formatearValorAuditoria(valor) {
    if (!valor) {
      return `<span style="color:#6c757d">Sin datos</span>`;
    }

    try {
      const datos = typeof valor === "string" ? JSON.parse(valor) : valor;
      const entradas = Object.entries(datos || {});

      if (entradas.length === 0) {
        return `<span style="color:#6c757d">Sin datos</span>`;
      }

      return `
        <div style="
          display:grid;
          grid-template-columns:minmax(150px, 28%) 1fr;
          border:1px solid #e9ecef;
          border-radius:6px;
          overflow:hidden;
          font-size:13px;
        ">
          ${entradas
            .map(
              ([clave, contenido]) => `
                <div style="
                  padding:7px 9px;
                  background:#f8f9fa;
                  border-bottom:1px solid #e9ecef;
                  font-weight:600;
                  color:#495057;
                ">
                  ${formatearEtiquetaAuditoria(clave)}
                </div>
                <div style="
                  padding:7px 9px;
                  border-bottom:1px solid #e9ecef;
                  color:#212529;
                  word-break:break-word;
                ">
                  ${formatearContenidoAuditoria(contenido, clave)}
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    } catch {
      return escaparHtml(String(valor));
    }
  }

  function formatearContenidoAuditoria(contenido, clave = "") {
    if (contenido === null || contenido === undefined || contenido === "") {
      return `<span style="color:#6c757d">Sin dato</span>`;
    }

    const clavesNumericas = [
      "total_items_checklist",
      "items_ok",
      "items_con_problema",
      "items_no_aplica",
    ];

    if (clavesNumericas.includes(clave)) return String(contenido);

    if (contenido === true || contenido === 1) return "Sí";
    if (contenido === false || contenido === 0) return "No";

    return escaparHtml(contenido);
  }

  function formatearEtiquetaAuditoria(clave) {
    const etiquetas = {
      id_sala: "Registro interno de la sala",
      codigo: "Código",
      nombre: "Nombre",
      piso: "Piso",
      capacidad: "Capacidad",
      ubicacion_detalle: "Ubicación",
      estado_sala: "Estado",
      permite_reserva: "Permite reserva institucional",
      observaciones: "Observaciones",
      eliminado_logico: "Retirada lógicamente",
      id_equipo: "Registro interno del equipo",
      nombre_equipo: "Equipo",
      codigo_inventario: "Código de inventario",
      codigo_sala: "Código de sala",
      sala: "Sala",
      ubicacion_en_sala: "Ubicación en sala",
      estado_asignacion: "Estado de asignación",
      fecha_retiro: "Fecha de retiro",
      motivo_retiro: "Motivo de retiro",
      motivo_anulacion: "Motivo de anulación",
      id_revision: "Registro interno de la revisión",
      estado_revision_general: "Estado de revisión",
      origen_revision: "Origen de revisión",
      observacion_general: "Observación general",
      total_items_checklist: "Total de ítems del checklist",
      items_ok: "Ítems revisados OK",
      items_con_problema: "Ítems con problema",
      items_no_aplica: "Ítems no aplican",
    };

    return etiquetas[clave] || clave.replaceAll("_", " ");
  }

  function obtenerTituloAuditoriaSala(item) {
    if (item.tabla_afectada === "sala_equipo") {
      return item.accion === "UPDATE" ? "Retiro de equipo" : "Asignación de equipo";
    }

    if (item.tabla_afectada === "revision") {
      return "Revisión técnica";
    }

    if (item.accion === "INSERT") return "Registro inicial";
    if (item.accion === "UPDATE") return "Actualización de datos";
    if (item.accion === "DELETE_LOGICO") return "Deshabilitacion";
    return item.accion;
  }

  function obtenerDescripcionAuditoriaSala(item) {
    if (item.tabla_afectada === "sala_equipo") {
      if (item.accion === "UPDATE") {
        return "Se retiro un equipo asociado a la sala, conservando el movimiento en auditoria.";
      }

      return "Se asigno un equipo a la sala para su uso operativo.";
    }

    if (item.tabla_afectada === "revision") {
      return item.descripcion || "Se registro una revision tecnica asociada a la sala.";
    }

    if (item.accion === "INSERT") {
      return "La sala fue incorporada al registro institucional del sistema.";
    }

    if (item.accion === "UPDATE") {
      return "Se actualizaron antecedentes administrativos de la sala.";
    }

    return item.descripcion || "Movimiento registrado en auditoria.";
  }

  function obtenerOrigenAuditoria(origen) {
    if (!origen) return "No registrado";
    if (origen.includes("Trigger")) return "Registro automatico de base de datos";
    if (origen.includes("API")) return "Operacion realizada desde el sistema";
    return escaparHtml(origen);
  }

  async function verHistorialSala(sala) {
    try {
      const respuesta = await obtenerHistorialSala(sala.id_sala);
      const historial = respuesta.data || [];

      const contenidoHistorial =
        historial.length > 0
          ? historial
              .map(
                (item) => `
                  <div style="
                    border-left:4px solid #0D2B63;
                    padding:10px 12px;
                    margin-bottom:12px;
                    background:#f8f9fa;
                    border-radius:6px;
                  ">
                    <p style="margin:0">
                      <span style="
                        display:inline-block;
                        padding:4px 8px;
                        border-radius:6px;
                        background:#0D2B63;
                        color:#ffffff;
                        font-size:12px;
                        font-weight:bold;
                      ">
                        ${obtenerTituloAuditoriaSala(item)}
                      </span>
                    </p>

                    <p style="margin:4px 0">
                      ${obtenerDescripcionAuditoriaSala(item)}
                    </p>

                    <small style="color:#6c757d">
                      Usuario: ${escaparHtml(item.usuario || "No registrado")}<br/>
                      Fecha: ${new Date(item.fecha_evento).toLocaleString("es-CL")}<br/>
                      Origen: ${obtenerOrigenAuditoria(item.user_agent)}
                    </small>

                    <details style="margin-top:8px">
                      <summary style="cursor:pointer;font-weight:bold">
                        Ver detalle tecnico
                      </summary>
                      <div style="
                        margin-top:8px;
                        padding:10px;
                        background:#ffffff;
                        border:1px solid #dee2e6;
                        border-radius:6px;
                      ">
                        <div style="margin-bottom:10px">
                          <strong style="display:block;margin-bottom:6px">
                            Datos anteriores
                          </strong>
                          ${formatearValorAuditoria(item.valor_anterior)}
                        </div>
                        <div>
                          <strong style="display:block;margin-bottom:6px">
                            Datos registrados
                          </strong>
                          ${formatearValorAuditoria(item.valor_nuevo)}
                        </div>
                      </div>
                    </details>
                  </div>
                `,
              )
              .join("")
          : `
            <p style="color:#6c757d">
              Esta sala no tiene movimientos registrados en auditoria.
            </p>
          `;

      Swal.fire({
        title: `Historial ${sala.codigo}`,
        width: 900,
        html: `
          <div style="text-align:left">
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
          "No fue posible cargar el historial de la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h2 className="fw-bold mb-1">Salas</h2>
        <p className="text-muted mb-0">
          Consulta operativa de salas, laboratorios, equipamiento e indicadores de uso tecnico.
        </p>
      </div>

      {mostrarRegistro && (
      <div id="registro" className="card sgtsl-card mb-4">
        <div className="card-header bg-white">
          <strong>Registro de nueva sala</strong>
          <small className="text-muted ms-2">
            Para ampliaciones, nuevos laboratorios o espacios institucionales
          </small>
        </div>

        <div className="card-body">
          {edificiosCatalogo.length === 0 || tiposSalaCatalogo.length === 0 ? (
            <div className="alert alert-warning mb-0">
              No fue posible cargar edificios o tipos de sala. Revise los
              catalogos antes de registrar una nueva sala.
            </div>
          ) : (
            <form onSubmit={manejarRegistroSala}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Codigo sala <span className="sgtsl-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control text-uppercase"
                    maxLength="30"
                    value={formSala.codigo}
                    onChange={(e) =>
                      actualizarCampoSala("codigo", e.target.value)
                    }
                    placeholder="Ej: PAS-107"
                  />
                  <small className="text-muted">
                    {formSala.codigo.length} / 30 caracteres.
                  </small>
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-semibold">
                    Nombre sala <span className="sgtsl-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength="100"
                    value={formSala.nombre}
                    onChange={(e) =>
                      actualizarCampoSala("nombre", e.target.value)
                    }
                    placeholder="Ej: Sala de Innovacion Tecnologica"
                  />
                  <small className="text-muted">
                    {formSala.nombre.length} / 100 caracteres.
                  </small>
                </div>

                <div className="col-md-2">
                  <label className="form-label fw-semibold">Piso</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength="20"
                    value={formSala.piso}
                    onChange={(e) =>
                      actualizarCampoSala("piso", e.target.value)
                    }
                    placeholder="Ej: 1"
                  />
                  <small className="text-muted">
                    {formSala.piso.length} / 20 caracteres.
                  </small>
                </div>

                <div className="col-md-2">
                  <label className="form-label fw-semibold">Capacidad</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max="999"
                    value={formSala.capacidad}
                    onChange={(e) =>
                      actualizarCampoSala("capacidad", e.target.value)
                    }
                    placeholder="Ej: 35"
                  />
                  <small className="text-muted">Maximo 999.</small>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Edificio <span className="sgtsl-required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formSala.id_edificio}
                    onChange={(e) =>
                      actualizarCampoSala("id_edificio", e.target.value)
                    }
                  >
                    <option value="">Seleccione edificio</option>
                    {edificiosCatalogo.map((edificio) => (
                      <option
                        key={edificio.id_edificio}
                        value={edificio.id_edificio}
                      >
                        {edificio.nombre} - {edificio.campus}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Tipo de sala <span className="sgtsl-required">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formSala.id_tipo_sala}
                    onChange={(e) =>
                      actualizarCampoSala("id_tipo_sala", e.target.value)
                    }
                  >
                    <option value="">Seleccione tipo</option>
                    {tiposSalaCatalogo.map((tipo) => (
                      <option
                        key={tipo.id_tipo_sala}
                        value={tipo.id_tipo_sala}
                      >
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Estado</label>
                  <select
                    className="form-select"
                    value={formSala.estado_sala}
                    onChange={(e) =>
                      actualizarCampoSala("estado_sala", e.target.value)
                    }
                  >
                    <option value="ACTIVA">ACTIVA</option>
                    <option value="MANTENCION">MANTENCION</option>
                    <option value="INACTIVA">INACTIVA</option>
                  </select>
                </div>

                <div className="col-md-8">
                  <label className="form-label fw-semibold">Ubicacion</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength="255"
                    value={formSala.ubicacion_detalle}
                    onChange={(e) =>
                      actualizarCampoSala(
                        "ubicacion_detalle",
                        e.target.value,
                      )
                    }
                    placeholder="Ej: Segundo piso, sector norte"
                  />
                  <small className="text-muted">
                    {formSala.ubicacion_detalle.length} / 255 caracteres.
                  </small>
                </div>

                <div className="col-md-4 d-flex align-items-center">
                  <div className="form-check mt-3">
                    <input
                      id="registrarSalaPermiteReserva"
                      type="checkbox"
                      className="form-check-input"
                      checked={formSala.permite_reserva}
                      onChange={(e) =>
                        actualizarCampoSala(
                          "permite_reserva",
                          e.target.checked,
                        )
                      }
                    />
                    <label
                      className="form-check-label fw-semibold"
                      htmlFor="registrarSalaPermiteReserva"
                    >
                      Permite reserva institucional
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">
                    Observaciones
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    maxLength="500"
                    value={formSala.observaciones}
                    onChange={(e) =>
                      actualizarCampoSala("observaciones", e.target.value)
                    }
                    placeholder="Ingrese antecedentes de habilitacion, uso previsto o consideraciones tecnicas."
                  ></textarea>
                  <div className="text-end text-muted small">
                    {formSala.observaciones.length} / 500 caracteres
                  </div>
                </div>

                <div className="col-12">
                  <div className="alert alert-info mb-0">
                    La sala quedara disponible para futuras asignaciones de
                    equipos, revisiones e incidencias. El registro sera
                    respaldado en auditoria del sistema.
                  </div>
                </div>

                <div className="col-12 d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={limpiarFormularioSala}
                    disabled={guardandoSala}
                  >
                    Limpiar
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={guardandoSala}
                  >
                    <i className="bi bi-building-add me-2"></i>
                    {guardandoSala ? "Registrando..." : "Registrar sala"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
      )}

      {mostrarSeguimiento && (
      <>
      <div id="seguimiento" className="row g-3 mb-4">
        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-primary">
            <div className="card-body">
              <h6 className="text-muted">Total salas</h6>
              <h2 className="fw-bold">{resumen.total}</h2>
              <small>Espacios registrados</small>
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-success">
            <div className="card-body">
              <h6 className="text-muted">Activas</h6>
              <h2 className="fw-bold">{resumen.activas}</h2>
              <small>Disponibles para operacion</small>
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-warning">
            <div className="card-body">
              <h6 className="text-muted">Mantencion</h6>
              <h2 className="fw-bold">{resumen.mantencion}</h2>
              <small>Requieren seguimiento</small>
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-success">
            <div className="card-body">
              <h6 className="text-muted">Al dia</h6>
              <h2 className="fw-bold">{resumen.conRevision}</h2>
              <small>Revision semanal vigente</small>
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-warning">
            <div className="card-body">
              <h6 className="text-muted">Pendientes</h6>
              <h2 className="fw-bold">{resumen.pendientes}</h2>
              <small>Sin revision semanal</small>
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="card sgtsl-card h-100 border-start border-5 border-danger">
            <div className="card-body">
              <h6 className="text-muted">Con incidencias</h6>
              <h2 className="fw-bold">{resumen.conIncidenciasAbiertas}</h2>
              <small>Con casos abiertos</small>
            </div>
          </div>
        </div>
      </div>

      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de seguimiento</strong>
            <small className="text-muted ms-2">
              {salasSeguimiento.length} salas requieren atencion operativa
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() =>
              setFiltrosSeguimientoAbiertos((estadoActual) => !estadoActual)
            }
          >
            <i
              className={`bi ${
                filtrosSeguimientoAbiertos
                  ? "bi-chevron-up"
                  : "bi-chevron-down"
              } me-1`}
            ></i>
            {filtrosSeguimientoAbiertos ? "Contraer" : "Expandir"}
          </button>
        </div>

        {filtrosSeguimientoAbiertos && (
          <div className="card-body">
            <div className="alert alert-info mb-3">
              Esta vista prioriza salas con incidencias abiertas, mantencion o
              revision semanal pendiente/sin revision.
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Busqueda</label>
                <input
                  type="text"
                  className="form-control"
                  value={busquedaSeguimiento}
                  onChange={(e) => setBusquedaSeguimiento(e.target.value)}
                  placeholder="Codigo, sala, edificio o estado"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Edificio</label>
                <select
                  className="form-select"
                  value={filtroEdificioSeguimiento}
                  onChange={(e) => setFiltroEdificioSeguimiento(e.target.value)}
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
                <label className="form-label fw-semibold">Criterio</label>
                <select
                  className="form-select"
                  value={filtroTipoSeguimiento}
                  onChange={(e) => setFiltroTipoSeguimiento(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  <option value="CON_INCIDENCIAS">Con incidencias</option>
                  <option value="MANTENCION">En mantencion</option>
                  <option value="PENDIENTE_REVISION">Revision pendiente</option>
                  <option value="SIN_REVISION">Sin revision</option>
                </select>
              </div>

              <div className="col-md-2 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={limpiarFiltrosSeguimiento}
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
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Seguimiento operativo de salas</strong>
            <small className="text-muted ms-2">
              Mostrando {salasSeguimientoVisibles.length} de{" "}
              {salasSeguimiento.length}
            </small>
          </div>

          {salasSeguimiento.length > limiteSeguimientoContraido && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() =>
                setListaSeguimientoExpandida((estadoActual) => !estadoActual)
              }
            >
              <i
                className={`bi ${
                  listaSeguimientoExpandida
                    ? "bi-arrows-collapse"
                    : "bi-arrows-expand"
                } me-1`}
              ></i>
              {listaSeguimientoExpandida ? "Contraer lista" : "Expandir lista"}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Sala</th>
                <th>Edificio</th>
                <th>Estado</th>
                <th>Revision semanal</th>
                <th>Incidencias abiertas</th>
                <th>Ultima revision</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    Cargando seguimiento de salas...
                  </td>
                </tr>
              ) : salasSeguimiento.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    No existen salas con alertas operativas pendientes.
                  </td>
                </tr>
              ) : (
                salasSeguimientoVisibles.map((sala) => (
                  <tr key={sala.id_sala}>
                    <td>
                      <strong>{sala.codigo}</strong>
                      <br />
                      <small>{sala.nombre}</small>
                    </td>
                    <td>
                      {sala.edificio}
                      <br />
                      <small>{sala.campus}</small>
                    </td>
                    <td>
                      <span
                        className={`badge ${obtenerClaseEstadoSala(
                          sala.estado_sala,
                        )}`}
                      >
                        {sala.estado_sala}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${obtenerClaseRevision(
                          sala.estado_revision_semanal,
                        )}`}
                      >
                        {formatearRevision(sala.estado_revision_semanal)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          Number(sala.incidencias_abiertas || 0) > 0
                            ? "bg-danger"
                            : "bg-secondary"
                        }`}
                      >
                        {sala.incidencias_abiertas}
                      </span>
                    </td>
                    <td>{formatearFecha(sala.ultima_revision)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Ver detalle"
                        onClick={() => verDetalleSala(sala)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      {puedeVerQrSala && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info me-1"
                          title="Ver QR de sala"
                          onClick={() => verQrSala(sala)}
                        >
                          <i className="bi bi-qr-code"></i>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Ver incidencias de la sala"
                        onClick={() => verIncidenciasSala(sala)}
                      >
                        <i className="bi bi-exclamation-triangle"></i>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary ms-1"
                        title="Ver historial"
                        onClick={() => verHistorialSala(sala)}
                      >
                        <i className="bi bi-clock-history"></i>
                      </button>
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

      {mostrarListado && (
      <>
      {!mostrarSeguimiento && (
        <div className="row g-3 mb-4">
          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-primary">
              <div className="card-body">
                <h6 className="text-muted">Total salas</h6>
                <h2 className="fw-bold">{resumen.total}</h2>
                <small>Espacios registrados</small>
              </div>
            </div>
          </div>

          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-success">
              <div className="card-body">
                <h6 className="text-muted">Activas</h6>
                <h2 className="fw-bold">{resumen.activas}</h2>
                <small>Disponibles para operacion</small>
              </div>
            </div>
          </div>

          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-warning">
              <div className="card-body">
                <h6 className="text-muted">Mantencion</h6>
                <h2 className="fw-bold">{resumen.mantencion}</h2>
                <small>Requieren seguimiento</small>
              </div>
            </div>
          </div>

          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-success">
              <div className="card-body">
                <h6 className="text-muted">Al dia</h6>
                <h2 className="fw-bold">{resumen.conRevision}</h2>
                <small>Revision semanal vigente</small>
              </div>
            </div>
          </div>

          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-warning">
              <div className="card-body">
                <h6 className="text-muted">Pendientes</h6>
                <h2 className="fw-bold">{resumen.pendientes}</h2>
                <small>Sin revision semanal</small>
              </div>
            </div>
          </div>

          <div className="col-md-2">
            <div className="card sgtsl-card h-100 border-start border-5 border-danger">
              <div className="card-body">
                <h6 className="text-muted">Con incidencias</h6>
                <h2 className="fw-bold">{resumen.conIncidenciasAbiertas}</h2>
                <small>Con casos abiertos</small>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de salas</strong>
            <small className="text-muted ms-2">
              {salasFiltradas.length} de {salas.length} registros
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
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Busqueda</label>
                <input
                  type="text"
                  className="form-control"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Codigo, sala, edificio, tipo o ubicacion"
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Edificio</label>
                <select
                  className="form-select"
                  value={filtroEdificio}
                  onChange={(e) => setFiltroEdificio(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {edificiosDisponibles.map((edificio) => (
                    <option key={edificio} value={edificio}>
                      {edificio}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Tipo</label>
                <select
                  className="form-select"
                  value={filtroTipoSala}
                  onChange={(e) => setFiltroTipoSala(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {tiposSalaDisponibles.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Estado</label>
                <select
                  className="form-select"
                  value={filtroEstadoSala}
                  onChange={(e) => setFiltroEstadoSala(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {estadosSalaDisponibles.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Revision</label>
                <select
                  className="form-select"
                  value={filtroRevision}
                  onChange={(e) => setFiltroRevision(e.target.value)}
                >
                  <option value="TODOS">Todas</option>
                  <option value="AL_DIA">Al dia</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="SIN_REVISION">Sin revision</option>
                </select>
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={limpiarFiltros}
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
            <strong>Salas registradas</strong>
            <small className="text-muted ms-2">
              Mostrando {salasVisibles.length} de {salasFiltradas.length}
            </small>
          </div>

          {salasFiltradas.length > limiteSalasContraidas && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setListaExpandida((estadoActual) => !estadoActual)}
            >
              <i
                className={`bi ${
                  listaExpandida ? "bi-arrows-collapse" : "bi-arrows-expand"
                } me-1`}
              ></i>
              {listaExpandida ? "Contraer lista" : "Expandir lista"}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Sala</th>
                <th>Edificio</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Equipos</th>
                <th>Incidencias</th>
                <th>Revision semanal</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    Cargando salas y laboratorios...
                  </td>
                </tr>
              ) : salasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    No existen salas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                salasVisibles.map((sala) => (
                  <Fragment key={sala.id_sala}>
                    <tr>
                      <td>
                        <div className="d-flex align-items-start gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            title={
                              salasExpandidas[sala.id_sala]
                                ? "Contraer detalle"
                                : "Expandir detalle"
                            }
                            onClick={() => alternarSalaExpandida(sala.id_sala)}
                          >
                            <i
                              className={`bi ${
                                salasExpandidas[sala.id_sala]
                                  ? "bi-chevron-up"
                                  : "bi-chevron-down"
                              }`}
                            ></i>
                          </button>

                          <div>
                            <strong>{sala.codigo}</strong>
                            <br />
                            <small>{sala.nombre}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {sala.edificio}
                        <br />
                        <small>{sala.campus}</small>
                      </td>
                      <td>{sala.tipo_sala}</td>
                      <td>
                        <span
                          className={`badge ${obtenerClaseEstadoSala(
                            sala.estado_sala,
                          )}`}
                        >
                          {sala.estado_sala}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-primary">
                          {sala.total_equipos_asignados}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            Number(sala.incidencias_abiertas || 0) > 0
                              ? "bg-danger"
                              : "bg-secondary"
                          }`}
                        >
                          Abiertas: {sala.incidencias_abiertas}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${obtenerClaseRevision(
                            sala.estado_revision_semanal,
                          )}`}
                        >
                          {formatearRevision(sala.estado_revision_semanal)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-1"
                          title="Ver detalle"
                          onClick={() => verDetalleSala(sala)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>

                        {puedeVerQrSala && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info me-1"
                            title="Ver QR de sala"
                            onClick={() => verQrSala(sala)}
                          >
                            <i className="bi bi-qr-code"></i>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark me-1"
                          title="Ver historial"
                          onClick={() => verHistorialSala(sala)}
                        >
                          <i className="bi bi-clock-history"></i>
                        </button>

                        {puedeEditarSala && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning me-1"
                            title="Editar antecedentes de la sala"
                            onClick={() => manejarEdicionSala(sala)}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary me-1"
                          title="Ver equipos asignados"
                          onClick={() => verEquiposSala(sala)}
                        >
                          <i className="bi bi-pc-display"></i>
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger me-1"
                          title="Ver incidencias de la sala"
                          onClick={() => verIncidenciasSala(sala)}
                        >
                          <i className="bi bi-exclamation-triangle"></i>
                        </button>

                        {puedeGestionarRevision && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success me-1"
                            title="Registrar revision"
                            onClick={() => navigate("/revisiones")}
                          >
                            <i className="bi bi-clipboard-check"></i>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info"
                          title="Registrar incidencia"
                          onClick={() => navigate("/incidencias")}
                        >
                          <i className="bi bi-plus-circle"></i>
                        </button>
                      </td>
                    </tr>

                    {salasExpandidas[sala.id_sala] && (
                      <tr>
                        <td colSpan="8" className="bg-light">
                          <div className="row g-3 py-2">
                            <div className="col-md-2">
                              <small className="text-muted d-block">Piso</small>
                              <strong>{sala.piso || "No registrado"}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted d-block">
                                Capacidad
                              </small>
                              <strong>
                                {sala.capacidad || "No registrada"}
                              </strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted d-block">
                                Reserva
                              </small>
                              <strong>{sala.permite_reserva ? "Si" : "No"}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Ultima revision
                              </small>
                              <strong>{formatearFecha(sala.ultima_revision)}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Total incidencias
                              </small>
                              <strong>{sala.total_incidencias}</strong>
                            </div>
                            <div className="col-md-6">
                              <small className="text-muted d-block">
                                Ubicacion
                              </small>
                              <span>
                                {sala.ubicacion_detalle ||
                                  "Sin ubicacion detallada."}
                              </span>
                            </div>
                            <div className="col-md-6">
                              <small className="text-muted d-block">
                                Observaciones
                              </small>
                              <span>
                                {sala.observaciones ||
                                  "Sin observaciones registradas."}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

export default SalasPage;




