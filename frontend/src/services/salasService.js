// Servicio del modulo de salas.
// Centraliza la consulta de salas, laboratorios e indicadores asociados.

import apiClient from "../api/apiClient";

export async function listarSalas() {
  const response = await apiClient.get("/salas");
  return response.data;
}

export async function registrarSala(data) {
  const response = await apiClient.post("/salas", data);
  return response.data;
}

export async function editarSala(idSala, data) {
  const response = await apiClient.patch(`/salas/${idSala}`, data);
  return response.data;
}

export async function obtenerHistorialSala(idSala) {
  const response = await apiClient.get(`/salas/${idSala}/historial`);
  return response.data;
}

export async function obtenerQrSala(idSala) {
  const response = await apiClient.get(`/salas/${idSala}/qr`);
  return response.data;
}
