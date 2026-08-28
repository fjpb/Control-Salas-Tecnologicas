// Sidebar lateral institucional SGTSL.
// Muestra solo las opciones de navegacion disponibles para el rol activo.

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import '../../styles/layout/sidebar.css';
import logoBlanco from '../../assets/img/logo-escudo-blanco.jpg';

function Sidebar({ contraido = false, movilAbierto = false, onCerrarMovil, onExpandir }) {
  const location = useLocation();
  const [menusAbiertos, setMenusAbiertos] = useState({});

  const usuario = JSON.parse(localStorage.getItem('sgtsl_usuario'));
  const rolUsuario = usuario?.rol || '';

  const opcionesMenu = [
    {
      ruta: '/dashboard',
      icono: 'bi bi-grid',
      texto: 'Dashboard',
      roles: null
    },
    {
      ruta: '/revisiones',
      icono: 'bi bi-clipboard-check',
      texto: 'Revisiones',
      subMenu: [
        {
          ruta: '/revisiones/registrar',
          texto: 'Registrar revision',
          icono: 'bi bi-plus-circle'
        },
        {
          ruta: '/revisiones/listado',
          texto: 'Revisiones registradas',
          icono: 'bi bi-list-check'
        }
      ],
      roles: [
        'SUPER_ADMINISTRADOR',
        'ADMINISTRADOR',
        'TECNICO_SOPORTE',
        'ALUMNO_PRACTICA'
      ]
    },
    {
      ruta: '/incidencias',
      icono: 'bi bi-exclamation-triangle',
      texto: 'Incidencias',
      subMenu: [
        {
          ruta: '/incidencias/registrar',
          texto: 'Registrar incidencia',
          icono: 'bi bi-plus-circle'
        },
        {
          ruta: '/incidencias/listado',
          texto: 'Incidencias registradas',
          icono: 'bi bi-list-check'
        }
      ],
      roles: null
    },
    {
      ruta: '/equipos',
      icono: 'bi bi-pc-display',
      texto: 'Equipos',
      subMenu: [
        {
          ruta: '/equipos/registrar',
          texto: 'Registrar equipo',
          icono: 'bi bi-plus-circle'
        },
        {
          ruta: '/equipos/inventario',
          texto: 'Inventario de equipos',
          icono: 'bi bi-list-check'
        },
        {
          ruta: '/equipos/asignacion',
          texto: 'Equipos por asignar',
          icono: 'bi bi-building-add'
        },
        {
          ruta: '/equipos/bajas',
          texto: 'Solicitudes de baja',
          icono: 'bi bi-archive'
        }
      ],
      roles: [
        'SUPER_ADMINISTRADOR',
        'ADMINISTRADOR',
        'TECNICO_SOPORTE',
        'ALUMNO_PRACTICA'
      ]
    },
    {
      ruta: '/salas',
      icono: 'bi bi-building',
      texto: 'Salas',
      subMenu: [
        {
          ruta: '/salas/registrar',
          texto: 'Registrar sala',
          icono: 'bi bi-plus-circle',
          roles: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR']
        },
        {
          ruta: '/salas/listado',
          texto: 'Salas registradas',
          icono: 'bi bi-list-check'
        },
        {
          ruta: '/salas/seguimiento',
          texto: 'Seguimiento por sala',
          icono: 'bi bi-activity'
        }
      ],
      roles: [
        'SUPER_ADMINISTRADOR',
        'ADMINISTRADOR',
        'TECNICO_SOPORTE',
        'ALUMNO_PRACTICA'
      ]
    },
    {
      ruta: '/reportes',
      icono: 'bi bi-bar-chart',
      texto: 'Reportes',
      subMenu: [
        {
          ruta: '/reportes/ejecutivo',
          texto: 'Resumen ejecutivo',
          icono: 'bi bi-clipboard-data',
          roles: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR']
        },
        {
          ruta: '/reportes/tecnico',
          texto: 'Operacion tecnica',
          icono: 'bi bi-tools',
          roles: [
            'SUPER_ADMINISTRADOR',
            'ADMINISTRADOR',
            'TECNICO_SOPORTE',
            'ALUMNO_PRACTICA'
          ]
        },
        {
          ruta: '/reportes/auditoria',
          texto: 'Auditoria',
          icono: 'bi bi-shield-check',
          roles: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR']
        }
      ],
      roles: [
        'SUPER_ADMINISTRADOR',
        'ADMINISTRADOR',
        'TECNICO_SOPORTE',
        'ALUMNO_PRACTICA'
      ]
    },
    {
      ruta: '/usuarios',
      icono: 'bi bi-people',
      texto: 'Usuarios',
      subMenu: [
        {
          ruta: '/usuarios/registrar',
          texto: 'Registrar usuario',
          icono: 'bi bi-person-plus',
          roles: ['SUPER_ADMINISTRADOR']
        },
        {
          ruta: '/usuarios/listado',
          texto: 'Usuarios registrados',
          icono: 'bi bi-list-check',
          roles: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR']
        }
      ],
      roles: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR']
    }
  ];

  function puedeVerOpcion(opcion) {
    return !opcion.roles || opcion.roles.includes(rolUsuario);
  }

  function obtenerSubmenuVisible(opcion) {
    return (opcion.subMenu || []).filter(puedeVerOpcion);
  }

  function esRutaActiva(ruta) {
    return location.pathname === ruta;
  }

  function esModuloActivo(opcion) {
    return (
      location.pathname === opcion.ruta ||
      location.pathname.startsWith(`${opcion.ruta}/`) ||
      opcion.subMenu?.some((subOpcion) => esRutaActiva(subOpcion.ruta))
    );
  }

  useEffect(() => {
    const moduloActivo = opcionesMenu.find(
      (opcion) => opcion.subMenu && esModuloActivo(opcion)
    );

    if (moduloActivo) {
      setMenusAbiertos((prev) => ({
        ...prev,
        [moduloActivo.ruta]: true
      }));
    }
  }, [location.pathname]);

  function alternarSubmenu(ruta) {
    if (contraido) {
      onExpandir?.();
      setMenusAbiertos((prev) => ({
        ...prev,
        [ruta]: true
      }));
      return;
    }

    setMenusAbiertos((prev) => ({
      ...prev,
      [ruta]: !prev[ruta]
    }));
  }

  function formatearRol(nombreRol) {
    const roles = {
      SUPER_ADMINISTRADOR: 'Super administrador',
      ADMINISTRADOR: 'Administrador',
      TECNICO_SOPORTE: 'Tecnico soporte',
      ALUMNO_PRACTICA: 'Alumno practica',
      DOCENTE: 'Docente'
    };

    return roles[nombreRol] || nombreRol || 'Sin rol';
  }

  return (
    <aside
      className={`sgtsl-sidebar ${contraido ? 'is-collapsed' : ''} ${
        movilAbierto ? 'is-mobile-open' : ''
      }`}
    >
      <div className="sgtsl-sidebar-header text-center">
        <button
          type="button"
          className="btn btn-sm btn-outline-light sgtsl-sidebar-close"
          onClick={onCerrarMovil}
          title="Cerrar menu"
          aria-label="Cerrar menu lateral"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <img
          src={logoBlanco}
          alt="Escudo Universidad de Concepcion"
          className="sgtsl-sidebar-logo mb-3"
        />

        <h4 className="fw-bold mb-0 sgtsl-sidebar-title">SGTSL</h4>

        <small className="sgtsl-sidebar-subtitle">Salas y Laboratorios</small>
      </div>

      <nav className="mt-4">
        {opcionesMenu.filter(puedeVerOpcion).map((opcion) => (
          <div key={opcion.ruta} className="sgtsl-menu-group">
            {obtenerSubmenuVisible(opcion).length > 0 ? (
              <button
                type="button"
                className={`sgtsl-menu-item sgtsl-menu-button ${
                  esModuloActivo(opcion) ? 'active' : ''
                }`}
                onClick={() => alternarSubmenu(opcion.ruta)}
                title={opcion.texto}
              >
                <i className={opcion.icono}></i>
                <span>{opcion.texto}</span>
                <i
                  className={`bi ${
                    menusAbiertos[opcion.ruta]
                      ? 'bi-chevron-up'
                      : 'bi-chevron-down'
                  } sgtsl-menu-caret`}
                ></i>
              </button>
            ) : (
              <Link
                to={opcion.ruta}
                className={`sgtsl-menu-item ${
                  esModuloActivo(opcion) ? 'active' : ''
                }`}
                title={opcion.texto}
              >
                <i className={opcion.icono}></i>
                <span>{opcion.texto}</span>
              </Link>
            )}

            {obtenerSubmenuVisible(opcion).length > 0 &&
              menusAbiertos[opcion.ruta] && (
              <div className="sgtsl-submenu">
                {obtenerSubmenuVisible(opcion).map((subOpcion) => (
                  <Link
                    key={subOpcion.ruta}
                    to={subOpcion.ruta}
                    className={`sgtsl-submenu-item ${
                      esRutaActiva(subOpcion.ruta) ? 'active' : ''
                    }`}
                  >
                    <i className={subOpcion.icono}></i>
                    <span>{subOpcion.texto}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="sgtsl-sidebar-user">
        <div className="sgtsl-sidebar-user-avatar">
          {(usuario?.nombre || 'U').trim().slice(0, 1).toUpperCase()}
        </div>

        <div className="sgtsl-sidebar-user-text">
          <strong className="d-block text-truncate">
            {usuario?.nombre || 'Usuario'}
          </strong>

          <small className="d-block sgtsl-sidebar-user-role">
            {formatearRol(usuario?.rol)}
          </small>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
