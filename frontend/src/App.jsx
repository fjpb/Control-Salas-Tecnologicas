// Componente principal del frontend SGTSL.
// Define rutas públicas, rutas protegidas y redirecciones del sistema.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import RevisionesPage from './pages/revisiones/RevisionesPage';
import IncidenciasPage from './pages/incidencias/IncidenciasPage';
import EquiposPage from './pages/equipos/EquiposPage';
import SalasPage from './pages/salas/SalasPage';
import ReportesPage from './pages/reportes/ReportesPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';

import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';

function App() {
  const rolesGestionTecnica = [
    'SUPER_ADMINISTRADOR',
    'ADMINISTRADOR',
    'TECNICO_SOPORTE',
    'ALUMNO_PRACTICA'
  ];
  const rolesGestionEquipo = [
    'SUPER_ADMINISTRADOR',
    'ADMINISTRADOR',
    'TECNICO_SOPORTE'
  ];
  const rolesAdministracion = ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR'];
  const rolesReportes = [
    'SUPER_ADMINISTRADOR',
    'ADMINISTRADOR',
    'TECNICO_SOPORTE',
    'ALUMNO_PRACTICA'
  ];
  const rolesIncidencias = [
    'SUPER_ADMINISTRADOR',
    'ADMINISTRADOR',
    'TECNICO_SOPORTE',
    'ALUMNO_PRACTICA',
    'DOCENTE'
  ];

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/revisiones"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <RevisionesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/revisiones/registrar"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <RevisionesPage vista="registro" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/revisiones/listado"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <RevisionesPage vista="listado" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/incidencias"
          element={
            <ProtectedRoute rolesPermitidos={rolesIncidencias}>
              <IncidenciasPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/incidencias/registrar"
          element={
            <ProtectedRoute rolesPermitidos={rolesIncidencias}>
              <IncidenciasPage vista="registro" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/incidencias/listado"
          element={
            <ProtectedRoute rolesPermitidos={rolesIncidencias}>
              <IncidenciasPage vista="listado" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <EquiposPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos/registrar"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionEquipo}>
              <EquiposPage vista="registro" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos/inventario"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <EquiposPage vista="inventario" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos/asignacion"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionEquipo}>
              <EquiposPage vista="asignacion" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos/bajas"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <EquiposPage vista="bajas" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salas"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <SalasPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salas/listado"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <SalasPage vista="listado" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salas/registrar"
          element={
            <ProtectedRoute rolesPermitidos={rolesAdministracion}>
              <SalasPage vista="registro" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salas/seguimiento"
          element={
            <ProtectedRoute rolesPermitidos={rolesGestionTecnica}>
              <SalasPage vista="seguimiento" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes"
          element={
            <ProtectedRoute rolesPermitidos={rolesReportes}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes/ejecutivo"
          element={
            <ProtectedRoute rolesPermitidos={rolesAdministracion}>
              <ReportesPage vista="ejecutivo" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes/tecnico"
          element={
            <ProtectedRoute rolesPermitidos={rolesReportes}>
              <ReportesPage vista="tecnico" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes/auditoria"
          element={
            <ProtectedRoute rolesPermitidos={rolesAdministracion}>
              <ReportesPage vista="auditoria" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute rolesPermitidos={rolesAdministracion}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios/listado"
          element={
            <ProtectedRoute rolesPermitidos={rolesAdministracion}>
              <UsuariosPage vista="listado" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios/registrar"
          element={
            <ProtectedRoute rolesPermitidos={['SUPER_ADMINISTRADOR']}>
              <UsuariosPage vista="registro" />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

