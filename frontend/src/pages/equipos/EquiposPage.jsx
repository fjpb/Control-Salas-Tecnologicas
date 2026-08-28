// Pagina de inventario de equipos SGTSL.
// Permite consultar equipos asignados y no asignados sin modificar datos.

import { Fragment, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import MainLayout from "../../layouts/MainLayout";
import { obtenerCatalogos, registrarTipoEquipo } from "../../services/catalogosService";
import {
  asignarEquipoSala,
  decidirBajaEquipo,
  editarEquipo,
  ejecutarBajaEquipo,
  listarBajasEquipo,
  listarEquipos,
  obtenerHistorialBajaEquipo,
  obtenerHistorialEquipo,
  registrarEquipo,
  retirarEquipoSala,
  solicitarBajaEquipo,
} from "../../services/equiposService";

function EquiposPage({ vista = "completa" }) {
  const [equipos, setEquipos] = useState([]);
  const [bajasEquipo, setBajasEquipo] = useState([]);
  const [edificios, setEdificios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [tiposEquipo, setTiposEquipo] = useState([]);
  const [formEquipo, setFormEquipo] = useState({
    id_tipo_equipo: "",
    nombre_equipo: "",
    codigo_inventario: "",
    nro_serie: "",
    marca: "",
    modelo: "",
    direccion_ip: "",
    mac_address: "",
    fecha_compra: "",
    fecha_garantia_fin: "",
    tiene_factura: false,
    numero_factura: "",
    observacion_factura: "",
    estado_activo: "OPERATIVO",
    observaciones: "",
  });
  const [busqueda, setBusqueda] = useState("");
  const [filtroAsignacion, setFiltroAsignacion] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroFechaCompraDesde, setFiltroFechaCompraDesde] = useState("");
  const [filtroFechaCompraHasta, setFiltroFechaCompraHasta] = useState("");
  const [filtroGarantiaHasta, setFiltroGarantiaHasta] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [listaEquiposExpandida, setListaEquiposExpandida] = useState(false);
  const [equiposExpandidos, setEquiposExpandidos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);

  const limiteEquiposContraidos = 8;

  const usuarioSesion = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sgtsl_usuario")) || {};
    } catch {
      return {};
    }
  }, []);

  const rolUsuario = usuarioSesion?.rol || "";
  const rolesGestionBaja = [
    "SUPER_ADMINISTRADOR",
    "ADMINISTRADOR",
    "TECNICO_SOPORTE",
    "ALUMNO_PRACTICA",
  ];
  const rolesGestionEquipo = [
    "SUPER_ADMINISTRADOR",
    "ADMINISTRADOR",
    "TECNICO_SOPORTE",
  ];
  const puedeGestionarEquipo = rolesGestionEquipo.includes(rolUsuario);
  const puedeGestionarCatalogos = [
    "SUPER_ADMINISTRADOR",
    "ADMINISTRADOR",
  ].includes(rolUsuario);
  const puedeSolicitarBaja = rolesGestionBaja.includes(rolUsuario);
  const puedeResolverBaja = rolUsuario === "SUPER_ADMINISTRADOR";
  const mostrarRegistro = vista === "completa" || vista === "registro";
  const mostrarInventario = vista === "completa" || vista === "inventario";
  const mostrarAsignacion = vista === "completa" || vista === "asignacion";
  const mostrarBajas = vista === "completa" || vista === "bajas";

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    setListaEquiposExpandida(false);
    setEquiposExpandidos({});
  }, [
    busqueda,
    filtroAsignacion,
    filtroEstado,
    filtroTipo,
    filtroFechaCompraDesde,
    filtroFechaCompraHasta,
    filtroGarantiaHasta,
  ]);

  async function cargarDatosIniciales() {
    try {
      setCargando(true);

      const [respuestaEquipos, respuestaCatalogos] = await Promise.all([
        listarEquipos(),
        obtenerCatalogos(),
      ]);

      setEquipos(respuestaEquipos.data || []);
      setEdificios(respuestaCatalogos.data.edificios || []);
      setSalas(respuestaCatalogos.data.salas || []);
      setTiposEquipo(respuestaCatalogos.data.tiposEquipo || []);

      if (puedeSolicitarBaja) {
        try {
          const respuestaBajas = await listarBajasEquipo();
          setBajasEquipo(respuestaBajas.data || []);
        } catch {
          setBajasEquipo([]);
        }
      } else {
        setBajasEquipo([]);
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar equipos",
        text:
          error.response?.data?.message ||
          "No fue posible cargar el inventario de equipos.",
      });
    } finally {
      setCargando(false);
    }
  }

  function normalizarNombreTipoEquipo(valor) {
    return String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  }

  async function manejarRegistroTipoEquipo() {
    const { value: datosTipo } = await Swal.fire({
      title: "Agregar tipo de equipo",
      html: `
        <div class="text-start">
          <label class="form-label fw-semibold">Nombre del tipo <span class="text-danger">*</span></label>
          <input id="nuevoTipoEquipoNombre" class="swal2-input" maxlength="80" placeholder="Ej: DATA, IMPRESORA, AUDIO_PORTATIL" style="width:100%;margin:0 0 10px 0" />
          <small class="text-muted d-block mb-2">Se guardara en mayusculas y podra usarse inmediatamente en inventario.</small>
          <small class="text-muted d-block mb-3">No puede repetir un tipo ya registrado, aunque se escriba con minusculas o mayusculas.</small>

          <label class="form-label fw-semibold">Descripcion</label>
          <textarea id="nuevoTipoEquipoDescripcion" class="swal2-textarea" maxlength="255" placeholder="Uso o caracteristicas principales del tipo de equipo" style="width:100%;margin:0 0 10px 0"></textarea>
          <small class="text-muted d-block mb-3">Maximo 255 caracteres.</small>

          <div class="alert alert-info py-2 px-3 mb-3" style="font-size:13px">
            Active solo los datos que seran obligatorios al registrar equipos de este tipo.
          </div>

          <div class="form-check mb-2">
            <input id="nuevoTipoRequiereSerie" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="nuevoTipoRequiereSerie">
              Numero de serie obligatorio
            </label>
          </div>
          <div class="form-check mb-2">
            <input id="nuevoTipoRequiereIp" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="nuevoTipoRequiereIp">
              Direccion IP obligatoria
            </label>
          </div>
          <div class="form-check">
            <input id="nuevoTipoRequiereMac" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="nuevoTipoRequiereMac">
              Direccion MAC obligatoria
            </label>
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar tipo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      focusConfirm: false,
      preConfirm: () => {
        const nombre = document.getElementById("nuevoTipoEquipoNombre").value.trim();
        const descripcion = document
          .getElementById("nuevoTipoEquipoDescripcion")
          .value.trim();

        if (nombre.length < 2) {
          Swal.showValidationMessage("Debe ingresar un nombre de al menos 2 caracteres.");
          return false;
        }

        const nombreNormalizado = normalizarNombreTipoEquipo(nombre);
        const tipoExistente = tiposEquipo.some(
          (tipo) => normalizarNombreTipoEquipo(tipo.nombre) === nombreNormalizado,
        );

        if (tipoExistente) {
          Swal.showValidationMessage("Ya existe un tipo de equipo registrado con ese nombre.");
          return false;
        }

        if (descripcion.length > 255) {
          Swal.showValidationMessage("La descripcion no puede superar los 255 caracteres.");
          return false;
        }

        return {
          nombre,
          descripcion,
          requiere_serie: document.getElementById("nuevoTipoRequiereSerie").checked,
          requiere_ip: document.getElementById("nuevoTipoRequiereIp").checked,
          requiere_mac: document.getElementById("nuevoTipoRequiereMac").checked,
        };
      },
    });

    if (!datosTipo) return;

    try {
      const respuesta = await registrarTipoEquipo(datosTipo);
      const nuevoTipo = respuesta.data;

      setTiposEquipo((actuales) =>
        [...actuales, nuevoTipo].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      actualizarCampoEquipo("id_tipo_equipo", String(nuevoTipo.id_tipo_equipo));

      Swal.fire({
        icon: "success",
        title: "Tipo de equipo registrado",
        text: "El nuevo tipo quedo disponible para registrar equipos.",
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "No fue posible registrar el tipo",
        text:
          error.response?.data?.message ||
          "Revise los datos ingresados e intente nuevamente.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }
  function obtenerTextoEquipoTooltip(equiposCategoria, titulo) {
    if (!equiposCategoria || equiposCategoria.length === 0) {
      return titulo + ": sin equipos asociados a esta categoria.";
    }

    const limiteDetalle = 8;
    const detalle = equiposCategoria.slice(0, limiteDetalle).map((equipo) => {
      const codigo = equipo.codigo_inventario || "Sin codigo";
      const nombre = equipo.nombre_equipo || "Equipo sin nombre";
      const sala = equipo.codigo_sala || equipo.sala
        ? " | Sala: " + (equipo.codigo_sala || equipo.sala)
        : "";
      return "- " + codigo + " | " + nombre + sala;
    });

    if (equiposCategoria.length > limiteDetalle) {
      detalle.push("... y " + (equiposCategoria.length - limiteDetalle) + " equipos mas.");
    }

    return [titulo + ": " + equiposCategoria.length + " equipos", ...detalle].join("\n");
  }

  const resumen = useMemo(() => {
    const equiposActivos = equipos.filter(
      (equipo) =>
        equipo.estado_activo !== "BAJA" &&
        equipo.estado_asignacion_actual !== "BAJA" &&
        !equipo.eliminado_logico,
    );
    const asignadosDetalle = equipos.filter(
      (equipo) => equipo.estado_asignacion_actual === "ASIGNADO",
    );
    const noAsignadosDetalle = equipos.filter(
      (equipo) =>
        equipo.estado_asignacion_actual === "NO_ASIGNADO" &&
        equipo.estado_activo === "OPERATIVO" &&
        !equipo.eliminado_logico,
    );
    const conFallaDetalle = equipos.filter(
      (equipo) => equipo.estado_activo === "CON_FALLA",
    );
    const dadosBajaDetalle = equipos.filter(
      (equipo) =>
        equipo.estado_asignacion_actual === "BAJA" ||
        equipo.estado_activo === "BAJA" ||
        equipo.eliminado_logico,
    );

    return {
      total: equiposActivos.length,
      asignados: asignadosDetalle.length,
      noAsignados: noAsignadosDetalle.length,
      conFalla: conFallaDetalle.length,
      dadosBaja: dadosBajaDetalle.length,
      detalleTotal: obtenerTextoEquipoTooltip(equiposActivos, "Total equipos activos logicamente"),
      detalleAsignados: obtenerTextoEquipoTooltip(asignadosDetalle, "Equipos asignados a sala"),
      detalleNoAsignados: obtenerTextoEquipoTooltip(noAsignadosDetalle, "Equipos no asignados disponibles para sala"),
      detalleConFalla: obtenerTextoEquipoTooltip(conFallaDetalle, "Equipos con falla"),
      detalleDadosBaja: obtenerTextoEquipoTooltip(dadosBajaDetalle, "Equipos dados de baja"),
    };
  }, [equipos]);

  const resumenBajas = useMemo(() => {
    const solicitadas = bajasEquipo.filter(
      (baja) => baja.estado_baja === "SOLICITADA",
    ).length;
    const aprobadas = bajasEquipo.filter(
      (baja) => baja.estado_baja === "APROBADA",
    ).length;

    return {
      solicitadas,
      aprobadas,
      total: bajasEquipo.length,
    };
  }, [bajasEquipo]);

  function tieneBajaPendiente(equipo) {
    return bajasEquipo.some(
      (baja) =>
        Number(baja.id_equipo) === Number(equipo.id_equipo) &&
        ["SOLICITADA", "APROBADA"].includes(baja.estado_baja),
    );
  }

  const estadosDisponibles = useMemo(() => {
    return Array.from(
      new Set(equipos.map((equipo) => equipo.estado_activo).filter(Boolean)),
    );
  }, [equipos]);

  const equiposFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return equipos.filter((equipo) => {
      const cumpleBusqueda =
        !texto ||
        [
          equipo.codigo_inventario,
          equipo.nro_serie,
          equipo.nombre_equipo,
          equipo.marca,
          equipo.modelo,
          equipo.tipo_equipo,
          equipo.codigo_sala,
          equipo.sala,
          equipo.edificio,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(texto));

      const cumpleAsignacion =
        filtroAsignacion === "TODOS" ||
        equipo.estado_asignacion_actual === filtroAsignacion;

      const cumpleEstado =
        filtroEstado === "TODOS" || equipo.estado_activo === filtroEstado;

      const cumpleTipo =
        filtroTipo === "TODOS" ||
        Number(equipo.id_tipo_equipo) === Number(filtroTipo);

      const fechaCompra = equipo.fecha_compra
        ? String(equipo.fecha_compra).slice(0, 10)
        : "";
      const fechaGarantia = equipo.fecha_garantia_fin
        ? String(equipo.fecha_garantia_fin).slice(0, 10)
        : "";

      const cumpleFechaCompraDesde =
        !filtroFechaCompraDesde ||
        (fechaCompra && fechaCompra >= filtroFechaCompraDesde);

      const cumpleFechaCompraHasta =
        !filtroFechaCompraHasta ||
        (fechaCompra && fechaCompra <= filtroFechaCompraHasta);

      const cumpleGarantiaHasta =
        !filtroGarantiaHasta ||
        (fechaGarantia && fechaGarantia <= filtroGarantiaHasta);

      return (
        cumpleBusqueda &&
        cumpleAsignacion &&
        cumpleEstado &&
        cumpleTipo &&
        cumpleFechaCompraDesde &&
        cumpleFechaCompraHasta &&
        cumpleGarantiaHasta
      );
    });
  }, [
    equipos,
    busqueda,
    filtroAsignacion,
    filtroEstado,
    filtroTipo,
    filtroFechaCompraDesde,
    filtroFechaCompraHasta,
    filtroGarantiaHasta,
  ]);

  function limpiarFiltrosInventario() {
    setBusqueda("");
    setFiltroAsignacion("TODOS");
    setFiltroEstado("TODOS");
    setFiltroTipo("TODOS");
    setFiltroFechaCompraDesde("");
    setFiltroFechaCompraHasta("");
    setFiltroGarantiaHasta("");
    setListaEquiposExpandida(false);
    setEquiposExpandidos({});
  }

  const equiposVisibles = useMemo(() => {
    if (listaEquiposExpandida) {
      return equiposFiltrados;
    }

    return equiposFiltrados.slice(0, limiteEquiposContraidos);
  }, [equiposFiltrados, listaEquiposExpandida]);

  const equiposPorAsignar = useMemo(() => {
    return equipos
      .filter(
        (equipo) =>
          equipo.estado_asignacion_actual === "NO_ASIGNADO" &&
          equipo.estado_activo === "OPERATIVO" &&
          !equipo.eliminado_logico,
      )
      .sort((a, b) =>
        String(a.nombre_equipo || "").localeCompare(
          String(b.nombre_equipo || ""),
          "es",
        ),
      );
  }, [equipos]);

  function alternarEquipoExpandido(idEquipo) {
    setEquiposExpandidos((prev) => ({
      ...prev,
      [idEquipo]: !prev[idEquipo],
    }));
  }

  function formatearFechaEquipo(fecha) {
    if (!fecha) return "No registrada";
    return new Date(fecha).toLocaleDateString("es-CL");
  }

  function obtenerClaseEstadoEquipo(estado) {
    if (estado === "OPERATIVO") return "bg-success";
    if (estado === "CON_FALLA") return "bg-warning text-dark";
    if (estado === "FUERA_SERVICIO") return "bg-danger";
    if (estado === "BAJA") return "bg-secondary";
    return "bg-primary";
  }

  function actualizarCampoEquipo(campo, valor) {
    setFormEquipo((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === "tiene_factura" && !valor
        ? {
            numero_factura: "",
            observacion_factura: "",
          }
        : {}),
    }));
  }

  function limpiarFormularioEquipo() {
    setFormEquipo({
      id_tipo_equipo: "",
      nombre_equipo: "",
      codigo_inventario: "",
      nro_serie: "",
      marca: "",
      modelo: "",
      direccion_ip: "",
      mac_address: "",
      fecha_compra: "",
      fecha_garantia_fin: "",
      tiene_factura: false,
      numero_factura: "",
      observacion_factura: "",
      estado_activo: "OPERATIVO",
      observaciones: "",
    });
  }

  function validarFormularioEquipo() {
    if (!formEquipo.id_tipo_equipo) {
      return "Debe seleccionar el tipo de equipo.";
    }

    if (!formEquipo.nombre_equipo.trim()) {
      return "Debe ingresar el nombre del equipo.";
    }

    if (formEquipo.nombre_equipo.trim().length < 3) {
      return "El nombre del equipo debe tener al menos 3 caracteres.";
    }

    if (formEquipo.nombre_equipo.length > 100) {
      return "El nombre del equipo no puede superar los 100 caracteres.";
    }

    if (formEquipo.codigo_inventario.length > 50) {
      return "El codigo de inventario no puede superar los 50 caracteres.";
    }

    if (formEquipo.nro_serie.length > 100) {
      return "El numero de serie no puede superar los 100 caracteres.";
    }

    if (formEquipo.marca.length > 80) {
      return "La marca no puede superar los 80 caracteres.";
    }

    if (formEquipo.modelo.length > 80) {
      return "El modelo no puede superar los 80 caracteres.";
    }

    if (formEquipo.direccion_ip.length > 45) {
      return "La direccion IP no puede superar los 45 caracteres.";
    }

    if (
      formEquipo.mac_address &&
      !/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(
        formEquipo.mac_address.trim(),
      )
    ) {
      return "La direccion MAC debe usar formato XX:XX:XX:XX:XX:XX.";
    }

    if (formEquipo.observaciones.length > 500) {
      return "Las observaciones no pueden superar los 500 caracteres.";
    }

    if (formEquipo.tiene_factura && !formEquipo.numero_factura.trim()) {
      return "Debe ingresar el numero de factura del equipo.";
    }

    if (formEquipo.numero_factura.length > 100) {
      return "El numero de factura no puede superar los 100 caracteres.";
    }

    if (formEquipo.observacion_factura.length > 500) {
      return "La observacion de factura no puede superar los 500 caracteres.";
    }

    return null;
  }

  async function manejarRegistroEquipo(event) {
    event.preventDefault();

    const errorValidacion = validarFormularioEquipo();

    if (errorValidacion) {
      Swal.fire({
        icon: "warning",
        title: "Validacion requerida",
        text: errorValidacion,
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const confirmacion = await Swal.fire({
      title: "Registrar equipo",
      text: "El equipo quedara registrado en inventario como no asignado a sala.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, registrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setRegistrando(true);

      await registrarEquipo({
        id_tipo_equipo: Number(formEquipo.id_tipo_equipo),
        nombre_equipo: formEquipo.nombre_equipo.trim(),
        codigo_inventario: formEquipo.codigo_inventario.trim() || null,
        nro_serie: formEquipo.nro_serie.trim() || null,
        marca: formEquipo.marca.trim() || null,
        modelo: formEquipo.modelo.trim() || null,
        direccion_ip: formEquipo.direccion_ip.trim() || null,
        mac_address: formEquipo.mac_address.trim() || null,
        fecha_compra: formEquipo.fecha_compra || null,
        fecha_garantia_fin: formEquipo.fecha_garantia_fin || null,
        tiene_factura: formEquipo.tiene_factura,
        numero_factura: formEquipo.tiene_factura
          ? formEquipo.numero_factura.trim()
          : null,
        observacion_factura: formEquipo.tiene_factura
          ? formEquipo.observacion_factura.trim() || null
          : null,
        estado_activo: formEquipo.estado_activo,
        observaciones: formEquipo.observaciones.trim() || null,
      });

      Swal.fire({
        icon: "success",
        title: "Equipo registrado",
        text: "El equipo fue registrado correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      limpiarFormularioEquipo();
      const respuestaEquipos = await listarEquipos();
      setEquipos(respuestaEquipos.data || []);
      setFiltroAsignacion("NO_ASIGNADO");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al registrar equipo",
        text:
          error.response?.data?.message ||
          "No fue posible registrar el equipo.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setRegistrando(false);
    }
  }

  function verDetalleEquipo(equipo) {
    Swal.fire({
      title: equipo.nombre_equipo,
      width: 850,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#0D2B63",
      html: `
        <div style="text-align:left">
          <p><strong>Codigo inventario:</strong> ${
            equipo.codigo_inventario || "Sin codigo"
          }</p>
          <p><strong>Numero de serie:</strong> ${
            equipo.nro_serie || "Sin numero de serie"
          }</p>
          <p><strong>Tipo:</strong> ${equipo.tipo_equipo}</p>
          <p><strong>Marca / modelo:</strong> ${equipo.marca || "Sin marca"} / ${
            equipo.modelo || "Sin modelo"
          }</p>
          <p><strong>Estado:</strong> ${equipo.estado_activo}</p>
          <p><strong>IP:</strong> ${equipo.direccion_ip || "No registrada"}</p>
          <p><strong>MAC:</strong> ${equipo.mac_address || "No registrada"}</p>

          <hr />

          <p><strong>Factura registrada:</strong> ${
            equipo.tiene_factura ? "Si" : "No"
          }</p>
          <p><strong>Numero factura:</strong> ${
            equipo.numero_factura || "No registrada"
          }</p>
          <p>
            <strong>Observacion factura:</strong><br />
            ${
              equipo.observacion_factura ||
              "Sin observacion de factura registrada"
            }
          </p>

          <hr />

          <p><strong>Asignacion:</strong> ${
            equipo.estado_asignacion_actual === "ASIGNADO"
              ? "Asignado a sala"
              : "No asignado"
          }</p>
          <p><strong>Sala:</strong> ${
            equipo.codigo_sala
              ? `${equipo.codigo_sala} - ${equipo.sala}`
              : "Sin sala asignada"
          }</p>
          <p><strong>Edificio:</strong> ${equipo.edificio || "No aplica"}</p>
          <p><strong>Ubicacion en sala:</strong> ${
            equipo.ubicacion_en_sala || "Sin ubicacion registrada"
          }</p>

          <hr />

          <p>
            <strong>Observaciones:</strong><br />
            ${equipo.observaciones || "Sin observaciones registradas"}
          </p>
        </div>
      `,
    });
  }

  async function manejarEdicionEquipo(equipo) {
    const opcionesTipo = tiposEquipo
      .map(
        (tipo) => `
          <option value="${tipo.id_tipo_equipo}" ${
            Number(tipo.id_tipo_equipo) === Number(equipo.id_tipo_equipo)
              ? "selected"
              : ""
          }>
            ${tipo.nombre}
          </option>
        `,
      )
      .join("");

    const resultado = await Swal.fire({
      title: `Editar ${equipo.nombre_equipo}`,
      width: 950,
      html: `
        <div style="text-align:left">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Tipo de equipo</label>
              <select id="editTipoEquipo" class="form-select">
                ${opcionesTipo}
              </select>
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Nombre equipo</label>
              <input
                id="editNombreEquipo"
                class="form-control"
                maxlength="100"
                value="${equipo.nombre_equipo || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Codigo inventario</label>
              <input
                id="editCodigoInventario"
                class="form-control"
                maxlength="50"
                value="${equipo.codigo_inventario || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Numero de serie</label>
              <input
                id="editNroSerie"
                class="form-control"
                maxlength="100"
                value="${equipo.nro_serie || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Marca</label>
              <input
                id="editMarca"
                class="form-control"
                maxlength="80"
                value="${equipo.marca || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Modelo</label>
              <input
                id="editModelo"
                class="form-control"
                maxlength="80"
                value="${equipo.modelo || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Estado</label>
              <select id="editEstadoActivo" class="form-select">
                <option value="OPERATIVO" ${
                  equipo.estado_activo === "OPERATIVO" ? "selected" : ""
                }>OPERATIVO</option>
                <option value="CON_FALLA" ${
                  equipo.estado_activo === "CON_FALLA" ? "selected" : ""
                }>CON FALLA</option>
                <option value="FUERA_SERVICIO" ${
                  equipo.estado_activo === "FUERA_SERVICIO" ? "selected" : ""
                }>FUERA DE SERVICIO</option>
                <option value="BAJA" ${
                  equipo.estado_activo === "BAJA" ? "selected" : ""
                }>BAJA</option>
              </select>
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Direccion IP</label>
              <input
                id="editDireccionIp"
                class="form-control"
                maxlength="45"
                value="${equipo.direccion_ip || ""}"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label fw-semibold">Direccion MAC</label>
              <input
                id="editMacAddress"
                class="form-control"
                maxlength="17"
                value="${equipo.mac_address || ""}"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Fecha compra</label>
              <input
                id="editFechaCompra"
                type="date"
                class="form-control"
                value="${equipo.fecha_compra ? String(equipo.fecha_compra).slice(0, 10) : ""}"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Fin garantia</label>
              <input
                id="editFechaGarantiaFin"
                type="date"
                class="form-control"
                value="${equipo.fecha_garantia_fin ? String(equipo.fecha_garantia_fin).slice(0, 10) : ""}"
              />
            </div>

            <div class="col-12">
              <div class="form-check">
                <input
                  id="editTieneFactura"
                  class="form-check-input"
                  type="checkbox"
                  ${equipo.tiene_factura ? "checked" : ""}
                />
                <label class="form-check-label fw-semibold" for="editTieneFactura">
                  Registrar datos de factura
                </label>
              </div>
              <small class="text-muted">
                Active esta opcion solo cuando exista respaldo de factura para el equipo.
              </small>
            </div>

            <div id="editFacturaCampos" class="col-12 ${
              equipo.tiene_factura ? "" : "d-none"
            }">
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label fw-semibold">Numero factura</label>
                  <input
                    id="editNumeroFactura"
                    class="form-control"
                    maxlength="100"
                    value="${equipo.numero_factura || ""}"
                  />
                  <small class="text-muted">Maximo 100 caracteres.</small>
                </div>

                <div class="col-md-8">
                  <label class="form-label fw-semibold">Observacion factura</label>
                  <textarea
                    id="editObservacionFactura"
                    class="form-control"
                    rows="2"
                    maxlength="500"
                  >${equipo.observacion_factura || ""}</textarea>
                  <small class="text-muted">Maximo 500 caracteres.</small>
                </div>
              </div>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Observaciones</label>
              <textarea
                id="editObservaciones"
                class="form-control"
                rows="3"
                maxlength="500"
              >${equipo.observaciones || ""}</textarea>
            </div>

            <div class="col-12">
              <div
                id="editEquipoError"
                class="alert alert-warning py-2 px-3 mb-0 d-none"
                style="font-size:14px"
              ></div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
      didOpen: () => {
        const checkFactura = document.getElementById("editTieneFactura");
        const camposFactura = document.getElementById("editFacturaCampos");

        checkFactura.addEventListener("change", () => {
          camposFactura.classList.toggle("d-none", !checkFactura.checked);

          if (!checkFactura.checked) {
            document.getElementById("editNumeroFactura").value = "";
            document.getElementById("editObservacionFactura").value = "";
          }
        });
      },
      preConfirm: () => {
        const error = document.getElementById("editEquipoError");
        const tieneFactura =
          document.getElementById("editTieneFactura").checked;
        const data = {
          id_tipo_equipo: Number(
            document.getElementById("editTipoEquipo").value,
          ),
          nombre_equipo: document
            .getElementById("editNombreEquipo")
            .value.trim(),
          codigo_inventario:
            document.getElementById("editCodigoInventario").value.trim() ||
            null,
          nro_serie:
            document.getElementById("editNroSerie").value.trim() || null,
          marca: document.getElementById("editMarca").value.trim() || null,
          modelo: document.getElementById("editModelo").value.trim() || null,
          estado_activo: document.getElementById("editEstadoActivo").value,
          direccion_ip:
            document.getElementById("editDireccionIp").value.trim() || null,
          mac_address:
            document.getElementById("editMacAddress").value.trim() || null,
          fecha_compra:
            document.getElementById("editFechaCompra").value || null,
          fecha_garantia_fin:
            document.getElementById("editFechaGarantiaFin").value || null,
          tiene_factura: tieneFactura,
          numero_factura: tieneFactura
            ? document.getElementById("editNumeroFactura").value.trim() || null
            : null,
          observacion_factura: tieneFactura
            ? document.getElementById("editObservacionFactura").value.trim() ||
              null
            : null,
          observaciones:
            document.getElementById("editObservaciones").value.trim() || null,
        };

        error.classList.add("d-none");
        error.textContent = "";

        if (!data.id_tipo_equipo) {
          error.textContent = "Debe seleccionar el tipo de equipo.";
          error.classList.remove("d-none");
          return false;
        }

        if (!data.nombre_equipo || data.nombre_equipo.length < 3) {
          error.textContent =
            "Debe ingresar un nombre de equipo de al menos 3 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (
          data.mac_address &&
          !/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(data.mac_address)
        ) {
          error.textContent =
            "La direccion MAC debe usar formato XX:XX:XX:XX:XX:XX.";
          error.classList.remove("d-none");
          return false;
        }

        if (data.tiene_factura && !data.numero_factura) {
          error.textContent = "Debe ingresar el numero de factura del equipo.";
          error.classList.remove("d-none");
          return false;
        }

        if (data.numero_factura && data.numero_factura.length > 100) {
          error.textContent =
            "El numero de factura no puede superar los 100 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (
          data.observacion_factura &&
          data.observacion_factura.length > 500
        ) {
          error.textContent =
            "La observacion de factura no puede superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return data;
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await editarEquipo(equipo.id_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Equipo actualizado",
        text: "Los datos del equipo fueron actualizados correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaEquipos = await listarEquipos();
      setEquipos(respuestaEquipos.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar equipo",
        text:
          error.response?.data?.message ||
          "No fue posible actualizar el equipo.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  function formatearValorAuditoria(valor) {
    if (!valor) {
      return `
        <div style="color:#6c757d;font-size:13px">
          Sin datos registrados para esta etapa.
        </div>
      `;
    }

    try {
      const data = typeof valor === "string" ? JSON.parse(valor) : valor;

      return `
        <div style="
          display:grid;
          grid-template-columns:minmax(150px, 220px) 1fr;
          border:1px solid #e9ecef;
          border-radius:6px;
          overflow:hidden;
          font-size:13px;
        ">
          ${Object.entries(data)
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
                  ${formatearContenidoAuditoria(contenido)}
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    } catch {
      return String(valor);
    }
  }

  function formatearContenidoAuditoria(contenido) {
    if (contenido === null || contenido === undefined || contenido === "") {
      return `<span style="color:#6c757d">Sin dato</span>`;
    }

    if (contenido === true || contenido === 1) return "Si";
    if (contenido === false || contenido === 0) return "No";

    return contenido;
  }

  function formatearEtiquetaAuditoria(clave) {
    const etiquetas = {
      id_equipo: "Registro interno del equipo",
      codigo_inventario: "Código de inventario",
      nombre_equipo: "Nombre del equipo",
      estado_activo: "Estado",
      eliminado_logico: "Retirado lógicamente",
      tiene_factura: "Factura registrada",
      numero_factura: "Número de factura",
      observacion_factura: "Observación de factura",
      id_sala: "Registro interno de la sala",
      codigo_sala: "Código de sala",
      sala: "Sala",
      ubicacion_en_sala: "Ubicación en sala",
      estado_asignacion: "Estado de asignación",
      fecha_retiro: "Fecha de retiro",
      motivo_retiro: "Motivo de retiro",
    };

    return etiquetas[clave] || clave.replaceAll("_", " ");
  }

  function obtenerTituloAuditoria(item) {
    if (item.tabla_afectada === "sala_equipo") {
      return item.accion === "UPDATE" ? "Retiro de sala" : "Asignacion a sala";
    }

    if (item.accion === "INSERT") return "Registro inicial";
    if (item.accion === "UPDATE") return "Actualizacion de datos";
    if (item.accion === "DELETE_LOGICO") return "Deshabilitacion";

    return item.accion;
  }

  function obtenerDescripcionAuditoria(item) {
    if (item.tabla_afectada === "sala_equipo") {
      if (item.accion === "UPDATE") {
        return "El equipo fue retirado de la sala y quedo disponible para una nueva asignacion.";
      }

      return "El equipo fue asignado a una sala para su uso operativo.";
    }

    if (item.accion === "INSERT") {
      return "El equipo fue incorporado al inventario tecnologico del sistema.";
    }

    if (item.accion === "UPDATE") {
      return "Se actualizaron antecedentes del equipo en el inventario.";
    }

    return item.descripcion || "Movimiento registrado en auditoria.";
  }

  function obtenerOrigenAuditoria(origen) {
    if (!origen) return "No registrado";
    if (origen.includes("Trigger")) return "Registro automatico de base de datos";
    if (origen.includes("API")) return "Operacion realizada desde el sistema";
    return origen;
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function verHistorialEquipo(equipo) {
    try {
      const respuesta = await obtenerHistorialEquipo(equipo.id_equipo);
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
                        ${obtenerTituloAuditoria(item)}
                      </span>
                    </p>

                    <p style="margin:4px 0">
                      ${obtenerDescripcionAuditoria(item)}
                    </p>

                    <small style="color:#6c757d">
                      Usuario: ${item.usuario || "No registrado"}<br/>
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
              Este equipo no tiene movimientos registrados en auditoria.
            </p>
          `;

      Swal.fire({
        title: `Historial ${equipo.codigo_inventario || equipo.nombre_equipo}`,
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
          "No fue posible cargar el historial del equipo.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  function formatearFechaProceso(fecha) {
    return fecha ? new Date(fecha).toLocaleString("es-CL") : "Pendiente";
  }

  function crearBloqueProceso(titulo, descripcion, meta, color = "#0D2B63") {
    return `
      <div style="
        border-left:4px solid ${color};
        padding:10px 12px;
        margin-bottom:12px;
        background:#f8f9fa;
        border-radius:6px;
      ">
        <p style="margin:0 0 4px 0;font-weight:bold;color:${color}">
          ${titulo}
        </p>
        <p style="margin:0 0 6px 0">
          ${descripcion}
        </p>
        <small style="color:#6c757d">
          ${meta}
        </small>
      </div>
    `;
  }

  async function verHistorialBaja(baja) {
    try {
      const respuesta = await obtenerHistorialBajaEquipo(baja.id_baja_equipo);
      const detalle = respuesta.data?.baja;
      const auditoria = respuesta.data?.auditoria || [];

      if (!detalle) {
        Swal.fire({
          icon: "info",
          title: "Historial no disponible",
          text: "No se encontraron antecedentes para esta solicitud de baja.",
          confirmButtonColor: "#0D2B63",
        });
        return;
      }

      const bloquesProceso = [
        crearBloqueProceso(
          "Solicitud registrada",
          "Se inicio el proceso administrativo para evaluar la baja del equipo.",
          `
            Solicitante: ${detalle.usuario_solicita || "No registrado"}<br/>
            Fecha: ${formatearFechaProceso(detalle.fecha_solicitud)}<br/>
            Motivo: ${detalle.motivo_baja || "No registrado"}
          `,
          "#FFC107",
        ),
      ];

      if (detalle.estado_baja === "APROBADA" || detalle.fecha_aprobacion) {
        bloquesProceso.push(
          crearBloqueProceso(
            "Solicitud aprobada",
            "La solicitud fue autorizada para su ejecucion posterior.",
            `
              Autoriza: ${detalle.usuario_aprueba || "No registrado"}<br/>
              Fecha: ${formatearFechaProceso(detalle.fecha_aprobacion)}
            `,
            "#0D6EFD",
          ),
        );
      }

      if (detalle.estado_baja === "RECHAZADA") {
        bloquesProceso.push(
          crearBloqueProceso(
            "Solicitud rechazada",
            "La solicitud fue revisada y no fue autorizada para ejecucion.",
            `
              Revisor: ${detalle.usuario_aprueba || "No registrado"}<br/>
              Fecha: ${formatearFechaProceso(detalle.fecha_actualizacion)}
            `,
            "#DC3545",
          ),
        );
      }

      if (detalle.estado_baja === "EJECUTADA" || detalle.fecha_ejecucion) {
        bloquesProceso.push(
          crearBloqueProceso(
            "Baja ejecutada",
            "El equipo fue retirado del inventario activo y quedo respaldado en el historial.",
            `
              Ejecuta: ${detalle.usuario_ejecuta || "No registrado"}<br/>
              Fecha: ${formatearFechaProceso(detalle.fecha_ejecucion)}
            `,
            "#198754",
          ),
        );
      }

      const contenidoAuditoria =
        auditoria.length > 0
          ? auditoria
              .map(
                (item) => `
                  <div style="
                    padding:10px 12px;
                    margin-bottom:10px;
                    background:#ffffff;
                    border:1px solid #dee2e6;
                    border-radius:6px;
                  ">
                    <p style="margin:0 0 4px 0;font-weight:bold">
                      ${item.descripcion || "Movimiento de baja registrado"}
                    </p>
                    <small style="color:#6c757d">
                      Usuario: ${item.usuario || "No registrado"}<br/>
                      Fecha: ${formatearFechaProceso(item.fecha_evento)}<br/>
                      Origen: ${obtenerOrigenAuditoria(item.user_agent)}
                    </small>

                    <details style="margin-top:8px">
                      <summary style="cursor:pointer;font-weight:bold">
                        Ver detalle tecnico
                      </summary>
                      <div style="
                        margin-top:8px;
                        padding:8px;
                        background:#f8f9fa;
                        border-radius:6px;
                        font-size:13px;
                      ">
                        <p style="margin:0 0 6px 0">
                          <strong>Datos anteriores</strong><br/>
                          ${formatearValorAuditoria(item.valor_anterior)}
                        </p>
                        <p style="margin:0">
                          <strong>Datos registrados</strong><br/>
                          ${formatearValorAuditoria(item.valor_nuevo)}
                        </p>
                      </div>
                    </details>
                  </div>
                `,
              )
              .join("")
          : `<p style="color:#6c757d">No existen eventos de auditoria asociados.</p>`;

      Swal.fire({
        title: `Historial de baja`,
        width: 900,
        html: `
          <div style="text-align:left">
            <p style="margin-bottom:16px">
              Equipo: <strong>${detalle.nombre_equipo}</strong><br/>
              Codigo: ${detalle.codigo_inventario || "Sin codigo"}<br/>
              Estado actual del proceso: <strong>${detalle.estado_baja}</strong>
            </p>

            ${bloquesProceso.join("")}

            ${
              detalle.observacion_tecnica
                ? `<div class="alert alert-light border">
                    <strong>Observaciones registradas</strong><br/>
                    ${detalle.observacion_tecnica.replaceAll("\n", "<br/>")}
                  </div>`
                : ""
            }

            <details>
              <summary style="cursor:pointer;font-weight:bold">
                Ver auditoria del proceso
              </summary>
              <div style="margin-top:10px">
                ${contenidoAuditoria}
              </div>
            </details>
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
          "No fue posible cargar el historial de la baja.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarAsignacionSala(equipo) {
    if (equipo.estado_asignacion_actual === "ASIGNADO") {
      Swal.fire({
        icon: "info",
        title: "Equipo asignado",
        text: "Este equipo ya tiene una asignacion activa a sala.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    if (equipo.estado_activo !== "OPERATIVO") {
      Swal.fire({
        icon: "warning",
        title: "Equipo no disponible para asignacion",
        text:
          "Solo los equipos en estado OPERATIVO pueden ser asignados a una sala. Si el equipo fue reparado, actualice su estado antes de asignarlo.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const opcionesEdificios = edificios
      .map(
        (edificio) => `
          <option value="${edificio.id_edificio}">
            ${escaparHtml(edificio.nombre)}
          </option>
        `,
      )
      .join("");

    const opcionesSalas = salas
      .map(
        (sala) => `
          <option
            value="${sala.id_sala}"
            data-edificio="${sala.id_edificio}"
          >
            ${escaparHtml(sala.codigo)} - ${escaparHtml(sala.nombre)}
          </option>
        `,
      )
      .join("");

    const ubicacionesSugeridas = Array.from(
      new Set(
        [
          "Mesa docente",
          "Mesa estudiante",
          "Rack principal",
          "Muro principal",
          "Cielo",
          "Bodega",
          ...equipos.map((item) => item.ubicacion_en_sala).filter(Boolean),
        ].map((ubicacion) => String(ubicacion).trim()).filter(Boolean),
      ),
    )
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((ubicacion) => `<option value="${escaparHtml(ubicacion)}"></option>`)
      .join("");

    const fechaHoy = new Date().toISOString().slice(0, 10);

    const resultado = await Swal.fire({
      title: `Asignar ${equipo.nombre_equipo}`,
      width: 850,
      html: `
        <div style="text-align:left">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Edificio</label>
              <select id="asignarEdificio" class="form-select">
                <option value="">Seleccione edificio</option>
                ${opcionesEdificios}
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Sala</label>
              <select id="asignarSala" class="form-select" disabled>
                <option value="">Seleccione sala</option>
                ${opcionesSalas}
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Fecha instalacion</label>
              <input
                id="asignarFechaInstalacion"
                type="date"
                class="form-control"
                value="${fechaHoy}"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Ubicacion en sala</label>
              <input
                id="asignarUbicacion"
                class="form-control"
                list="ubicacionesSalaSugeridas"
                maxlength="150"
                placeholder="Ej: Mesa docente, cielo, rack, muro norte"
              />
              <datalist id="ubicacionesSalaSugeridas">
                ${ubicacionesSugeridas}
              </datalist>
              <small class="text-muted">
                Seleccione una ubicacion usada anteriormente o ingrese una nueva.
              </small>
            </div>

            <div class="col-12">
              <label style="display:flex; gap:8px; align-items:center">
                <input type="checkbox" id="asignarPrincipal" />
                Marcar como equipo principal de la sala
              </label>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Observaciones</label>
              <textarea
                id="asignarObservaciones"
                class="form-control"
                rows="3"
                maxlength="500"
                placeholder="Antecedentes de instalacion o motivo de asignacion."
              ></textarea>
            </div>

            <div class="col-12">
              <div
                id="asignarEquipoError"
                class="alert alert-warning py-2 px-3 mb-0 d-none"
                style="font-size:14px"
              ></div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Asignar equipo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
      didOpen: () => {
        const selectEdificio = document.getElementById("asignarEdificio");
        const selectSala = document.getElementById("asignarSala");

        const actualizarSalas = () => {
          const idEdificio = selectEdificio.value;

          Array.from(selectSala.options).forEach((option) => {
            if (!option.value) {
              option.hidden = false;
              return;
            }

            option.hidden = option.dataset.edificio !== idEdificio;
          });

          selectSala.value = "";
          selectSala.disabled = !idEdificio;
        };

        selectEdificio.addEventListener("change", actualizarSalas);
        actualizarSalas();
      },
      preConfirm: () => {
        const error = document.getElementById("asignarEquipoError");
        const idSala = document.getElementById("asignarSala").value;
        const fechaInstalacion = document.getElementById(
          "asignarFechaInstalacion",
        ).value;
        const ubicacion = document
          .getElementById("asignarUbicacion")
          .value.trim();
        const observaciones = document
          .getElementById("asignarObservaciones")
          .value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (!idSala) {
          error.textContent = "Debe seleccionar una sala.";
          error.classList.remove("d-none");
          return false;
        }

        if (!fechaInstalacion) {
          error.textContent = "Debe indicar la fecha de instalacion.";
          error.classList.remove("d-none");
          return false;
        }

        if (ubicacion.length > 150) {
          error.textContent =
            "La ubicacion en sala no puede superar los 150 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (observaciones.length > 500) {
          error.textContent =
            "Las observaciones no pueden superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          id_sala: Number(idSala),
          fecha_instalacion: fechaInstalacion,
          ubicacion_en_sala: ubicacion || null,
          es_principal: document.getElementById("asignarPrincipal").checked,
          observaciones: observaciones || null,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await asignarEquipoSala(equipo.id_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Equipo asignado",
        text: "El equipo fue asignado a sala correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaEquipos = await listarEquipos();
      setEquipos(respuestaEquipos.data || []);

      if (mostrarInventario) {
        setFiltroAsignacion("ASIGNADO");
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al asignar equipo",
        text:
          error.response?.data?.message ||
          "No fue posible asignar el equipo a sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarRetiroSala(equipo) {
    if (equipo.estado_asignacion_actual !== "ASIGNADO") {
      Swal.fire({
        icon: "info",
        title: "Equipo no asignado",
        text: "Este equipo no tiene una asignacion activa a sala.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const fechaHoy = new Date().toISOString().slice(0, 10);

    const resultado = await Swal.fire({
      title: `Retirar ${equipo.nombre_equipo}`,
      width: 760,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            El equipo dejara de estar asociado a la sala ${
              equipo.codigo_sala || ""
            } ${equipo.sala ? `- ${equipo.sala}` : ""} y volvera a quedar
            disponible como no asignado.
          </p>

          <div class="alert alert-info py-2 px-3">
            <strong>Ubicacion actual:</strong>
            ${equipo.ubicacion_en_sala || "No registrada"}
          </div>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Fecha retiro</label>
              <input
                id="retirarFecha"
                type="date"
                class="form-control"
                value="${fechaHoy}"
              />
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Motivo de retiro</label>
              <textarea
                id="retirarMotivo"
                class="form-control"
                rows="3"
                maxlength="500"
                placeholder="Ej: recambio, falla, traslado, mantencion o retiro preventivo."
              ></textarea>
              <small class="text-muted d-block mt-1">
                Debe ingresar al menos 5 caracteres. Maximo 500.
              </small>
            </div>

            <div class="col-12">
              <div
                id="retirarEquipoError"
                class="alert alert-warning py-2 px-3 mb-0 d-none"
                style="font-size:14px"
              ></div>
            </div>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Retirar equipo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#DC3545",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const error = document.getElementById("retirarEquipoError");
        const fechaRetiro = document.getElementById("retirarFecha").value;
        const motivo = document.getElementById("retirarMotivo").value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (!fechaRetiro) {
          error.textContent = "Debe indicar la fecha de retiro.";
          error.classList.remove("d-none");
          return false;
        }

        if (motivo.length < 5) {
          error.textContent =
            "Debe ingresar un motivo de retiro de al menos 5 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (motivo.length > 500) {
          error.textContent =
            "El motivo de retiro no puede superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          fecha_retiro: fechaRetiro,
          motivo_retiro: motivo,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await retirarEquipoSala(equipo.id_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Equipo retirado",
        text: "El equipo fue retirado de la sala correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaEquipos = await listarEquipos();
      setEquipos(respuestaEquipos.data || []);
      setFiltroAsignacion("NO_ASIGNADO");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al retirar equipo",
        text:
          error.response?.data?.message ||
          "No fue posible retirar el equipo de la sala.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarSolicitudBaja(equipo) {
    if (equipo.estado_activo === "BAJA") {
      Swal.fire({
        icon: "info",
        title: "Equipo dado de baja",
        text: "Este equipo ya se encuentra dado de baja.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    if (tieneBajaPendiente(equipo)) {
      Swal.fire({
        icon: "info",
        title: "Solicitud pendiente",
        text: "Este equipo ya tiene una solicitud de baja pendiente.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const resultado = await Swal.fire({
      title: `Solicitar baja de ${equipo.nombre_equipo}`,
      width: 820,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            Se registrara una solicitud formal para evaluar la baja del equipo.
            Esta accion no retira ni elimina el equipo del inventario.
          </p>

          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Motivo de baja</label>
              <textarea
                id="bajaMotivo"
                class="form-control"
                rows="3"
                maxlength="500"
                placeholder="Ej: falla no reparable, obsolescencia, reemplazo tecnologico o dano fisico."
              ></textarea>
              <small class="text-muted d-block mt-1">
                Debe ingresar al menos 5 caracteres. Maximo 500.
              </small>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Observacion tecnica</label>
              <textarea
                id="bajaObservacion"
                class="form-control"
                rows="3"
                maxlength="1000"
                placeholder="Detalle tecnico opcional para respaldar la solicitud."
              ></textarea>
              <small class="text-muted d-block mt-1">
                Campo opcional. Maximo 1000 caracteres.
              </small>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">Documento respaldo</label>
              <input
                id="bajaDocumento"
                class="form-control"
                maxlength="500"
                placeholder="Referencia, acta, ticket o documento asociado"
              />
              <small class="text-muted d-block mt-1">
                Campo opcional. Maximo 500 caracteres.
              </small>
            </div>

            <div class="col-12">
              <div
                id="bajaEquipoError"
                class="alert alert-warning py-2 px-3 mb-0 d-none"
                style="font-size:14px"
              ></div>
            </div>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Solicitar baja",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#DC3545",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const error = document.getElementById("bajaEquipoError");
        const motivo = document.getElementById("bajaMotivo").value.trim();
        const observacion = document
          .getElementById("bajaObservacion")
          .value.trim();
        const documento = document.getElementById("bajaDocumento").value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (motivo.length < 5) {
          error.textContent =
            "Debe ingresar un motivo de baja de al menos 5 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (motivo.length > 500) {
          error.textContent =
            "El motivo de baja no puede superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (observacion.length > 1000) {
          error.textContent =
            "La observacion tecnica no puede superar los 1000 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (documento.length > 500) {
          error.textContent =
            "El documento de respaldo no puede superar los 500 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          motivo_baja: motivo,
          observacion_tecnica: observacion || null,
          documento_respaldo: documento || null,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await solicitarBajaEquipo(equipo.id_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Solicitud registrada",
        text: "La solicitud de baja fue registrada correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaBajas = await listarBajasEquipo();
      setBajasEquipo(respuestaBajas.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al solicitar baja",
        text:
          error.response?.data?.message ||
          "No fue posible registrar la solicitud de baja.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarDecisionBaja(baja, decision) {
    const esRechazo = decision === "RECHAZADA";

    const resultado = await Swal.fire({
      title:
        decision === "APROBADA"
          ? "Aprobar solicitud de baja"
          : "Rechazar solicitud de baja",
      width: 760,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            Equipo: <strong>${baja.nombre_equipo}</strong><br/>
            Codigo: ${baja.codigo_inventario || "Sin codigo"}
          </p>

          <label class="form-label fw-semibold">
            ${esRechazo ? "Motivo de rechazo" : "Observacion de aprobacion"}
          </label>
          <textarea
            id="decisionBajaObservacion"
            class="form-control"
            rows="3"
            maxlength="1000"
            placeholder="${
              esRechazo
                ? "Indique por que se rechaza la solicitud."
                : "Observacion opcional para respaldar la aprobacion."
            }"
          ></textarea>
          <small class="text-muted d-block mt-1">
            ${
              esRechazo
                ? "Debe ingresar al menos 5 caracteres. Maximo 1000."
                : "Campo opcional. Maximo 1000 caracteres."
            }
          </small>

          <div
            id="decisionBajaError"
            class="alert alert-warning py-2 px-3 mt-3 mb-0 d-none"
            style="font-size:14px"
          ></div>
        </div>
      `,
      icon: esRechazo ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: esRechazo ? "Rechazar" : "Aprobar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: esRechazo ? "#DC3545" : "#0D2B63",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const error = document.getElementById("decisionBajaError");
        const observacion = document
          .getElementById("decisionBajaObservacion")
          .value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (esRechazo && observacion.length < 5) {
          error.textContent =
            "Debe ingresar un motivo de rechazo de al menos 5 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        if (observacion.length > 1000) {
          error.textContent =
            "La observacion no puede superar los 1000 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          decision,
          observacion_decision: observacion || null,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await decidirBajaEquipo(baja.id_baja_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title:
          decision === "APROBADA"
            ? "Solicitud aprobada"
            : "Solicitud rechazada",
        text:
          decision === "APROBADA"
            ? "La solicitud quedo aprobada para su ejecucion posterior."
            : "La solicitud fue rechazada correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaBajas = await listarBajasEquipo();
      setBajasEquipo(respuestaBajas.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al resolver solicitud",
        text:
          error.response?.data?.message ||
          "No fue posible resolver la solicitud de baja.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarEjecucionBaja(baja) {
    const resultado = await Swal.fire({
      title: "Ejecutar baja de equipo",
      width: 780,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:16px">
            Equipo: <strong>${baja.nombre_equipo}</strong><br/>
            Codigo: ${baja.codigo_inventario || "Sin codigo"}
          </p>

          <div class="alert alert-warning">
            Al ejecutar la baja, el equipo dejara de aparecer en el inventario
            activo y cualquier asignacion vigente sera retirada.
          </div>

          <label class="form-label fw-semibold">Observacion de ejecucion</label>
          <textarea
            id="ejecutarBajaObservacion"
            class="form-control"
            rows="3"
            maxlength="1000"
            placeholder="Observacion opcional para respaldar la ejecucion de baja."
          ></textarea>
          <small class="text-muted d-block mt-1">
            Campo opcional. Maximo 1000 caracteres.
          </small>

          <div
            id="ejecutarBajaError"
            class="alert alert-warning py-2 px-3 mt-3 mb-0 d-none"
            style="font-size:14px"
          ></div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ejecutar baja",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#DC3545",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const error = document.getElementById("ejecutarBajaError");
        const observacion = document
          .getElementById("ejecutarBajaObservacion")
          .value.trim();

        error.classList.add("d-none");
        error.textContent = "";

        if (observacion.length > 1000) {
          error.textContent =
            "La observacion no puede superar los 1000 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return {
          observacion_ejecucion: observacion || null,
        };
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      await ejecutarBajaEquipo(baja.id_baja_equipo, resultado.value);

      Swal.fire({
        icon: "success",
        title: "Baja ejecutada",
        text:
          "La baja fue ejecutada correctamente. El equipo fue retirado del inventario activo y el proceso quedo respaldado en auditoria.",
        confirmButtonColor: "#0D2B63",
      });

      const respuestaEquipos = await listarEquipos();
      const respuestaBajas = await listarBajasEquipo();

      setEquipos(respuestaEquipos.data || []);
      setBajasEquipo(respuestaBajas.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al ejecutar baja",
        text:
          error.response?.data?.message ||
          "No fue posible ejecutar la baja del equipo.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h2 className="fw-bold mb-1">Equipos</h2>
        <p className="text-muted mb-0">
          Inventario tecnologico y estado de asignacion a salas.
        </p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-primary" title={resumen.detalleTotal} aria-label="Detalle de total de equipos">
            <div className="card-body">
              <h6 className="text-muted">Total equipos</h6>
              <h2 className="fw-bold">{resumen.total}</h2>
              <small>Inventario activo logicamente</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-success" title={resumen.detalleAsignados} aria-label="Detalle de equipos asignados">
            <div className="card-body">
              <h6 className="text-muted">Asignados</h6>
              <h2 className="fw-bold">{resumen.asignados}</h2>
              <small>Equipos con sala activa</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-secondary" title={resumen.detalleNoAsignados} aria-label="Detalle de equipos no asignados">
            <div className="card-body">
              <h6 className="text-muted">No asignados</h6>
              <h2 className="fw-bold">{resumen.noAsignados}</h2>
              <small>Disponibles para asignacion</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-warning" title={resumen.detalleConFalla} aria-label="Detalle de equipos con falla">
            <div className="card-body">
              <h6 className="text-muted">Con falla</h6>
              <h2 className="fw-bold">{resumen.conFalla}</h2>
              <small>Requieren seguimiento tecnico</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-dark" title={resumen.detalleDadosBaja} aria-label="Detalle de equipos dados de baja">
            <div className="card-body">
              <h6 className="text-muted">Dados de baja</h6>
              <h2 className="fw-bold">{resumen.dadosBaja}</h2>
              <small>Retirados del inventario activo</small>
            </div>
          </div>
        </div>
      </div>

      {puedeGestionarEquipo && mostrarRegistro && (
      <form id="registro" onSubmit={manejarRegistroEquipo}>
        <div className="card sgtsl-card mb-4">
          <div className="card-header bg-white fw-bold">
            Registro de nuevo equipo
          </div>

          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <label className="form-label fw-semibold mb-0">
                    Tipo de equipo <span className="sgtsl-required">*</span>
                  </label>
                  {puedeGestionarCatalogos && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={manejarRegistroTipoEquipo}
                      title="Agregar tipo de equipo"
                    >
                      + Tipo
                    </button>
                  )}
                </div>
                <select
                  className="form-select mt-1"
                  value={formEquipo.id_tipo_equipo}
                  onChange={(e) =>
                    actualizarCampoEquipo("id_tipo_equipo", e.target.value)
                  }
                >
                  <option value="">Seleccione tipo</option>
                  {tiposEquipo.map((tipo) => (
                    <option
                      key={tipo.id_tipo_equipo}
                      value={tipo.id_tipo_equipo}
                    >
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Nombre equipo <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="100"
                  value={formEquipo.nombre_equipo}
                  onChange={(e) =>
                    actualizarCampoEquipo("nombre_equipo", e.target.value)
                  }
                  placeholder="Ej: Computador de recambio"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Codigo inventario
                </label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="50"
                  value={formEquipo.codigo_inventario}
                  onChange={(e) =>
                    actualizarCampoEquipo("codigo_inventario", e.target.value)
                  }
                  placeholder="Ej: BOD-PC-003"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Numero de serie
                </label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="100"
                  value={formEquipo.nro_serie}
                  onChange={(e) =>
                    actualizarCampoEquipo("nro_serie", e.target.value)
                  }
                  placeholder="Serie del fabricante"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Marca</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="80"
                  value={formEquipo.marca}
                  onChange={(e) =>
                    actualizarCampoEquipo("marca", e.target.value)
                  }
                  placeholder="Ej: Dell"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Modelo</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="80"
                  value={formEquipo.modelo}
                  onChange={(e) =>
                    actualizarCampoEquipo("modelo", e.target.value)
                  }
                  placeholder="Ej: OptiPlex"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Estado</label>
                <select
                  className="form-select"
                  value={formEquipo.estado_activo}
                  onChange={(e) =>
                    actualizarCampoEquipo("estado_activo", e.target.value)
                  }
                >
                  <option value="OPERATIVO">OPERATIVO</option>
                  <option value="CON_FALLA">CON FALLA</option>
                  <option value="FUERA_SERVICIO">FUERA DE SERVICIO</option>
                  <option value="BAJA">BAJA</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Direccion IP</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="45"
                  value={formEquipo.direccion_ip}
                  onChange={(e) =>
                    actualizarCampoEquipo("direccion_ip", e.target.value)
                  }
                  placeholder="Ej: 192.168.1.10"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Direccion MAC</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="17"
                  value={formEquipo.mac_address}
                  onChange={(e) =>
                    actualizarCampoEquipo("mac_address", e.target.value)
                  }
                  placeholder="XX:XX:XX:XX:XX:XX"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Fecha compra</label>
                <input
                  type="date"
                  className="form-control"
                  value={formEquipo.fecha_compra}
                  onChange={(e) =>
                    actualizarCampoEquipo("fecha_compra", e.target.value)
                  }
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Fin garantia
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formEquipo.fecha_garantia_fin}
                  onChange={(e) =>
                    actualizarCampoEquipo("fecha_garantia_fin", e.target.value)
                  }
                />
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    id="tieneFacturaEquipo"
                    type="checkbox"
                    className="form-check-input"
                    checked={formEquipo.tiene_factura}
                    onChange={(e) =>
                      actualizarCampoEquipo("tiene_factura", e.target.checked)
                    }
                  />
                  <label
                    className="form-check-label fw-semibold"
                    htmlFor="tieneFacturaEquipo"
                  >
                    Registrar datos de factura
                  </label>
                </div>
                <small className="text-muted">
                  Active esta opcion si el equipo cuenta con respaldo de factura.
                </small>
              </div>

              {formEquipo.tiene_factura && (
                <>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Numero factura <span className="sgtsl-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      maxLength="100"
                      value={formEquipo.numero_factura}
                      onChange={(e) =>
                        actualizarCampoEquipo("numero_factura", e.target.value)
                      }
                      placeholder="Ej: FAC-2026-001"
                    />
                    <div className="sgtsl-counter text-end mt-1">
                      {formEquipo.numero_factura.length} / 100 caracteres
                    </div>
                  </div>

                  <div className="col-md-8">
                    <label className="form-label fw-semibold">
                      Observacion factura
                    </label>
                    <textarea
                      className="form-control"
                      rows="2"
                      maxLength="500"
                      value={formEquipo.observacion_factura}
                      onChange={(e) =>
                        actualizarCampoEquipo(
                          "observacion_factura",
                          e.target.value,
                        )
                      }
                      placeholder="Ingrese antecedentes administrativos asociados a la factura."
                    ></textarea>
                    <div className="sgtsl-counter text-end mt-1">
                      {formEquipo.observacion_factura.length} / 500 caracteres
                    </div>
                  </div>
                </>
              )}

              <div className="col-12">
                <label className="form-label fw-semibold">Observaciones</label>
                <textarea
                  className="form-control"
                  rows="3"
                  maxLength="500"
                  value={formEquipo.observaciones}
                  onChange={(e) =>
                    actualizarCampoEquipo("observaciones", e.target.value)
                  }
                  placeholder="Ingrese antecedentes del equipo, origen, recambio o condicion tecnica."
                ></textarea>
                <div className="sgtsl-counter text-end mt-1">
                  {formEquipo.observaciones.length} / 500 caracteres
                </div>
              </div>

              <div className="col-12">
                <div className="alert alert-info mb-0">
                  El equipo se registrara en inventario como no asignado. La
                  asignacion a sala se gestionara en una etapa posterior.
                </div>
              </div>

              <div className="col-12 text-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registrando}
                >
                  <i className="bi bi-pc-display me-2"></i>
                  {registrando ? "Registrando equipo" : "Registrar equipo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
      )}

      {puedeGestionarEquipo && mostrarAsignacion && (
      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Equipos por asignar</strong>
            <small className="text-muted ms-2">
              {equiposPorAsignar.length} disponibles para sala
            </small>
          </div>
          <span className="badge bg-secondary">NO ASIGNADO</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Factura</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    Cargando equipos disponibles para asignacion...
                  </td>
                </tr>
              ) : equiposPorAsignar.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    No existen equipos pendientes de asignacion a sala.
                  </td>
                </tr>
              ) : (
                equiposPorAsignar.map((equipo) => (
                  <tr key={equipo.id_equipo}>
                    <td>
                      <strong>{equipo.nombre_equipo}</strong>
                      <br />
                      <small>{equipo.codigo_inventario || "Sin codigo"}</small>
                    </td>
                    <td>{equipo.tipo_equipo}</td>
                    <td>
                      <span
                        className={`badge ${obtenerClaseEstadoEquipo(
                          equipo.estado_activo,
                        )}`}
                      >
                        {equipo.estado_activo}
                      </span>
                    </td>
                    <td>
                      {equipo.tiene_factura ? (
                        <>
                          <span className="badge bg-success">Registrada</span>
                          <br />
                          <small>{equipo.numero_factura || "Sin numero"}</small>
                        </>
                      ) : (
                        <span className="text-muted">No registrada</span>
                      )}
                    </td>
                    <td>
                      {equipo.observaciones || (
                        <span className="text-muted">Sin observaciones</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Ver detalle"
                        onClick={() => verDetalleEquipo(equipo)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        title="Ver historial"
                        onClick={() => verHistorialEquipo(equipo)}
                      >
                        <i className="bi bi-clock-history"></i>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        title="Asignar a sala"
                        onClick={() => manejarAsignacionSala(equipo)}
                      >
                        <i className="bi bi-building-add"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {mostrarInventario && (
      <>
      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de inventario</strong>
            <small className="text-muted ms-2">
              {equiposFiltrados.length} de {equipos.length} equipos
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setFiltrosAbiertos((prev) => !prev)}
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
                placeholder="Codigo, serie, equipo, sala o edificio"
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Asignacion</label>
              <select
                className="form-select"
                value={filtroAsignacion}
                onChange={(e) => setFiltroAsignacion(e.target.value)}
              >
                <option value="TODOS">Todas</option>
                <option value="ASIGNADO">Asignados</option>
                <option value="NO_ASIGNADO">No asignados</option>
                <option value="BAJA">Dados de baja</option>
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label fw-semibold">Estado</label>
              <select
                className="form-select"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                {estadosDisponibles.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Tipo</label>
              <select
                className="form-select"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                {tiposEquipo.map((tipo) => (
                  <option key={tipo.id_tipo_equipo} value={tipo.id_tipo_equipo}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">
                Compra desde
              </label>
              <input
                type="date"
                className="form-control"
                value={filtroFechaCompraDesde}
                onChange={(e) => setFiltroFechaCompraDesde(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">
                Compra hasta
              </label>
              <input
                type="date"
                className="form-control"
                value={filtroFechaCompraHasta}
                onChange={(e) => setFiltroFechaCompraHasta(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">
                Garantia vence hasta
              </label>
              <input
                type="date"
                className="form-control"
                value={filtroGarantiaHasta}
                onChange={(e) => setFiltroGarantiaHasta(e.target.value)}
              />
            </div>

            <div className="col-md-3 d-flex align-items-end justify-content-md-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={limpiarFiltrosInventario}
              >
                <i className="bi bi-x-circle me-2"></i>
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      <div id="inventario" className="card sgtsl-card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Equipos registrados</strong>
            <small className="text-muted ms-2">
              Mostrando {equiposVisibles.length} de {equiposFiltrados.length}
            </small>
          </div>

          {equiposFiltrados.length > limiteEquiposContraidos && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() =>
                setListaEquiposExpandida((estadoActual) => !estadoActual)
              }
            >
              <i
                className={`bi ${
                  listaEquiposExpandida ? "bi-arrows-collapse" : "bi-arrows-expand"
                } me-1`}
              ></i>
              {listaEquiposExpandida ? "Contraer lista" : "Expandir lista"}
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Asignacion</th>
                <th>Sala</th>
                <th>Ubicacion</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    Cargando inventario de equipos...
                  </td>
                </tr>
              ) : equiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    No existen equipos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                equiposVisibles.map((equipo) => (
                  <Fragment key={equipo.id_equipo}>
                    <tr>
                      <td>
                        <div className="d-flex align-items-start gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            title={
                              equiposExpandidos[equipo.id_equipo]
                                ? "Contraer detalle"
                                : "Expandir detalle"
                            }
                            onClick={() =>
                              alternarEquipoExpandido(equipo.id_equipo)
                            }
                          >
                            <i
                              className={`bi ${
                                equiposExpandidos[equipo.id_equipo]
                                  ? "bi-chevron-up"
                                  : "bi-chevron-down"
                              }`}
                            ></i>
                          </button>

                          <div>
                            <strong>{equipo.nombre_equipo}</strong>
                            <br />
                            <small>
                              {equipo.codigo_inventario ||
                                "Sin codigo inventario"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{equipo.tipo_equipo}</td>

                      <td>
                        <span
                          className={`badge ${obtenerClaseEstadoEquipo(
                            equipo.estado_activo,
                          )}`}
                        >
                          {equipo.estado_activo}
                        </span>
                      </td>

                      <td>
                        {equipo.estado_asignacion_actual === "ASIGNADO" ? (
                          <span className="badge bg-success">ASIGNADO</span>
                        ) : equipo.estado_asignacion_actual === "BAJA" ? (
                          <span className="badge bg-dark">BAJA</span>
                        ) : (
                          <span className="badge bg-secondary">
                            NO ASIGNADO
                          </span>
                        )}
                      </td>

                      <td>
                        {equipo.codigo_sala ? (
                          <>
                            {equipo.codigo_sala}
                            <br />
                            <small>{equipo.sala}</small>
                          </>
                        ) : (
                          <span className="text-muted">Sin sala</span>
                        )}
                      </td>

                      <td>
                        {equipo.ubicacion_en_sala || (
                          <span className="text-muted">No registrada</span>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-1"
                          title="Ver detalle"
                          onClick={() => verDetalleEquipo(equipo)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary me-1"
                          title="Ver historial"
                          onClick={() => verHistorialEquipo(equipo)}
                        >
                          <i className="bi bi-clock-history"></i>
                        </button>

                        {puedeGestionarEquipo &&
                          equipo.estado_activo !== "BAJA" &&
                          !equipo.eliminado_logico && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              title="Editar equipo"
                              onClick={() => manejarEdicionEquipo(equipo)}
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          )}

                        {puedeGestionarEquipo &&
                          equipo.estado_asignacion_actual === "NO_ASIGNADO" &&
                          equipo.estado_activo !== "BAJA" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-info ms-1"
                              title="Asignar a sala"
                              onClick={() => manejarAsignacionSala(equipo)}
                            >
                              <i className="bi bi-building-add"></i>
                            </button>
                          )}

                        {puedeGestionarEquipo &&
                          equipo.estado_asignacion_actual === "ASIGNADO" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger ms-1"
                              title="Retirar de sala"
                              onClick={() => manejarRetiroSala(equipo)}
                            >
                              <i className="bi bi-box-arrow-left"></i>
                            </button>
                          )}

                        {puedeSolicitarBaja &&
                          equipo.estado_activo !== "BAJA" &&
                          !tieneBajaPendiente(equipo) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark ms-1"
                              title="Solicitar baja"
                              onClick={() => manejarSolicitudBaja(equipo)}
                            >
                              <i className="bi bi-file-earmark-minus"></i>
                            </button>
                          )}
                      </td>
                    </tr>

                    {equiposExpandidos[equipo.id_equipo] && (
                      <tr>
                        <td colSpan="7" className="bg-light">
                          <div className="row g-3 py-2">
                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Marca / modelo
                              </small>
                              <strong>
                                {equipo.marca || "Sin marca"} /{" "}
                                {equipo.modelo || "Sin modelo"}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Serie
                              </small>
                              <strong>
                                {equipo.nro_serie || "No registrada"}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Direccion IP
                              </small>
                              <strong>
                                {equipo.direccion_ip || "No registrada"}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Direccion MAC
                              </small>
                              <strong>
                                {equipo.mac_address || "No registrada"}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Fecha compra
                              </small>
                              <strong>
                                {formatearFechaEquipo(equipo.fecha_compra)}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Fin garantia
                              </small>
                              <strong>
                                {formatearFechaEquipo(
                                  equipo.fecha_garantia_fin,
                                )}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Instalacion en sala
                              </small>
                              <strong>
                                {formatearFechaEquipo(
                                  equipo.fecha_instalacion,
                                )}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Principal en sala
                              </small>
                              <strong>
                                {equipo.es_principal ? "Si" : "No"}
                              </strong>
                            </div>

                            <div className="col-md-3">
                              <small className="text-muted d-block">
                                Factura
                              </small>
                              <strong>
                                {equipo.tiene_factura
                                  ? equipo.numero_factura || "Registrada"
                                  : "No registrada"}
                              </strong>
                            </div>

                            <div className="col-md-9">
                              <small className="text-muted d-block">
                                Observacion factura
                              </small>
                              <span>
                                {equipo.observacion_factura ||
                                  "Sin observacion de factura registrada."}
                              </span>
                            </div>

                            <div className="col-12">
                              <small className="text-muted d-block">
                                Observaciones
                              </small>
                              <span>
                                {equipo.observaciones ||
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

      {puedeSolicitarBaja && mostrarBajas && (
      <div id="bajas" className="card sgtsl-card mt-4">
        <div className="card-header bg-white fw-bold">
          Solicitudes de baja
        </div>

        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="alert alert-warning mb-0">
                <strong>{resumenBajas.solicitadas}</strong> solicitadas
              </div>
            </div>

            <div className="col-md-4">
              <div className="alert alert-info mb-0">
                <strong>{resumenBajas.aprobadas}</strong> aprobadas
              </div>
            </div>

            <div className="col-md-4">
              <div className="alert alert-secondary mb-0">
                <strong>{resumenBajas.total}</strong> registros historicos
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Estado baja</th>
                <th>Solicita</th>
                <th>Fecha</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {bajasEquipo.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    No existen solicitudes de baja registradas.
                  </td>
                </tr>
              ) : (
                bajasEquipo.slice(0, 8).map((baja) => (
                  <tr key={baja.id_baja_equipo}>
                    <td>
                      <strong>{baja.nombre_equipo}</strong>
                      <br />
                      <small>{baja.codigo_inventario || "Sin codigo"}</small>
                    </td>
                    <td>{baja.tipo_equipo}</td>
                    <td>
                      <span
                        className={`badge ${
                          baja.estado_baja === "SOLICITADA"
                            ? "bg-warning text-dark"
                            : baja.estado_baja === "APROBADA"
                              ? "bg-info text-dark"
                              : baja.estado_baja === "EJECUTADA"
                                ? "bg-success"
                                : "bg-secondary"
                        }`}
                      >
                        {baja.estado_baja}
                      </span>
                    </td>
                    <td>{baja.usuario_solicita}</td>
                    <td>
                      {new Date(baja.fecha_solicitud).toLocaleString("es-CL")}
                    </td>
                    <td>{baja.motivo_baja}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        title="Ver historial de baja"
                        onClick={() => verHistorialBaja(baja)}
                      >
                        <i className="bi bi-clock-history"></i>
                      </button>

                      {puedeResolverBaja && baja.estado_baja === "SOLICITADA" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success me-1"
                            title="Aprobar solicitud"
                            onClick={() =>
                              manejarDecisionBaja(baja, "APROBADA")
                            }
                          >
                            <i className="bi bi-check-circle"></i>
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Rechazar solicitud"
                            onClick={() =>
                              manejarDecisionBaja(baja, "RECHAZADA")
                            }
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
                        </>
                      ) : puedeResolverBaja && baja.estado_baja === "APROBADA" ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark"
                          title="Ejecutar baja"
                          onClick={() => manejarEjecucionBaja(baja)}
                        >
                          <i className="bi bi-check2-square"></i>
                        </button>
                      ) : (
                        <span className="text-muted">Solo historial</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </MainLayout>
  );
}

export default EquiposPage;





