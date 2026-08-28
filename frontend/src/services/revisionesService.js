// Servicio del módulo de revisiones.
// Centraliza consultas de estado semanal, equipos por sala, checklist,
// registro de revisiones, detalle e historial técnico.

import apiClient from "../api/apiClient";

export async function obtenerEstadoSemanalSala(idSala) {
  const response = await apiClient.get(`/revisiones/estado-semanal/${idSala}`);
  return response.data;
}

export async function obtenerEquiposPorSala(idSala) {
  const response = await apiClient.get(
    `/revisiones/equipos-por-sala/${idSala}`,
  );
  return response.data;
}

export async function obtenerChecklistPorEquipo(idEquipo) {
  const response = await apiClient.get(
    `/revisiones/checklist-equipo/${idEquipo}`,
  );
  return response.data;
}

export async function registrarRevision(data) {
  const response = await apiClient.post("/revisiones", data);
  return response.data;
}

export async function listarRevisiones() {
  const response = await apiClient.get("/revisiones/historial");
  return response.data;
}

export async function obtenerDetalleRevision(idRevision) {
  const response = await apiClient.get(`/revisiones/detalle/${idRevision}`);
  return response.data;
}

export async function obtenerHistorialRevision(idRevision) {
  const response = await apiClient.get(`/revisiones/historial/${idRevision}`);
  return response.data;
}

export async function editarRevision(idRevision, data) {
  const response = await apiClient.patch(`/revisiones/${idRevision}`, data);
  return response.data;
}

export async function anularRevision(idRevision, motivoAnulacion) {
  const response = await apiClient.patch(`/revisiones/${idRevision}/anular`, {
    motivo_anulacion: motivoAnulacion,
  });

  return response.data;
}

