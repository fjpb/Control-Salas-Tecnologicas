// Servicio para obtener catálogos desde el backend.
// Se utiliza para cargar listas desplegables del sistema.

import apiClient from '../api/apiClient';

export async function obtenerCatalogos() {
  const response = await apiClient.get('/catalogos');
  return response.data;
}
export async function registrarTipoEquipo(data) {
  const response = await apiClient.post('/catalogos/tipos-equipo', data);
  return response.data;
}


