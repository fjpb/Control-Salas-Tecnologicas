import apiClient from "../api/apiClient";

/*
==============================================================================
FUNCIÓN: verificarBackend
DESCRIPCIÓN:
Consulta la ruta de salud del backend para verificar si la API está operativa.
==============================================================================
*/
export async function verificarBackend() {
  const response = await apiClient.get("/health");
  return response.data;
}

/*
==============================================================================
FUNCIÓN: buscarRolesPorRut
DESCRIPCIÓN:
Consulta los roles asociados al RUN ingresado.
==============================================================================
*/
export async function buscarRolesPorRut(rut) {
  const response = await apiClient.post("/auth/roles", { rut });
  return response.data;
}

/*
==============================================================================
FUNCIÓN: loginUsuario
DESCRIPCIÓN:
Envía RUN, rol y contraseña al backend para iniciar sesión.
==============================================================================
*/
export async function loginUsuario(data) {
  const response = await apiClient.post("/auth/login", data);
  return response.data;
}

export async function validarCredencialesLogin(data) {
  const response = await apiClient.post("/auth/validar-credenciales", data);
  return response.data;
}

export async function seleccionarRolLogin(data) {
  const response = await apiClient.post("/auth/seleccionar-rol", data);
  return response.data;
}

/*
==============================================================================
FUNCIÓN: guardarSesion
DESCRIPCIÓN:
Guarda token y usuario autenticado en localStorage.

IMPORTANTE:
Esta función está adaptada a la respuesta real del backend actual.
==============================================================================
*/
export function guardarSesion(data) {
  localStorage.setItem("sgtsl_token", data.token);

  localStorage.setItem(
    "sgtsl_usuario",
    JSON.stringify({
      id_usuario: data.usuario.id_usuario,
      nombre: data.usuario.nombre,
      correo: data.usuario.correo,
      rol: data.usuario.rol,
    }),
  );
}

/*
==============================================================================
FUNCIÓN: cerrarSesion
DESCRIPCIÓN:
Elimina datos de sesión local.
==============================================================================
*/
export function cerrarSesion() {
  localStorage.removeItem("sgtsl_token");
  localStorage.removeItem("sgtsl_usuario");
}

