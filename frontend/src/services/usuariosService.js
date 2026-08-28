// Servicio del modulo de usuarios.
// Centraliza consultas de cuentas y gestion de roles.

import apiClient from "../api/apiClient";

export async function listarUsuarios() {
  const response = await apiClient.get("/usuarios");
  return response.data;
}

export async function listarRolesUsuarios() {
  const response = await apiClient.get("/usuarios/roles");
  return response.data;
}

export async function registrarUsuario(data) {
  const response = await apiClient.post("/usuarios", data);
  return response.data;
}

export async function actualizarRolesUsuario(idUsuario, roles) {
  const response = await apiClient.patch(`/usuarios/${idUsuario}/roles`, {
    roles,
  });
  return response.data;
}

export async function obtenerHistorialUsuario(idUsuario) {
  const response = await apiClient.get(`/usuarios/${idUsuario}/historial`);
  return response.data;
}

export async function actualizarEstadoUsuario(idUsuario, activo) {
  const response = await apiClient.patch(`/usuarios/${idUsuario}/estado`, {
    activo,
  });
  return response.data;
}

export async function resetearPasswordUsuario(idUsuario, password) {
  const response = await apiClient.patch(`/usuarios/${idUsuario}/password`, {
    password,
  });
  return response.data;
}
