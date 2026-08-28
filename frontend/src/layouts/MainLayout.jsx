// Layout principal del sistema SGTSL.
// Contiene sidebar lateral, header superior y contenido principal.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

function MainLayout({ children }) {
  const location = useLocation();
  const [sidebarContraido, setSidebarContraido] = useState(false);
  const [sidebarMovilAbierto, setSidebarMovilAbierto] = useState(false);

  useEffect(() => {
    if (!location.hash) return;

    const idSeccion = location.hash.replace('#', '');

    const timeout = setTimeout(() => {
      const seccion = document.getElementById(idSeccion);

      if (seccion) {
        seccion.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 80);

    return () => clearTimeout(timeout);
  }, [location.hash, location.pathname]);

  useEffect(() => {
    setSidebarMovilAbierto(false);
  }, [location.pathname]);

  function alternarSidebar() {
    if (window.innerWidth < 992) {
      setSidebarMovilAbierto((estadoActual) => !estadoActual);
      return;
    }

    setSidebarContraido((estadoActual) => !estadoActual);
  }

  return (
    <div
      className={`sgtsl-app-shell ${
        sidebarContraido ? 'sgtsl-sidebar-collapsed' : ''
      } ${sidebarMovilAbierto ? 'sgtsl-sidebar-mobile-open' : ''}`}
    >

      {/* Sidebar lateral */}
      <Sidebar
        contraido={sidebarContraido}
        movilAbierto={sidebarMovilAbierto}
        onCerrarMovil={() => setSidebarMovilAbierto(false)}
        onExpandir={() => setSidebarContraido(false)}
      />

      {sidebarMovilAbierto && (
        <button
          type="button"
          className="sgtsl-sidebar-backdrop"
          aria-label="Cerrar menu lateral"
          onClick={() => setSidebarMovilAbierto(false)}
        />
      )}

      {/* Contenido principal */}
      <div className="sgtsl-content">

        {/* Header superior */}
        <Header onToggleSidebar={alternarSidebar} />

        {/* Contenido dinámico */}
        <main className="sgtsl-main">
          {children}
        </main>

      </div>

    </div>
  );
}

export default MainLayout;

