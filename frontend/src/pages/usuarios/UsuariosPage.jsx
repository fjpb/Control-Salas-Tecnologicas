// Pagina de administracion de usuarios SGTSL.
// Permite crear cuentas y gestionar roles sin eliminar datos historicos.

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import MainLayout from "../../layouts/MainLayout";
import {
  actualizarEstadoUsuario,
  actualizarRolesUsuario,
  listarRolesUsuarios,
  listarUsuarios,
  obtenerHistorialUsuario,
  registrarUsuario,
  resetearPasswordUsuario,
} from "../../services/usuariosService";

function limpiarRutChileno(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "")
    .slice(0, 9);
}

function calcularDigitoVerificador(cuerpoRut) {
  let suma = 0;
  let multiplicador = 2;

  for (let indice = cuerpoRut.length - 1; indice >= 0; indice -= 1) {
    suma += Number(cuerpoRut[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

function formatearRutChileno(valor) {
  const limpio = limpiarRutChileno(valor);

  if (limpio.length <= 1) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const digito = limpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return cuerpoFormateado + "-" + digito;
}

function evaluarRutChileno(valor) {
  const limpio = limpiarRutChileno(valor);

  if (!limpio) {
    return {
      estado: "vacio",
      mensaje: "Ingrese RUN chileno con digito verificador.",
      formateado: "",
    };
  }

  if (limpio.length < 8) {
    return {
      estado: "incompleto",
      mensaje: "RUN incompleto. Ingrese cuerpo y digito verificador.",
      formateado: formatearRutChileno(limpio),
    };
  }

  const cuerpo = limpio.slice(0, -1);
  const digito = limpio.slice(-1);

  if (!/^\d{7,8}$/.test(cuerpo) || digito !== calcularDigitoVerificador(cuerpo)) {
    return {
      estado: "invalido",
      mensaje: "RUN no valido. Revise el digito verificador.",
      formateado: formatearRutChileno(limpio),
    };
  }

  return {
    estado: "valido",
    mensaje: "RUN valido para registrar.",
    formateado: formatearRutChileno(limpio),
  };
}

function obtenerEstadoRutFormulario(rut, usuarios) {
  const evaluacion = evaluarRutChileno(rut);
  const rutLimpio = limpiarRutChileno(rut);

  if (evaluacion.estado === "valido") {
    const existe = usuarios.some(
      (usuario) => limpiarRutChileno(usuario.rut) === rutLimpio,
    );

    if (existe) {
      return {
        ...evaluacion,
        estado: "duplicado",
        mensaje: "Este RUN ya se encuentra registrado en el sistema.",
      };
    }
  }

  return evaluacion;
}

function UsuariosPage({ vista = "completa" }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    rut: "",
    nombres: "",
    apellidos: "",
    correo: "",
    telefono: "",
    password: "",
    roles: [],
  });

  const limiteUsuariosContraidos = 8;
  const usuarioSesion = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sgtsl_usuario")) || {};
    } catch {
      return {};
    }
  }, []);

  const rolUsuario = usuarioSesion?.rol || "";
  const esSuperAdministrador = rolUsuario === "SUPER_ADMINISTRADOR";
  const mostrarRegistro =
    esSuperAdministrador && (vista === "completa" || vista === "registro");
  const mostrarListado = vista === "completa" || vista === "listado";
  const estadoRutFormulario = useMemo(
    () => obtenerEstadoRutFormulario(formUsuario.rut, usuarios),
    [formUsuario.rut, usuarios],
  );

  const claseRutFormulario = formUsuario.rut
    ? estadoRutFormulario.estado === "valido"
      ? "form-control is-valid text-dark"
      : "form-control is-invalid text-danger"
    : "form-control";

  const claseAyudaRut =
    estadoRutFormulario.estado === "valido"
      ? "text-success"
      : formUsuario.rut
        ? "text-danger"
        : "text-muted";

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    setListaExpandida(false);
  }, [busqueda, filtroRol, filtroEstado]);

  async function cargarDatos() {
    try {
      setCargando(true);
      const [respuestaUsuarios, respuestaRoles] = await Promise.all([
        listarUsuarios(),
        listarRolesUsuarios(),
      ]);

      setUsuarios(respuestaUsuarios.data || []);
      setRoles(respuestaRoles.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cargar usuarios",
        text:
          error.response?.data?.message ||
          "No fue posible obtener usuarios y roles.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setCargando(false);
    }
  }

  const resumen = useMemo(() => {
    const activos = usuarios.filter((usuario) => usuario.activo).length;
    const inactivos = usuarios.filter((usuario) => !usuario.activo).length;
    const administradores = usuarios.filter((usuario) =>
      usuario.roles.some(
        (rol) =>
          rol.activo &&
          ["SUPER_ADMINISTRADOR", "ADMINISTRADOR"].includes(rol.nombre_rol),
      ),
    ).length;
    const operativos = usuarios.filter((usuario) =>
      usuario.roles.some(
        (rol) =>
          rol.activo &&
          ["TECNICO_SOPORTE", "ALUMNO_PRACTICA"].includes(rol.nombre_rol),
      ),
    ).length;

    return {
      total: usuarios.length,
      activos,
      inactivos,
      administradores,
      operativos,
    };
  }, [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const rolesActivos = usuario.roles
        .filter((rol) => rol.activo)
        .map((rol) => rol.nombre_rol);

      const cumpleBusqueda =
        !texto ||
        [
          usuario.rut,
          usuario.nombres,
          usuario.apellidos,
          usuario.nombre_completo,
          usuario.correo,
          usuario.telefono,
          rolesActivos.join(" "),
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(texto));

      const cumpleRol =
        filtroRol === "TODOS" || rolesActivos.includes(filtroRol);

      const cumpleEstado =
        filtroEstado === "TODOS" ||
        (filtroEstado === "ACTIVOS" && usuario.activo) ||
        (filtroEstado === "INACTIVOS" && !usuario.activo);

      return cumpleBusqueda && cumpleRol && cumpleEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const usuariosVisibles = useMemo(() => {
    if (listaExpandida) return usuariosFiltrados;
    return usuariosFiltrados.slice(0, limiteUsuariosContraidos);
  }, [usuariosFiltrados, listaExpandida]);

  function actualizarCampo(campo, valor) {
    setFormUsuario((estadoActual) => ({
      ...estadoActual,
      [campo]: valor,
    }));
  }

  function actualizarRutFormulario(valor) {
    actualizarCampo("rut", formatearRutChileno(valor));
  }

  function alternarRolFormulario(idRol) {
    setFormUsuario((estadoActual) => {
      const rolesActuales = estadoActual.roles.map(Number);
      const existe = rolesActuales.includes(Number(idRol));

      return {
        ...estadoActual,
        roles: existe
          ? rolesActuales.filter((rol) => rol !== Number(idRol))
          : [...rolesActuales, Number(idRol)],
      };
    });
  }

  function limpiarFormulario() {
    setFormUsuario({
      rut: "",
      nombres: "",
      apellidos: "",
      correo: "",
      telefono: "",
      password: "",
      roles: [],
    });
  }

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroRol("TODOS");
    setFiltroEstado("TODOS");
    setListaExpandida(false);
  }

  function validarFormulario() {
    if (estadoRutFormulario.estado !== "valido") {
      return estadoRutFormulario.mensaje;
    }

    if (formUsuario.nombres.trim().length < 2) {
      return "Debe ingresar los nombres del usuario.";
    }

    if (formUsuario.apellidos.trim().length < 2) {
      return "Debe ingresar los apellidos del usuario.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formUsuario.correo.trim())) {
      return "Debe ingresar un correo valido.";
    }

    if (formUsuario.telefono.trim().length > 30) {
      return "El telefono no puede superar los 30 caracteres.";
    }

    if (formUsuario.password.length < 8) {
      return "La contrasena debe tener al menos 8 caracteres.";
    }

    if (formUsuario.password.length > 72) {
      return "La contrasena no puede superar los 72 caracteres.";
    }

    if (formUsuario.roles.length === 0) {
      return "Debe asignar al menos un rol al usuario.";
    }

    return null;
  }

  async function manejarRegistroUsuario(event) {
    event.preventDefault();

    const mensajeValidacion = validarFormulario();

    if (mensajeValidacion) {
      Swal.fire({
        icon: "warning",
        title: "Revise los datos del usuario",
        text: mensajeValidacion,
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    try {
      setGuardando(true);

      const respuesta = await registrarUsuario({
        rut: estadoRutFormulario.formateado,
        nombres: formUsuario.nombres.trim(),
        apellidos: formUsuario.apellidos.trim(),
        correo: formUsuario.correo.trim(),
        telefono: formUsuario.telefono.trim() || null,
        password: formUsuario.password,
        roles: formUsuario.roles,
      });

      await Swal.fire({
        icon: "success",
        title: "Usuario registrado",
        text:
          respuesta.message ||
          "La cuenta fue creada correctamente y quedo disponible para el acceso al sistema.",
        confirmButtonColor: "#0D2B63",
      });

      limpiarFormulario();
      await cargarDatos();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al registrar usuario",
        text:
          error.response?.data?.message ||
          "No fue posible registrar el usuario.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setGuardando(false);
    }
  }

  function obtenerRolesActivos(usuario) {
    return usuario.roles.filter((rol) => rol.activo);
  }

  function formatearFecha(fecha) {
    return fecha ? new Date(fecha).toLocaleString("es-CL") : "No registrada";
  }

  function puedeGestionarRoles(usuario) {
    const esUsuarioSuper = obtenerRolesActivos(usuario).some(
      (rol) => rol.nombre_rol === "SUPER_ADMINISTRADOR",
    );

    if (esSuperAdministrador) return true;
    return !esUsuarioSuper;
  }

  function puedeResetearPassword(usuario) {
    return esSuperAdministrador || puedeGestionarRoles(usuario);
  }

  function obtenerRolesDisponiblesParaGestion() {
    if (esSuperAdministrador) return roles;
    return roles.filter((rol) => rol.nombre_rol !== "SUPER_ADMINISTRADOR");
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function intentarParseJson(valor) {
    if (!valor) return null;

    if (typeof valor === "object") {
      return valor;
    }

    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  }

  function formatearEtiquetaCampo(campo) {
    const etiquetas = {
      activo: "Activo",
      apellidos: "Apellidos",
      correo: "Correo",
      id_usuario: "ID usuario",
      nombres: "Nombres",
      roles: "Roles",
      rut: "RUN/RUT",
      telefono: "Telefono",
      usuario: "Usuario",
    };

    return (
      etiquetas[campo] ||
      campo
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letra) => letra.toUpperCase())
    );
  }

  function formatearValorHistorial(valor) {
    if (Array.isArray(valor)) {
      return valor
        .map(
          (item) =>
            `<span class="badge bg-secondary me-1 mb-1">${escaparHtml(item)}</span>`,
        )
        .join("");
    }

    if (valor === true || valor === 1) {
      return "Si";
    }

    if (valor === false || valor === 0) {
      return "No";
    }

    return escaparHtml(valor ?? "Sin dato");
  }

  function renderTablaJson(titulo, datos) {
    const objeto = intentarParseJson(datos);

    if (!objeto || Object.keys(objeto).length === 0) {
      return `
        <h5 style="margin-top:12px">${titulo}</h5>
        <p class="text-muted mb-0">Sin datos registrados para esta etapa.</p>
      `;
    }

    return `
      <h6 style="margin-top:10px;margin-bottom:6px;font-weight:700;color:#4b5563">${titulo}</h6>
      <div style="border:1px solid #dee2e6;border-radius:6px;overflow:hidden">
        <table class="table table-sm mb-0" style="font-size:13px;table-layout:fixed;width:100%">
          <tbody>
            ${Object.entries(objeto)
              .map(
                ([campo, valor]) => `
                  <tr>
                    <th style="width:30%;background:#f8f9fa;vertical-align:top;color:#4b5563">
                      ${escaparHtml(formatearEtiquetaCampo(campo))}
                    </th>
                    <td style="white-space:normal;word-break:break-word;vertical-align:top">
                      ${formatearValorHistorial(valor)}
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function obtenerDescripcionHistorial(evento) {
    if (evento.tabla_afectada === "usuario" && evento.accion === "INSERT") {
      return "Se creo una cuenta de usuario para acceso al sistema.";
    }

    if (evento.tabla_afectada === "usuario_rol") {
      return "Se actualizaron los perfiles de acceso asociados al usuario.";
    }

    return evento.descripcion || "Evento administrativo registrado.";
  }

  function verDetalleUsuario(usuario) {
    const rolesActivos = obtenerRolesActivos(usuario);

    Swal.fire({
      title: usuario.nombre_completo,
      width: 760,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#0D2B63",
      html: `
        <div style="text-align:left">
          <p>
            <strong>RUN/RUT:</strong> ${escaparHtml(usuario.rut || "No registrado")}
          </p>
          <p>
            <strong>Correo:</strong> ${escaparHtml(usuario.correo)}
          </p>
          <p>
            <strong>Telefono:</strong> ${escaparHtml(usuario.telefono || "Sin telefono")}
          </p>
          <p>
            <strong>Estado:</strong> ${usuario.activo ? "ACTIVO" : "INACTIVO"}
          </p>
          <p>
            <strong>Fecha de creacion:</strong> ${escaparHtml(formatearFecha(usuario.fecha_creacion))}
          </p>

          <hr/>

          <p class="mb-2"><strong>Roles activos</strong></p>
          ${
            rolesActivos.length > 0
              ? rolesActivos
                  .map(
                    (rol) =>
                      `<span class="badge bg-primary me-1 mb-1">${escaparHtml(rol.nombre_rol)}</span>`,
                  )
                  .join("")
              : `<span class="badge bg-warning text-dark">SIN ROL ACTIVO</span>`
          }
        </div>
      `,
    });
  }

  async function verHistorialUsuario(usuario) {
    try {
      const respuesta = await obtenerHistorialUsuario(usuario.id_usuario);
      const historial = respuesta.data || [];

      const contenido =
        historial.length > 0
          ? historial
              .map(
                (evento) => `
                  <div style="border-left:4px solid #0D2B63;background:#f8f9fa;border-radius:8px;padding:10px 12px;margin-bottom:12px;text-align:left;font-size:14px">
                    <span class="badge bg-primary mb-1" style="font-size:11px">
                      ${escaparHtml(evento.tabla_afectada === "usuario_rol" ? "Gestion de roles" : "Registro de usuario")}
                    </span>
                    <p class="mb-1" style="font-size:15px">${escaparHtml(obtenerDescripcionHistorial(evento))}</p>
                    <small class="text-muted d-block">
                      Usuario: ${escaparHtml(evento.usuario || "Sistema")}
                    </small>
                    <small class="text-muted d-block">
                      Fecha: ${escaparHtml(formatearFecha(evento.fecha_evento))}
                    </small>
                    <small class="text-muted d-block">
                      Origen: ${escaparHtml(evento.user_agent ? "Operacion realizada desde el sistema" : "No registrado")}
                    </small>

                    <details style="margin-top:8px">
                      <summary><strong>Ver detalle tecnico</strong></summary>
                      ${renderTablaJson("Datos anteriores", evento.valor_anterior)}
                      ${renderTablaJson("Datos registrados", evento.valor_nuevo)}
                    </details>
                  </div>
                `,
              )
              .join("")
          : `<p class="text-muted mb-0">No existen eventos de historial para este usuario.</p>`;

      Swal.fire({
        title: `Historial ${usuario.rut || usuario.nombre_completo}`,
        width: 900,
        html: contenido,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#0D2B63",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al obtener historial",
        text:
          error.response?.data?.message ||
          "No fue posible cargar el historial del usuario.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarCambioEstadoUsuario(usuario) {
    if (!esSuperAdministrador) {
      Swal.fire({
        icon: "info",
        title: "Accion no disponible",
        text: "Solo el super administrador puede cambiar el estado de usuarios.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const nuevoEstado = !usuario.activo;
    const resultado = await Swal.fire({
      title: nuevoEstado ? "Habilitar usuario" : "Deshabilitar usuario",
      html: `
        <div style="text-align:left">
          <p>
            Usuario: <strong>${escaparHtml(usuario.nombre_completo)}</strong>
          </p>
          <p>
            RUN/RUT: ${escaparHtml(usuario.rut || "No registrado")}
          </p>
          <p class="mb-0">
            ${
              nuevoEstado
                ? "La cuenta volvera a quedar disponible para iniciar sesion segun sus roles activos."
                : "La cuenta no podra iniciar sesion mientras permanezca deshabilitada. No se eliminaran registros historicos."
            }
          </p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: nuevoEstado ? "Si, habilitar" : "Si, deshabilitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nuevoEstado ? "#198754" : "#DC3545",
      cancelButtonColor: "#6C757D",
    });

    if (!resultado.isConfirmed) return;

    try {
      const respuesta = await actualizarEstadoUsuario(
        usuario.id_usuario,
        nuevoEstado,
      );

      await Swal.fire({
        icon: "success",
        title: nuevoEstado ? "Usuario habilitado" : "Usuario deshabilitado",
        text:
          respuesta.message ||
          "El estado del usuario fue actualizado correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      await cargarDatos();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar estado",
        text:
          error.response?.data?.message ||
          "No fue posible actualizar el estado del usuario.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarResetPasswordUsuario(usuario) {
    if (!puedeResetearPassword(usuario)) {
      Swal.fire({
        icon: "info",
        title: "Accion no disponible",
        text: "Un administrador no puede resetear la contrasena de un super administrador.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const resultado = await Swal.fire({
      title: "Resetear contrasena",
      width: 640,
      html:
        '<div style="text-align:left">' +
        '<p>Usuario: <strong>' + escaparHtml(usuario.nombre_completo) + '</strong></p>' +
        '<p>RUN/RUT: ' + escaparHtml(usuario.rut || "No registrado") + '</p>' +
        '<p class="text-muted">Ingrese una contrasena temporal. La clave anterior no se muestra ni se recupera por seguridad.</p>' +
        '<label class="form-label fw-semibold" for="nuevaPasswordUsuario">Nueva contrasena temporal</label>' +
        '<input id="nuevaPasswordUsuario" type="password" class="form-control" maxlength="72" placeholder="Minimo 8 caracteres" />' +
        '<small class="text-muted">Debe tener entre 8 y 72 caracteres.</small>' +
        '<div id="nuevaPasswordUsuarioError" class="alert alert-warning py-2 px-3 mt-3 mb-0 d-none" style="font-size:14px"></div>' +
        '</div>',
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Resetear contrasena",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
      didOpen: () => {
        document.getElementById("nuevaPasswordUsuario")?.focus();
      },
      preConfirm: () => {
        const password = document.getElementById("nuevaPasswordUsuario")?.value || "";
        const error = document.getElementById("nuevaPasswordUsuarioError");

        if (password.length < 8 || password.length > 72) {
          error.textContent = "La contrasena temporal debe tener entre 8 y 72 caracteres.";
          error.classList.remove("d-none");
          return false;
        }

        return password;
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      const respuesta = await resetearPasswordUsuario(
        usuario.id_usuario,
        resultado.value,
      );

      await Swal.fire({
        icon: "success",
        title: "Contrasena reseteada",
        text:
          respuesta.message ||
          "La contrasena temporal fue registrada correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      await cargarDatos();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al resetear contrasena",
        text:
          error.response?.data?.message ||
          "No fue posible resetear la contrasena del usuario.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  async function manejarGestionRoles(usuario) {
    if (!puedeGestionarRoles(usuario)) {
      Swal.fire({
        icon: "info",
        title: "Gestion no disponible",
        text: "Un administrador no puede modificar roles de un super administrador.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    const rolesDisponibles = obtenerRolesDisponiblesParaGestion();
    const rolesActivos = obtenerRolesActivos(usuario).map((rol) =>
      Number(rol.id_rol),
    );

    const resultado = await Swal.fire({
      title: `Roles de ${usuario.nombre_completo}`,
      width: 720,
      html: `
        <div style="text-align:left">
          <p style="margin-bottom:14px">
            Seleccione los perfiles habilitados para el usuario. No se eliminan
            registros: los roles no seleccionados quedaran inactivos para
            preservar trazabilidad.
          </p>

          <div class="row g-2">
            ${rolesDisponibles
              .map(
                (rol) => `
                  <div class="col-md-6">
                    <div class="form-check border rounded p-2 ps-5">
                      <input
                        id="rolUsuario${rol.id_rol}"
                        class="form-check-input"
                        type="checkbox"
                        value="${rol.id_rol}"
                        ${rolesActivos.includes(Number(rol.id_rol)) ? "checked" : ""}
                      />
                      <label class="form-check-label fw-semibold" for="rolUsuario${rol.id_rol}">
                        ${rol.nombre_rol}
                      </label>
                      <div class="text-muted small">
                        ${rol.descripcion || "Perfil de acceso del sistema."}
                      </div>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>

          <div
            id="rolesUsuarioError"
            class="alert alert-warning py-2 px-3 mt-3 mb-0 d-none"
            style="font-size:14px"
          ></div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar roles",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0D2B63",
      cancelButtonColor: "#6C757D",
      preConfirm: () => {
        const seleccionados = rolesDisponibles
          .filter((rol) => document.getElementById(`rolUsuario${rol.id_rol}`)?.checked)
          .map((rol) => Number(rol.id_rol));

        const error = document.getElementById("rolesUsuarioError");

        if (seleccionados.length === 0) {
          error.textContent = "Debe mantener al menos un rol activo para el usuario.";
          error.classList.remove("d-none");
          return false;
        }

        return seleccionados;
      },
    });

    if (!resultado.isConfirmed) return;

    try {
      const respuesta = await actualizarRolesUsuario(
        usuario.id_usuario,
        resultado.value,
      );

      await Swal.fire({
        icon: "success",
        title: "Roles actualizados",
        text:
          respuesta.message ||
          "Los roles del usuario fueron actualizados correctamente.",
        confirmButtonColor: "#0D2B63",
      });

      await cargarDatos();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al actualizar roles",
        text:
          error.response?.data?.message ||
          "No fue posible actualizar los roles del usuario.",
        confirmButtonColor: "#0D2B63",
      });
    }
  }

  return (
    <MainLayout>
      <div className="mb-4">
        <h2 className="fw-bold mb-1">Usuarios</h2>
        <p className="text-muted mb-0">
          Administracion de cuentas, perfiles de acceso y trazabilidad de roles.
        </p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-primary" title="Total de cuentas creadas en SGTSL, incluyendo usuarios activos e inactivos." aria-label="Total de cuentas creadas en SGTSL">
            <div className="card-body">
              <h6 className="text-muted">Total usuarios</h6>
              <h2 className="fw-bold">{resumen.total}</h2>
              <small>Cuentas registradas en el sistema</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-success" title="Usuarios habilitados para iniciar sesión y operar según sus roles asignados." aria-label="Usuarios habilitados para iniciar sesión">
            <div className="card-body">
              <h6 className="text-muted">Activos</h6>
              <h2 className="fw-bold">{resumen.activos}</h2>
              <small>Usuarios habilitados</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-secondary" title="Usuarios deshabilitados temporalmente. No pueden iniciar sesion hasta que un super administrador reactive la cuenta." aria-label="Usuarios inactivos del sistema">
            <div className="card-body">
              <h6 className="text-muted">Usuarios inactivos</h6>
              <h2 className="fw-bold">{resumen.inactivos}</h2>
              <small>Cuentas sin acceso habilitado</small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card sgtsl-card h-100 border-start border-5 border-info" title="Usuarios con roles de administracion: super administrador o administrador." aria-label="Usuarios con perfiles de administracion">
            <div className="card-body">
              <h6 className="text-muted">Administracion</h6>
              <h2 className="fw-bold">{resumen.administradores}</h2>
              <small>Perfiles con gestion avanzada</small>
            </div>
          </div>
        </div>
      </div>

      {mostrarRegistro && (
      <div id="registro" className="card sgtsl-card mb-4">
        <div className="card-header bg-white">
          <strong>Registro de nuevo usuario</strong>
          <small className="text-muted ms-2">
            Disponible solo para super administrador
          </small>
        </div>

        <div className="card-body">
          <form onSubmit={manejarRegistroUsuario}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  RUN/RUT <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="text"
                  className={claseRutFormulario}
                  maxLength="12"
                  value={formUsuario.rut}
                  onChange={(e) => actualizarRutFormulario(e.target.value)}
                  placeholder="Ej: 12.345.678-5"
                />
                <small className={claseAyudaRut}>
                  {estadoRutFormulario.mensaje}
                </small>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Nombres <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="100"
                  value={formUsuario.nombres}
                  onChange={(e) => actualizarCampo("nombres", e.target.value)}
                  placeholder="Nombres del usuario"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Apellidos <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="100"
                  value={formUsuario.apellidos}
                  onChange={(e) => actualizarCampo("apellidos", e.target.value)}
                  placeholder="Apellidos del usuario"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Correo <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  maxLength="150"
                  value={formUsuario.correo}
                  onChange={(e) => actualizarCampo("correo", e.target.value)}
                  placeholder="usuario@institucion.cl"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">Telefono</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength="30"
                  value={formUsuario.telefono}
                  onChange={(e) => actualizarCampo("telefono", e.target.value)}
                  placeholder="Opcional"
                />
                <small className="text-muted">
                  {formUsuario.telefono.length} / 30 caracteres.
                </small>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Contrasena inicial <span className="sgtsl-required">*</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  maxLength="72"
                  value={formUsuario.password}
                  onChange={(e) => actualizarCampo("password", e.target.value)}
                  placeholder="Minimo 8 caracteres"
                />
                <small className="text-muted">
                  {formUsuario.password.length} / 72 caracteres.
                </small>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Roles de acceso <span className="sgtsl-required">*</span>
                </label>
                <div className="row g-2">
                  {roles.map((rol) => (
                    <div className="col-md-6" key={rol.id_rol}>
                      <div className="form-check border rounded p-2 ps-5 h-100">
                        <input
                          id={`nuevoUsuarioRol${rol.id_rol}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={formUsuario.roles.includes(Number(rol.id_rol))}
                          onChange={() => alternarRolFormulario(rol.id_rol)}
                        />
                        <label
                          className="form-check-label fw-semibold"
                          htmlFor={`nuevoUsuarioRol${rol.id_rol}`}
                        >
                          {rol.nombre_rol}
                        </label>
                        <div className="text-muted small">
                          {rol.descripcion || "Perfil de acceso del sistema."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-12">
                <div className="alert alert-info mb-0">
                  La cuenta quedara activa y los accesos se controlaran por los
                  roles seleccionados. No se eliminan usuarios por dependencia
                  con auditorias, revisiones, incidencias y bajas.
                </div>
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Limpiar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guardando}
                >
                  <i className="bi bi-person-plus me-2"></i>
                  {guardando ? "Registrando..." : "Registrar usuario"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      )}

      {mostrarListado && (
      <>
      <div className="card sgtsl-card mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>Filtros de usuarios</strong>
            <small className="text-muted ms-2">
              {usuariosFiltrados.length} de {usuarios.length} registros
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
              <div className="col-md-6">
                <label className="form-label fw-semibold">Busqueda</label>
                <input
                  type="text"
                  className="form-control"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="RUN, nombre, correo, telefono o rol"
                />
              </div>

              <div className="col-md-2">
                <label className="form-label fw-semibold">Rol</label>
                <select
                  className="form-select"
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {roles.map((rol) => (
                    <option key={rol.id_rol} value={rol.nombre_rol}>
                      {rol.nombre_rol}
                    </option>
                  ))}
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
                  <option value="ACTIVOS">Activos</option>
                  <option value="INACTIVOS">Inactivos</option>
                </select>
              </div>

              <div className="col-md-2 d-flex align-items-end">
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
            <strong>Usuarios registrados</strong>
            <small className="text-muted ms-2">
              Mostrando {usuariosVisibles.length} de {usuariosFiltrados.length}
            </small>
          </div>

          {usuariosFiltrados.length > limiteUsuariosContraidos && (
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
                <th>Usuario</th>
                <th>Contacto</th>
                <th>Roles activos</th>
                <th>Estado</th>
                <th>Fecha creacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    No existen usuarios para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                usuariosVisibles.map((usuario) => {
                  const rolesActivos = obtenerRolesActivos(usuario);

                  return (
                    <tr key={usuario.id_usuario}>
                      <td>
                        <strong>{usuario.nombre_completo}</strong>
                        <br />
                        <small>{usuario.rut || "RUN no registrado"}</small>
                      </td>
                      <td>
                        {usuario.correo}
                        <br />
                        <small>{usuario.telefono || "Sin telefono"}</small>
                      </td>
                      <td>
                        {rolesActivos.length > 0 ? (
                          rolesActivos.map((rol) => (
                            <span
                              key={rol.id_rol}
                              className="badge bg-primary me-1 mb-1"
                            >
                              {rol.nombre_rol}
                            </span>
                          ))
                        ) : (
                          <span className="badge bg-warning text-dark">
                            SIN ROL ACTIVO
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            usuario.activo ? "bg-success" : "bg-secondary"
                          }`}
                        >
                          {usuario.activo ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </td>
                      <td>{formatearFecha(usuario.fecha_creacion)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-1"
                          title="Ver detalle"
                          onClick={() => verDetalleUsuario(usuario)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark me-1"
                          title="Ver historial"
                          onClick={() => verHistorialUsuario(usuario)}
                        >
                          <i className="bi bi-clock-history"></i>
                        </button>

                        {puedeGestionarRoles(usuario) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            title="Gestionar roles"
                            onClick={() => manejarGestionRoles(usuario)}
                          >
                            <i className="bi bi-shield-check"></i>
                          </button>
                        )}

                        {puedeResetearPassword(usuario) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning ms-1"
                            title="Resetear contrasena"
                            onClick={() => manejarResetPasswordUsuario(usuario)}
                          >
                            <i className="bi bi-key"></i>
                          </button>
                        )}

                        {esSuperAdministrador && (
                          <button
                            type="button"
                            className={`btn btn-sm ms-1 ${
                              usuario.activo
                                ? "btn-outline-danger"
                                : "btn-outline-success"
                            }`}
                            title={
                              usuario.activo
                                ? "Deshabilitar usuario"
                                : "Habilitar usuario"
                            }
                            onClick={() => manejarCambioEstadoUsuario(usuario)}
                          >
                            <i
                              className={`bi ${
                                usuario.activo
                                  ? "bi-person-x"
                                  : "bi-person-check"
                              }`}
                            ></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
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

export default UsuariosPage;

