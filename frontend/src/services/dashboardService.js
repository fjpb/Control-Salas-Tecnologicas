// Servicio del dashboard SGTSL.
// Centraliza las peticiones relacionadas con KPI e indicadores.

import apiClient from '../api/apiClient';

/*
==============================================================================
FUNCIÓN: obtenerKpiDashboard
DESCRIPCIÓN:
Consulta los indicadores KPI desde el backend.
El backend obtiene estos datos desde vistas SQL creadas en MySQL.
==============================================================================
*/
export async function obtenerKpiDashboard(params = {}) {
  const response = await apiClient.get('/dashboard/kpi', { params });
  return response.data;
}

