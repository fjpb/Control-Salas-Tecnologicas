// Servicio del modulo de equipos.
// Centraliza consultas de inventario y asignacion actual.

import apiClient from "../api/apiClient";

export async function listarEquipos() {
  const response = await apiClient.get("/equipos");
  return response.data;
}

export async function registrarEquipo(data) {
  const response = await apiClient.post("/equipos", data);
  return response.data;
}

export async function editarEquipo(idEquipo, data) {
  const response = await apiClient.patch(`/equipos/${idEquipo}`, data);
  return response.data;
}

export async function obtenerHistorialEquipo(idEquipo) {
  const response = await apiClient.get(`/equipos/${idEquipo}/historial`);
  return response.data;
}

export async function asignarEquipoSala(idEquipo, data) {
  const response = await apiClient.post(
    `/equipos/${idEquipo}/asignar-sala`,
    data,
  );
  return response.data;
}

export async function retirarEquipoSala(idEquipo, data) {
  const response = await apiClient.patch(
    `/equipos/${idEquipo}/retirar-sala`,
    data,
  );
  return response.data;
}

export async function listarBajasEquipo() {
  const response = await apiClient.get("/equipos/bajas");
  return response.data;
}

export async function obtenerHistorialBajaEquipo(idBajaEquipo) {
  const response = await apiClient.get(
    `/equipos/bajas/${idBajaEquipo}/historial`,
  );
  return response.data;
}

export async function solicitarBajaEquipo(idEquipo, data) {
  const response = await apiClient.post(
    `/equipos/${idEquipo}/solicitar-baja`,
    data,
  );
  return response.data;
}

export async function decidirBajaEquipo(idBajaEquipo, data) {
  const response = await apiClient.patch(
    `/equipos/bajas/${idBajaEquipo}/decision`,
    data,
  );
  return response.data;
}

export async function ejecutarBajaEquipo(idBajaEquipo, data) {
  const response = await apiClient.patch(
    `/equipos/bajas/${idBajaEquipo}/ejecutar`,
    data,
  );
  return response.data;
}
