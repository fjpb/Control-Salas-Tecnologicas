// Servicio del módulo de incidencias.
// Centraliza el consumo de endpoints REST relacionados con incidencias.

import apiClient from "../api/apiClient";

/*
==============================================================================
FUNCIÓN: listarIncidencias
==============================================================================
*/
export async function listarIncidencias() {
  const response = await apiClient.get("/incidencias");
  return response.data;
}

/*
==============================================================================
FUNCIÓN: registrarIncidencia
==============================================================================
*/
export async function registrarIncidencia(data) {
  const response = await apiClient.post("/incidencias", data);
  return response.data;
}

export async function editarIncidencia(idIncidencia, data) {
  const response = await apiClient.patch(`/incidencias/${idIncidencia}`, data);
  return response.data;
}

/*
==============================================================================
FUNCIÓN: cambiarEstadoIncidencia
==============================================================================
*/
export async function cambiarEstadoIncidencia(idIncidencia, data) {
  const response = await apiClient.patch(
    `/incidencias/${idIncidencia}/estado`,
    data,
  );

  return response.data;
}

export async function reabrirIncidencia(idIncidencia, data) {
  const response = await apiClient.patch(
    `/incidencias/${idIncidencia}/reabrir`,
    data,
  );

  return response.data;
}

/*
==============================================================================
FUNCIÓN: obtenerHistorialIncidencia
------------------------------------------------------------------------------
Consulta la trazabilidad funcional de una incidencia.
==============================================================================
*/
export async function obtenerHistorialIncidencia(idIncidencia) {
  const response = await apiClient.get(
    `/incidencias/${idIncidencia}/historial`,
  );

  return response.data;
}


/*
==============================================================================
FUNCION: listarEvidenciasIncidencia
------------------------------------------------------------------------------
Obtiene todas las fotografias asociadas a una incidencia para el visor historico.
==============================================================================
*/
export async function listarEvidenciasIncidencia(idIncidencia) {
  const response = await apiClient.get(
    `/incidencias/${idIncidencia}/evidencias`,
  );

  return response.data;
}

/*
==============================================================================
FUNCIÓN: subirEvidenciaIncidencia
==============================================================================
*/
export async function subirEvidenciaIncidencia(idIncidencia, imagen) {
  const formData = new FormData();

  formData.append("imagen", imagen);

  const response = await apiClient.post(
    `/incidencias/${idIncidencia}/evidencias`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

