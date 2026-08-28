// Pantalla de autenticacion SGTSL.
// Valida credenciales antes de exponer nombre de usuario o roles disponibles.

import { useEffect, useState } from "react";
import Swal from "sweetalert2";

import {
  guardarSesion,
  seleccionarRolLogin,
  validarCredencialesLogin,
  verificarBackend,
} from "../../services/authService";
import { formatearRut, validarRut } from "../../utils/rutUtils";
import logoLogin from "../../assets/img/logo-udec-login.jpg";

function LoginPage() {
  const [paso, setPaso] = useState("CREDENCIALES");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [tokenPrelogin, setTokenPrelogin] = useState("");
  const [usuarioValidado, setUsuarioValidado] = useState(null);
  const [roles, setRoles] = useState([]);
  const [idRol, setIdRol] = useState("");
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [backendActivo, setBackendActivo] = useState(false);

  async function consultarEstadoBackend() {
    try {
      const respuesta = await verificarBackend();
      setBackendActivo(Boolean(respuesta.ok));
    } catch {
      setBackendActivo(false);
    }
  }

  useEffect(() => {
    consultarEstadoBackend();

    // Mantiene actualizado el indicador visual sin obligar a refrescar la pagina.
    const intervaloEstadoBackend = setInterval(consultarEstadoBackend, 15000);

    return () => clearInterval(intervaloEstadoBackend);
  }, []);

  function manejarCambioRut(event) {
    setRut(formatearRut(event.target.value));
  }

  function reiniciarCredenciales() {
    setPaso("CREDENCIALES");
    setTokenPrelogin("");
    setUsuarioValidado(null);
    setRoles([]);
    setIdRol("");
    setPassword("");
  }

  async function validarCredenciales(event) {
    event.preventDefault();

    const validacionRut = validarRut(rut);

    if (!validacionRut.valido) {
      Swal.fire({
        icon: "warning",
        title: "Datos requeridos",
        text: "Debe ingresar RUN/RUT y contrasena validos.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    if (!password.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Datos requeridos",
        text: "Debe ingresar RUN/RUT y contrasena validos.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    try {
      setCargandoLogin(true);
      await consultarEstadoBackend();

      const data = await validarCredencialesLogin({
        rut,
        password,
      });

      setTokenPrelogin(data.token_prelogin);
      setUsuarioValidado(data.usuario);
      setRoles(data.roles || []);
      setIdRol(data.roles?.length === 1 ? String(data.roles[0].id_rol) : "");
      setPaso("ROL");
    } catch {
      Swal.fire({
        icon: "error",
        title: "Acceso no validado",
        text: "No fue posible validar las credenciales ingresadas.",
        confirmButtonColor: "#0D2B63",
      });
    } finally {
      setCargandoLogin(false);
    }
  }

  async function ingresarConRol(event) {
    event.preventDefault();

    if (!tokenPrelogin || !idRol) {
      Swal.fire({
        icon: "warning",
        title: "Rol requerido",
        text: "Debe seleccionar un rol de acceso.",
        confirmButtonColor: "#0D2B63",
      });
      return;
    }

    try {
      setCargandoLogin(true);

      const data = await seleccionarRolLogin({
        token_prelogin: tokenPrelogin,
        id_rol: Number(idRol),
      });

      guardarSesion(data);

      Swal.fire({
        icon: "success",
        title: "Inicio de sesion exitoso",
        text: "Accediendo al sistema.",
        timer: 1200,
        showConfirmButton: false,
      });

      setTimeout(() => {
        const rutaPendiente =
          localStorage.getItem("sgtsl_ruta_pendiente") || "/dashboard";
        localStorage.removeItem("sgtsl_ruta_pendiente");
        window.location.href = rutaPendiente;
      }, 1200);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "No fue posible ingresar",
        text:
          error.response?.data?.message ||
          "No fue posible completar el acceso al sistema.",
        confirmButtonColor: "#0D2B63",
      });

      if (error.response?.status === 401) {
        reiniciarCredenciales();
      }
    } finally {
      setCargandoLogin(false);
    }
  }

  return (
    <div className="sgtsl-login-bg d-flex align-items-center justify-content-center px-3">
      <div
        className="card sgtsl-card p-4"
        style={{ maxWidth: "480px", width: "100%" }}
      >
        <div className="text-center mb-4">
          <img
            src={logoLogin}
            alt="Universidad de Concepcion"
            className="sgtsl-logo-login mb-3"
          />

          <h4 className="fw-bold mb-1">SGTSL</h4>

          <p className="text-muted mb-0">
            Sistema de Gestion Tecnologica de Salas y Laboratorios
          </p>
        </div>

        {paso === "CREDENCIALES" ? (
          <form onSubmit={validarCredenciales}>
            <div className="mb-3">
              <label className="form-label fw-semibold">
                RUN/RUT <span className="sgtsl-required">*</span>
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="Ej: 19.555.666-7"
                value={rut}
                maxLength={12}
                onChange={manejarCambioRut}
                autoComplete="username"
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">
                Contrasena <span className="sgtsl-required">*</span>
              </label>

              <input
                type="password"
                className="form-control"
                placeholder="Ingrese su contrasena"
                value={password}
                maxLength={60}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={cargandoLogin}
            >
              {cargandoLogin ? "Validando credenciales" : "Continuar"}
            </button>
          </form>
        ) : (
          <form onSubmit={ingresarConRol}>
            <div className="alert alert-info">
              <small className="text-muted d-block">Usuario validado</small>
              <strong>{usuarioValidado?.nombre}</strong>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">
                Rol de acceso <span className="sgtsl-required">*</span>
              </label>

              <select
                className="form-select"
                value={idRol}
                onChange={(e) => setIdRol(e.target.value)}
              >
                <option value="">Seleccione un rol</option>
                {roles.map((rol) => (
                  <option key={rol.id_rol} value={rol.id_rol}>
                    {rol.nombre_rol}
                  </option>
                ))}
              </select>

              <small className="text-muted">
                Seleccione el perfil con el que ingresara al sistema.
              </small>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary flex-fill"
                onClick={reiniciarCredenciales}
                disabled={cargandoLogin}
              >
                Volver
              </button>

              <button
                type="submit"
                className="btn btn-primary flex-fill"
                disabled={cargandoLogin}
              >
                {cargandoLogin ? "Ingresando" : "Ingresar"}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-3">
          <small className={backendActivo ? "text-success" : "text-danger"}>
            {backendActivo
              ? "Backend SGTSL operativo"
              : "Backend SGTSL no disponible"}
          </small>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
