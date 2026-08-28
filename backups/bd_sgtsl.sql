/*
==============================================================================
SISTEMA DE GESTIÓN TECNOLÓGICA DE SALAS Y LABORATORIOS - SGTSL
BASE DE DATOS: bd_sgtsl
MOTOR: MySQL 8.0 / Azure Database for MySQL

DESCRIPCIÓN GENERAL:
El presente script crea desde cero la base de datos del Sistema de Gestión
Tecnológica de Salas y Laboratorios. El modelo permite administrar usuarios,
roles, permisos, edificios, salas, equipamiento tecnológico, asignación de
equipos por sala, revisiones técnicas semanales, checklist técnico dinámico,
incidencias, evidencias, historial de gestión de incidencias, ticket
institucional externo, baja formal de equipos, códigos QR, auditoría y vistas
KPI para el dashboard.

CRITERIO DE DISEÑO:
La base de datos se estructura en tercera forma normal. Las entidades principales
se separan de sus catálogos y relaciones. La trazabilidad se conserva mediante
campos de usuario creador y usuario actualizador. Las revisiones técnicas se
complementan con checklist parametrizable por tipo de equipo.

IMPORTANTE:
Este script elimina y vuelve a crear la base de datos bd_sgtsl. Debe ejecutarse
solo cuando se requiera reconstruir la base desde cero.

NOTA SOBRE CLAVES:
Las claves_hash incluidas son referenciales para documentación del PIF. En un
ambiente funcional deben reemplazarse por hash bcrypt generado desde el backend
para la contraseña institucional definida.
==============================================================================
*/

/*
==============================================================================
VERSIÓN ACTUALIZADA:
Incluye las mejoras incorporadas durante el desarrollo del frontend/backend:
- Ticket institucional externo en incidencias.
- Historial funcional de incidencias.
- Historial funcional de revisiones técnicas.
- Correlativo visual numero_ticket separado de id_incidencia.
- Tabla sistema_correlativo para controlar tickets visibles sin saltos por errores.
- Evidencias fotográficas guardadas en carpeta del backend y ruta en MySQL.
- Checklist técnico dinámico por tipo de equipo.
- Asignación de equipos por sala con ubicación física.
- Usuario docente guía del PIF con RUN ficticio válido.
==============================================================================
*/

DROP DATABASE IF EXISTS bd_sgtsl;
CREATE DATABASE bd_sgtsl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bd_sgtsl;

/*
==============================================================================
MÓDULO 1: USUARIOS, ROLES Y PERMISOS
==============================================================================
*/

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(20) NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(30) NULL,
    clave_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE rol (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(60) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE permiso (
    id_permiso INT AUTO_INCREMENT PRIMARY KEY,
    codigo_permiso VARCHAR(80) NOT NULL UNIQUE,
    nombre_permiso VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE usuario_rol (
    id_usuario_rol INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    CONSTRAINT fk_usuario_rol_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_usuario_rol_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol),
    CONSTRAINT fk_usuario_rol_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_usuario_rol_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT uq_usuario_rol UNIQUE (id_usuario, id_rol)
) ENGINE=InnoDB;

CREATE TABLE rol_permiso (
    id_rol_permiso INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,
    fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    CONSTRAINT fk_rol_permiso_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol),
    CONSTRAINT fk_rol_permiso_permiso FOREIGN KEY (id_permiso) REFERENCES permiso(id_permiso),
    CONSTRAINT fk_rol_permiso_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_rol_permiso_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT uq_rol_permiso UNIQUE (id_rol, id_permiso)
) ENGINE=InnoDB;

/*
==============================================================================
MÓDULO 2: EDIFICIOS, SALAS Y QR
==============================================================================
*/

CREATE TABLE tipo_sala (
    id_tipo_sala INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tipo_sala_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_tipo_sala_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE edificio (
    id_edificio INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    campus VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_edificio UNIQUE (nombre, campus),
    CONSTRAINT fk_edificio_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_edificio_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE sala (
    id_sala INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    piso VARCHAR(20) NULL,
    capacidad INT NULL,
    id_tipo_sala INT NOT NULL,
    id_edificio INT NOT NULL,
    ubicacion_detalle VARCHAR(255) NULL,
    estado_sala ENUM('ACTIVA', 'INACTIVA', 'MANTENCION') NOT NULL DEFAULT 'ACTIVA',
    permite_reserva BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones VARCHAR(500) NULL,
    eliminado_logico BOOLEAN NOT NULL DEFAULT FALSE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sala_tipo_sala FOREIGN KEY (id_tipo_sala) REFERENCES tipo_sala(id_tipo_sala),
    CONSTRAINT fk_sala_edificio FOREIGN KEY (id_edificio) REFERENCES edificio(id_edificio),
    CONSTRAINT fk_sala_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_sala_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE INDEX idx_sala_usuario_creacion ON sala(id_usuario_creacion);
CREATE INDEX idx_sala_edificio ON sala(id_edificio);

CREATE TABLE sala_qr (
    id_qr INT AUTO_INCREMENT PRIMARY KEY,
    id_sala INT NOT NULL UNIQUE,
    codigo_qr VARCHAR(120) NOT NULL UNIQUE,
    url_destino VARCHAR(255) NOT NULL UNIQUE,
    fecha_generacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_ultima_regeneracion DATETIME NULL,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    CONSTRAINT fk_sala_qr_sala FOREIGN KEY (id_sala) REFERENCES sala(id_sala),
    CONSTRAINT fk_sala_qr_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_sala_qr_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

/*
==============================================================================
MÓDULO 3: EQUIPAMIENTO TECNOLÓGICO
==============================================================================
*/

CREATE TABLE tipo_equipo (
    id_tipo_equipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NULL,
    requiere_serie BOOLEAN NOT NULL DEFAULT FALSE,
    requiere_ip BOOLEAN NOT NULL DEFAULT FALSE,
    requiere_mac BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_tipo_equipo_nombre UNIQUE (nombre),
    CONSTRAINT fk_tipo_equipo_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_tipo_equipo_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE equipo (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    codigo_inventario VARCHAR(50) NULL UNIQUE,
    nro_serie VARCHAR(100) NULL UNIQUE,
    nombre_equipo VARCHAR(100) NOT NULL,
    marca VARCHAR(80) NULL,
    modelo VARCHAR(80) NULL,
    id_tipo_equipo INT NOT NULL,
    direccion_ip VARCHAR(45) NULL,
    mac_address VARCHAR(17) NULL,
    fecha_compra DATE NULL,
    fecha_garantia_fin DATE NULL,
    tiene_factura BOOLEAN NOT NULL DEFAULT FALSE,
    numero_factura VARCHAR(100) NULL,
    observacion_factura VARCHAR(500) NULL,
    estado_activo ENUM('OPERATIVO', 'CON_FALLA', 'FUERA_SERVICIO', 'BAJA') NOT NULL DEFAULT 'OPERATIVO',
    observaciones VARCHAR(500) NULL,
    eliminado_logico BOOLEAN NOT NULL DEFAULT FALSE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipo_tipo_equipo FOREIGN KEY (id_tipo_equipo) REFERENCES tipo_equipo(id_tipo_equipo),
    CONSTRAINT fk_equipo_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_equipo_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT chk_equipo_mac_format CHECK (mac_address IS NULL OR mac_address REGEXP '^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$')
) ENGINE=InnoDB;

CREATE INDEX idx_equipo_usuario_creacion ON equipo(id_usuario_creacion);
CREATE INDEX idx_equipo_tipo_estado ON equipo(id_tipo_equipo, estado_activo);

CREATE TABLE sala_equipo (
    id_sala_equipo INT AUTO_INCREMENT PRIMARY KEY,
    id_sala INT NOT NULL,
    id_equipo INT NOT NULL,
    fecha_instalacion DATE NOT NULL,
    fecha_retiro DATE NULL,
    ubicacion_en_sala VARCHAR(150) NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    estado_asignacion ENUM('ACTIVA', 'RETIRADA', 'REEMPLAZADA') NOT NULL DEFAULT 'ACTIVA',
    observaciones VARCHAR(500) NULL,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sala_equipo_sala FOREIGN KEY (id_sala) REFERENCES sala(id_sala),
    CONSTRAINT fk_sala_equipo_equipo FOREIGN KEY (id_equipo) REFERENCES equipo(id_equipo),
    CONSTRAINT fk_sala_equipo_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_sala_equipo_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT chk_fechas_sala_equipo CHECK (fecha_retiro IS NULL OR fecha_retiro >= fecha_instalacion)
) ENGINE=InnoDB;

CREATE INDEX idx_sala_equipo_sala_estado ON sala_equipo(id_sala, estado_asignacion);
CREATE INDEX idx_sala_equipo_equipo ON sala_equipo(id_equipo);
CREATE INDEX idx_sala_equipo_usuario_creacion ON sala_equipo(id_usuario_creacion);

/*
==============================================================================
MÓDULO 4: REVISIONES TÉCNICAS Y CHECKLIST
==============================================================================
*/

CREATE TABLE plantilla_revision (
    id_plantilla INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_tipo_sala INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_plantilla_revision_tipo_sala FOREIGN KEY (id_tipo_sala) REFERENCES tipo_sala(id_tipo_sala),
    CONSTRAINT fk_plantilla_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_plantilla_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT uq_plantilla_nombre_tipo UNIQUE (nombre, id_tipo_sala)
) ENGINE=InnoDB;

CREATE TABLE plantilla_revision_item (
    id_plantilla_item INT AUTO_INCREMENT PRIMARY KEY,
    id_plantilla INT NOT NULL,
    id_tipo_equipo INT NOT NULL,
    orden_visual INT NOT NULL,
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_plantilla_item_plantilla FOREIGN KEY (id_plantilla) REFERENCES plantilla_revision(id_plantilla),
    CONSTRAINT fk_plantilla_item_tipo_equipo FOREIGN KEY (id_tipo_equipo) REFERENCES tipo_equipo(id_tipo_equipo),
    CONSTRAINT fk_plantilla_item_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_plantilla_item_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT uq_plantilla_item UNIQUE (id_plantilla, id_tipo_equipo)
) ENGINE=InnoDB;

CREATE TABLE estado_revision (
    id_estado_revision INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE revision (
    id_revision INT AUTO_INCREMENT PRIMARY KEY,
    id_sala INT NOT NULL,
    id_usuario_revisor INT NOT NULL,
    fecha_revision DATETIME NOT NULL,
    observacion_general VARCHAR(1000) NULL,
    origen_revision ENUM('QR', 'MANUAL', 'PROGRAMADA') NOT NULL DEFAULT 'QR',
    estado_revision_general ENUM('BORRADOR', 'FINALIZADA', 'ANULADA') NOT NULL DEFAULT 'FINALIZADA',
    id_usuario_actualizacion INT NULL,
    id_usuario_anulacion INT NULL,
    fecha_anulacion DATETIME NULL,
    motivo_anulacion VARCHAR(500) NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_revision_sala FOREIGN KEY (id_sala) REFERENCES sala(id_sala),
    CONSTRAINT fk_revision_usuario_revisor FOREIGN KEY (id_usuario_revisor) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_revision_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_revision_usuario_anulacion FOREIGN KEY (id_usuario_anulacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE INDEX idx_revision_sala_fecha ON revision(id_sala, fecha_revision);

CREATE TABLE revision_detalle (
    id_revision_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_revision INT NOT NULL,
    id_sala_equipo INT NOT NULL,
    id_estado_revision INT NOT NULL,
    observacion VARCHAR(1000) NULL,
    requiere_incidencia BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_revision_detalle_revision FOREIGN KEY (id_revision) REFERENCES revision(id_revision),
    CONSTRAINT fk_revision_detalle_sala_equipo FOREIGN KEY (id_sala_equipo) REFERENCES sala_equipo(id_sala_equipo),
    CONSTRAINT fk_revision_detalle_estado_revision FOREIGN KEY (id_estado_revision) REFERENCES estado_revision(id_estado_revision),
    CONSTRAINT uq_revision_detalle UNIQUE (id_revision, id_sala_equipo)
) ENGINE=InnoDB;

CREATE TABLE checklist_item (
    id_checklist_item INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE tipo_equipo_checklist (
    id_tipo_equipo_checklist INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo_equipo INT NOT NULL,
    id_checklist_item INT NOT NULL,
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_tec_tipo_equipo FOREIGN KEY (id_tipo_equipo) REFERENCES tipo_equipo(id_tipo_equipo),
    CONSTRAINT fk_tec_checklist_item FOREIGN KEY (id_checklist_item) REFERENCES checklist_item(id_checklist_item),
    CONSTRAINT uk_tipo_equipo_item UNIQUE (id_tipo_equipo, id_checklist_item)
) ENGINE=InnoDB;

CREATE TABLE revision_checklist_detalle (
    id_revision_checklist_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_revision INT NOT NULL,
    id_equipo INT NOT NULL,
    id_checklist_item INT NOT NULL,
    estado_item ENUM('OK', 'CON_PROBLEMA', 'NO_APLICA') NOT NULL DEFAULT 'OK',
    observacion VARCHAR(1000) NULL,
    id_usuario_creacion INT NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rcd_revision FOREIGN KEY (id_revision) REFERENCES revision(id_revision),
    CONSTRAINT fk_rcd_equipo FOREIGN KEY (id_equipo) REFERENCES equipo(id_equipo),
    CONSTRAINT fk_rcd_checklist_item FOREIGN KEY (id_checklist_item) REFERENCES checklist_item(id_checklist_item),
    CONSTRAINT fk_rcd_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

/*
==============================================================================
TABLA: revision_historial
------------------------------------------------------------------------------
Registra la trazabilidad funcional de cada revisión técnica. Esta tabla permite
identificar qué usuario realizó una acción sobre una revisión, cuándo se generó
el movimiento y qué descripción quedó asociada.

Ejemplos de acciones:
- REGISTRO
- EDICION
- ANULACION
==============================================================================
*/
CREATE TABLE revision_historial (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_revision INT NOT NULL,
    id_usuario INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_revision_historial_revision FOREIGN KEY (id_revision) REFERENCES revision(id_revision),
    CONSTRAINT fk_revision_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE INDEX idx_revision_historial_revision_fecha ON revision_historial(id_revision, fecha_registro);
CREATE INDEX idx_revision_historial_usuario ON revision_historial(id_usuario);

/*
==============================================================================
MÓDULO 5: INCIDENCIAS Y EVIDENCIAS
==============================================================================
*/

CREATE TABLE tipo_incidencia (
    id_tipo_incidencia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    id_usuario_creacion INT NOT NULL,
    id_usuario_actualizacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tipo_incidencia_usuario_creacion FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_tipo_incidencia_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE estado_incidencia (
    id_estado_incidencia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE incidencia (
    id_incidencia INT AUTO_INCREMENT PRIMARY KEY,

    /*
    --------------------------------------------------------------------------
    CORRELATIVO VISIBLE DE TICKET:
    id_incidencia se mantiene como clave técnica interna de MySQL.
    numero_ticket se usa para mostrar tickets al usuario en formato:
    SGTSL-INC-000001, SGTSL-INC-000002, etc.
    --------------------------------------------------------------------------
    */
    numero_ticket INT NOT NULL UNIQUE,

    id_sala INT NOT NULL,
    id_sala_equipo INT NULL,
    id_revision INT NULL,
    id_tipo_incidencia INT NOT NULL,
    id_estado_incidencia INT NOT NULL,
    id_usuario_reporta INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion VARCHAR(1500) NOT NULL,
    prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'MEDIA',

    /*
    --------------------------------------------------------------------------
    CAMPOS DE INTEGRACIÓN INSTITUCIONAL:
    Permiten asociar una incidencia SGTSL con un ticket generado en otro
    sistema institucional, por ejemplo una mesa de ayuda externa.
    --------------------------------------------------------------------------
    */
    requiere_ticket_externo BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_externo VARCHAR(100) NULL,

    fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME NULL,
    observacion_cierre VARCHAR(1000) NULL,
    id_usuario_actualizacion INT NULL,
    id_usuario_cierre INT NULL,
    CONSTRAINT fk_incidencia_sala FOREIGN KEY (id_sala) REFERENCES sala(id_sala),
    CONSTRAINT fk_incidencia_sala_equipo FOREIGN KEY (id_sala_equipo) REFERENCES sala_equipo(id_sala_equipo),
    CONSTRAINT fk_incidencia_revision FOREIGN KEY (id_revision) REFERENCES revision(id_revision),
    CONSTRAINT fk_incidencia_tipo FOREIGN KEY (id_tipo_incidencia) REFERENCES tipo_incidencia(id_tipo_incidencia),
    CONSTRAINT fk_incidencia_estado FOREIGN KEY (id_estado_incidencia) REFERENCES estado_incidencia(id_estado_incidencia),
    CONSTRAINT fk_incidencia_usuario_reporta FOREIGN KEY (id_usuario_reporta) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_incidencia_usuario_actualizacion FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_incidencia_usuario_cierre FOREIGN KEY (id_usuario_cierre) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE INDEX idx_incidencia_estado_prioridad ON incidencia(id_estado_incidencia, prioridad);
CREATE INDEX idx_incidencia_sala_fecha ON incidencia(id_sala, fecha_reporte);
CREATE INDEX idx_incidencia_ticket_externo ON incidencia(ticket_externo);
CREATE INDEX idx_incidencia_numero_ticket ON incidencia(numero_ticket);


CREATE INDEX idx_incidencia_sala_estado_fecha ON incidencia(id_sala, id_estado_incidencia, fecha_reporte);
CREATE INDEX idx_incidencia_usuario_actualizacion ON incidencia(id_usuario_actualizacion);

CREATE TABLE incidencia_evidencia (
    id_evidencia INT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    tipo_mime VARCHAR(100) NULL,
    tamano_bytes BIGINT NULL,
    fecha_subida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_subida INT NOT NULL,
    CONSTRAINT fk_incidencia_evidencia_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencia(id_incidencia),
    CONSTRAINT fk_incidencia_evidencia_usuario FOREIGN KEY (id_usuario_subida) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

/*
==============================================================================
TABLA: incidencia_historial
------------------------------------------------------------------------------
Registra la trazabilidad funcional de cada incidencia. Esta tabla permite saber
qué usuario realizó una acción, cuándo la realizó y qué descripción se dejó
registrada para el seguimiento.

Ejemplos de acciones:
- REGISTRO
- CAMBIO_ESTADO
- EVIDENCIA
- OBSERVACION
==============================================================================
*/
CREATE TABLE incidencia_historial (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_incidencia INT NOT NULL,
    id_usuario INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_incidencia_historial_incidencia FOREIGN KEY (id_incidencia) REFERENCES incidencia(id_incidencia),
    CONSTRAINT fk_incidencia_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE INDEX idx_incidencia_historial_incidencia_fecha ON incidencia_historial(id_incidencia, fecha_registro);
CREATE INDEX idx_incidencia_historial_usuario ON incidencia_historial(id_usuario);

/*
==============================================================================
TABLA: sistema_correlativo
------------------------------------------------------------------------------
Centraliza correlativos visibles del sistema. En el caso de incidencias, permite
generar numero_ticket sin depender del AUTO_INCREMENT de MySQL. Esto evita que
el ticket visible salte números cuando ocurre un error o rollback.
==============================================================================
*/
CREATE TABLE sistema_correlativo (
    codigo VARCHAR(50) PRIMARY KEY,
    ultimo_numero INT NOT NULL
) ENGINE=InnoDB;


/*
==============================================================================
MÓDULO 6: BAJA FORMAL DE EQUIPOS Y AUDITORÍA
==============================================================================
*/

CREATE TABLE baja_equipo (
    id_baja_equipo INT AUTO_INCREMENT PRIMARY KEY,
    id_equipo INT NOT NULL,
    id_usuario_solicita INT NOT NULL,
    id_usuario_aprueba INT NULL,
    id_usuario_ejecuta INT NULL,
    fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion DATETIME NULL,
    fecha_ejecucion DATETIME NULL,
    motivo_baja VARCHAR(500) NOT NULL,
    observacion_tecnica VARCHAR(1000) NULL,
    documento_respaldo VARCHAR(500) NULL,
    estado_baja ENUM('SOLICITADA', 'APROBADA', 'EJECUTADA', 'RECHAZADA', 'ANULADA') NOT NULL DEFAULT 'SOLICITADA',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_baja_equipo_equipo FOREIGN KEY (id_equipo) REFERENCES equipo(id_equipo),
    CONSTRAINT fk_baja_equipo_usuario_solicita FOREIGN KEY (id_usuario_solicita) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_baja_equipo_usuario_aprueba FOREIGN KEY (id_usuario_aprueba) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_baja_equipo_usuario_ejecuta FOREIGN KEY (id_usuario_ejecuta) REFERENCES usuario(id_usuario),
    CONSTRAINT chk_baja_equipo_fechas CHECK ((fecha_aprobacion IS NULL OR fecha_aprobacion >= fecha_solicitud) AND (fecha_ejecucion IS NULL OR fecha_aprobacion IS NULL OR fecha_ejecucion >= fecha_aprobacion))
) ENGINE=InnoDB;

CREATE INDEX idx_baja_equipo_equipo ON baja_equipo(id_equipo);
CREATE INDEX idx_baja_equipo_estado ON baja_equipo(estado_baja);
CREATE INDEX idx_baja_equipo_usuario_solicita ON baja_equipo(id_usuario_solicita);

CREATE TABLE auditoria_log (
    id_auditoria BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    tabla_afectada VARCHAR(80) NOT NULL,
    id_registro_afectado INT NULL,
    accion ENUM('INSERT','UPDATE','DELETE_LOGICO','DELETE_FISICO','LOGIN','LOGOUT','ACCESO_DENEGADO','CAMBIO_ESTADO','CIERRE_INCIDENCIA','BAJA_EQUIPO','GENERACION_QR','REGENERACION_QR','EXPORTACION_REPORTE') NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    valor_anterior JSON NULL,
    valor_nuevo JSON NULL,
    ip_origen VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_log_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT chk_auditoria_tabla_afectada CHECK (tabla_afectada <> '')
) ENGINE=InnoDB;

CREATE INDEX idx_auditoria_usuario ON auditoria_log(id_usuario);
CREATE INDEX idx_auditoria_tabla_registro ON auditoria_log(tabla_afectada, id_registro_afectado);
CREATE INDEX idx_auditoria_fecha ON auditoria_log(fecha_evento);
CREATE INDEX idx_auditoria_accion ON auditoria_log(accion);

/*
==============================================================================
INSERTS INICIALES: USUARIOS, ROLES, PERMISOS Y CATÁLOGOS
==============================================================================
*/

INSERT INTO usuario (rut, nombres, apellidos, correo, telefono, clave_hash, activo) VALUES
('33.333.333-3', 'Francisca', 'Medina', 'francisca.medina5@virginiogomez.cl', '+56987654321', '$2b$10$REEMPLAZAR_HASH_BCRYPT_SGTSL2026', TRUE),
('44.444.444-4', 'Jose', 'Inostroza', 'jose.inostroza4@virginiogomez.cl', '+56987654322', '$2b$10$REEMPLAZAR_HASH_BCRYPT_SGTSL2026', TRUE),
('55.555.555-5', 'Francisco', 'Ulloa', 'francisco.ulloa@virginiogomez.cl', '+56987654323', '$2b$10$REEMPLAZAR_HASH_BCRYPT_SGTSL2026', TRUE),
('17.777.777-3', 'Eliana Cecilia', 'Guerrero Sepulveda', 'eliana.guerrero@virginiogomez.cl', '+56977777777', '$2b$10$REEMPLAZAR_HASH_BCRYPT_SGTSL2026', TRUE);

SET @id_usuario_auditoria = (SELECT id_usuario FROM usuario WHERE correo = 'francisco.ulloa@virginiogomez.cl' LIMIT 1);

INSERT INTO rol (nombre_rol, descripcion, activo) VALUES
('SUPER_ADMINISTRADOR', 'Acceso total al sistema, gestión de usuarios, roles, permisos, auditoría y KPI globales.', TRUE),
('ADMINISTRADOR', 'Gestión administrativa general del sistema.', TRUE),
('TECNICO_SOPORTE', 'Gestión de soporte técnico, revisiones e incidencias.', TRUE),
('DOCENTE', 'Registro y consulta de incidencias institucionales.', TRUE),
('ALUMNO_PRACTICA', 'Apoyo técnico y ejecución de revisiones.', TRUE);

INSERT INTO permiso (codigo_permiso, nombre_permiso, descripcion, activo) VALUES
('USUARIO_VER','Ver usuarios','Permite visualizar usuarios registrados.',TRUE),
('USUARIO_CREAR','Crear usuarios','Permite registrar nuevos usuarios.',TRUE),
('USUARIO_EDITAR','Editar usuarios','Permite modificar usuarios.',TRUE),
('USUARIO_ELIMINAR','Eliminar usuarios','Permite desactivar usuarios.',TRUE),
('ROL_GESTIONAR','Gestionar roles','Permite administrar roles.',TRUE),
('PERMISO_GESTIONAR','Gestionar permisos','Permite administrar permisos.',TRUE),
('SALA_VER','Ver salas','Permite visualizar salas.',TRUE),
('SALA_CREAR','Crear salas','Permite registrar salas.',TRUE),
('SALA_EDITAR','Editar salas','Permite modificar salas.',TRUE),
('SALA_DESACTIVAR','Desactivar salas','Permite desactivar salas lógicamente.',TRUE),
('QR_GESTIONAR','Gestionar QR','Permite administrar códigos QR.',TRUE),
('EQUIPO_VER','Ver equipos','Permite visualizar equipamiento.',TRUE),
('EQUIPO_CREAR','Crear equipos','Permite registrar equipamiento.',TRUE),
('EQUIPO_EDITAR','Editar equipos','Permite modificar equipamiento.',TRUE),
('ASIGNACION_GESTIONAR','Gestionar asignaciones','Permite asignar equipos a salas.',TRUE),
('REVISION_REGISTRAR','Registrar revisiones','Permite ejecutar revisiones técnicas.',TRUE),
('REVISION_VER','Ver revisiones','Permite consultar historial de revisiones.',TRUE),
('INCIDENCIA_REGISTRAR','Registrar incidencias','Permite registrar incidencias.',TRUE),
('INCIDENCIA_GESTIONAR','Gestionar incidencias','Permite administrar incidencias.',TRUE),
('INCIDENCIA_VER','Ver incidencias','Permite visualizar incidencias.',TRUE),
('REPORTE_VER','Ver reportes','Permite visualizar reportes institucionales.',TRUE),
('KPI_GLOBAL','Visualizar KPI global','Permite acceder al dashboard institucional.',TRUE),
('BAJA_EQUIPO_VER','Ver bajas de equipo','Permite consultar bajas.',TRUE),
('BAJA_EQUIPO_SOLICITAR','Solicitar baja de equipo','Permite solicitar baja.',TRUE),
('BAJA_EQUIPO_APROBAR','Aprobar baja de equipo','Permite aprobar baja.',TRUE),
('BAJA_EQUIPO_EJECUTAR','Ejecutar baja de equipo','Permite ejecutar baja.',TRUE),
('AUDITORIA_VER','Ver auditoría','Permite visualizar auditoría.',TRUE),
('AUDITORIA_EXPORTAR','Exportar auditoría','Permite exportar auditoría.',TRUE);

/* 
Se asigna SUPER_ADMINISTRADOR a los usuarios base para facilitar las pruebas del
PIF. Además, se asignan todos los roles al usuario principal de pruebas y a la
docente guía, permitiendo demostrar la selección dinámica de roles desde login.
*/
INSERT INTO usuario_rol (id_usuario, id_rol, id_usuario_creacion, id_usuario_actualizacion)
SELECT u.id_usuario, r.id_rol, @id_usuario_auditoria, @id_usuario_auditoria
FROM usuario u JOIN rol r
WHERE r.nombre_rol = 'SUPER_ADMINISTRADOR';

INSERT IGNORE INTO usuario_rol (id_usuario, id_rol, id_usuario_creacion, id_usuario_actualizacion)
SELECT @id_usuario_auditoria, r.id_rol, @id_usuario_auditoria, @id_usuario_auditoria
FROM rol r;

SET @id_docente_guia = (SELECT id_usuario FROM usuario WHERE correo = 'eliana.guerrero@virginiogomez.cl' LIMIT 1);

INSERT IGNORE INTO usuario_rol (id_usuario, id_rol, id_usuario_creacion, id_usuario_actualizacion)
SELECT @id_docente_guia, r.id_rol, @id_usuario_auditoria, @id_usuario_auditoria
FROM rol r;

/* Se asignan permisos según rol. */
INSERT INTO rol_permiso (id_rol, id_permiso, id_usuario_creacion, id_usuario_actualizacion)
SELECT r.id_rol, p.id_permiso, @id_usuario_auditoria, @id_usuario_auditoria FROM rol r JOIN permiso p WHERE r.nombre_rol = 'SUPER_ADMINISTRADOR';

INSERT INTO rol_permiso (id_rol, id_permiso, id_usuario_creacion, id_usuario_actualizacion)
SELECT r.id_rol, p.id_permiso, @id_usuario_auditoria, @id_usuario_auditoria FROM rol r JOIN permiso p
WHERE r.nombre_rol = 'ADMINISTRADOR' AND p.codigo_permiso IN ('USUARIO_VER','USUARIO_CREAR','USUARIO_EDITAR','SALA_VER','SALA_CREAR','SALA_EDITAR','EQUIPO_VER','EQUIPO_CREAR','EQUIPO_EDITAR','REVISION_VER','INCIDENCIA_VER','INCIDENCIA_GESTIONAR','REPORTE_VER','BAJA_EQUIPO_VER','BAJA_EQUIPO_SOLICITAR','BAJA_EQUIPO_APROBAR','AUDITORIA_VER');

INSERT INTO rol_permiso (id_rol, id_permiso, id_usuario_creacion, id_usuario_actualizacion)
SELECT r.id_rol, p.id_permiso, @id_usuario_auditoria, @id_usuario_auditoria FROM rol r JOIN permiso p
WHERE r.nombre_rol = 'TECNICO_SOPORTE' AND p.codigo_permiso IN ('SALA_VER','EQUIPO_VER','REVISION_REGISTRAR','REVISION_VER','INCIDENCIA_REGISTRAR','INCIDENCIA_GESTIONAR','INCIDENCIA_VER','BAJA_EQUIPO_VER','BAJA_EQUIPO_SOLICITAR','BAJA_EQUIPO_EJECUTAR');

INSERT INTO rol_permiso (id_rol, id_permiso, id_usuario_creacion, id_usuario_actualizacion)
SELECT r.id_rol, p.id_permiso, @id_usuario_auditoria, @id_usuario_auditoria FROM rol r JOIN permiso p
WHERE r.nombre_rol = 'DOCENTE' AND p.codigo_permiso IN ('SALA_VER','INCIDENCIA_REGISTRAR','INCIDENCIA_VER');

INSERT INTO rol_permiso (id_rol, id_permiso, id_usuario_creacion, id_usuario_actualizacion)
SELECT r.id_rol, p.id_permiso, @id_usuario_auditoria, @id_usuario_auditoria FROM rol r JOIN permiso p
WHERE r.nombre_rol = 'ALUMNO_PRACTICA' AND p.codigo_permiso IN ('SALA_VER','EQUIPO_VER','REVISION_REGISTRAR','REVISION_VER','INCIDENCIA_REGISTRAR','INCIDENCIA_VER');

INSERT INTO tipo_sala (nombre, descripcion, id_usuario_creacion, id_usuario_actualizacion) VALUES
('SALA','Sala de clases',@id_usuario_auditoria,@id_usuario_auditoria),
('LABORATORIO','Laboratorio académico',@id_usuario_auditoria,@id_usuario_auditoria),
('REUNIONES','Sala de reuniones',@id_usuario_auditoria,@id_usuario_auditoria),
('AUDITORIO','Auditorio institucional',@id_usuario_auditoria,@id_usuario_auditoria);

INSERT INTO edificio (nombre, campus, descripcion, id_usuario_creacion, id_usuario_actualizacion) VALUES
('Administracion','Campus Los Angeles','Sector administrativo',@id_usuario_auditoria,@id_usuario_auditoria),
('Artes','Campus Los Angeles','Sector académico de artes',@id_usuario_auditoria,@id_usuario_auditoria),
('Aulas','Campus Los Angeles','Sector principal de aulas',@id_usuario_auditoria,@id_usuario_auditoria),
('Biblioteca','Campus Los Angeles','Sector biblioteca',@id_usuario_auditoria,@id_usuario_auditoria),
('Enrique Molina','Campus Los Angeles','Sector Enrique Molina',@id_usuario_auditoria,@id_usuario_auditoria),
('Laboratorios','Campus Los Angeles','Sector de laboratorios',@id_usuario_auditoria,@id_usuario_auditoria),
('Pasillo Principal','Campus Los Angeles','Sector principal del campus',@id_usuario_auditoria,@id_usuario_auditoria);

INSERT INTO tipo_equipo (nombre, descripcion, requiere_serie, requiere_ip, requiere_mac, activo, id_usuario_creacion, id_usuario_actualizacion) VALUES
('PROYECTOR','Data show o proyector multimedia',TRUE,FALSE,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('PC','Equipo computacional institucional',TRUE,TRUE,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('PANTALLA_TOUCH','Pantalla interactiva táctil',TRUE,FALSE,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('TELEVISOR','Televisor Smart institucional',FALSE,FALSE,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('AUDIO','Sistema de audio',FALSE,FALSE,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('WIFI','Conectividad WIFI institucional',FALSE,TRUE,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria);

INSERT INTO estado_revision (nombre) VALUES ('OK'),('CON_PROBLEMA'),('NO_APLICA');
INSERT INTO estado_incidencia (nombre) VALUES ('ABIERTA'),('EN_REVISION'),('EN_PROCESO'),('RESUELTA'),('CERRADA'),('RECHAZADA');
INSERT INTO tipo_incidencia (nombre, descripcion, id_usuario_creacion, id_usuario_actualizacion) VALUES
('FALLA_PROYECTOR','Problema detectado en proyector',@id_usuario_auditoria,@id_usuario_auditoria),
('FALLA_PC','Problema detectado en computador',@id_usuario_auditoria,@id_usuario_auditoria),
('FALLA_WIFI','Problema detectado en conectividad WIFI',@id_usuario_auditoria,@id_usuario_auditoria),
('FALLA_AUDIO','Problema detectado en sistema de audio',@id_usuario_auditoria,@id_usuario_auditoria),
('DANO_FISICO','Daño físico detectado',@id_usuario_auditoria,@id_usuario_auditoria);

/*
==============================================================================
INSERTS DE SALAS COMPLETAS SEGÚN CATASTRO
==============================================================================
*/
INSERT INTO sala (codigo,nombre,piso,capacidad,id_tipo_sala,id_edificio,ubicacion_detalle,estado_sala,permite_reserva,observaciones,id_usuario_creacion,id_usuario_actualizacion) VALUES
('ADM-001','Sala de Reuniones','1',15,3,1,'Administracion','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-001','Laboratorio de Educacion','1',32,2,2,'Artes','ACTIVA',FALSE,'Laboratorio equipado con 32 computadores y pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-002','Laboratorio de Musica','1',20,2,2,'Artes','ACTIVA',FALSE,'Laboratorio equipado con data show',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-003','Sala 1','1',35,1,2,'Artes','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-004','Sala 2','1',35,1,2,'Artes','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-005','Sala 3','1',35,1,2,'Artes','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-006','Sala 4','1',35,1,2,'Artes','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('ART-007','Sala Experiencias Pedagogicas','1',35,1,2,'Artes','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-001','Auditorio Manuel Rioseco','1',120,4,3,'Aulas','ACTIVA',TRUE,'Auditorio equipado con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-011','Sala 11','1',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-012','Sala 12','1',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-013','Sala 13','1',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con computador y televisor',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-021','Sala 21','2',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con computador y televisor',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-022','Sala 22','2',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-023','Sala 23','2',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-024','Sala 24','2',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-031','Sala 31','3',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-032','Sala 32','3',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-033','Sala 33','3',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('AUL-034','Sala 34','3',35,1,3,'Aulas','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('BIB-001','APTC','2',25,1,4,'Biblioteca','ACTIVA',TRUE,'Sala equipada con computador y cuatro televisores',@id_usuario_auditoria,@id_usuario_auditoria),
('BIB-002','Laboratorio de Ciencias','2',36,2,4,'Biblioteca','ACTIVA',FALSE,'Laboratorio equipado con 36 computadores y televisor',@id_usuario_auditoria,@id_usuario_auditoria),
('BIB-007','Sala 7','2',35,1,4,'Biblioteca','ACTIVA',TRUE,'Sala equipada con data',@id_usuario_auditoria,@id_usuario_auditoria),
('EM-001','Laboratorio de Idiomas','4',30,2,5,'Enrique Molina','ACTIVA',FALSE,'Laboratorio equipado con 30 computadores',@id_usuario_auditoria,@id_usuario_auditoria),
('EM-411','Sala 411','4',35,1,5,'Enrique Molina','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('EM-412','Sala 412','4',35,1,5,'Enrique Molina','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('EM-421','Sala 421','4',35,1,5,'Enrique Molina','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('EM-422','Sala 422','4',35,1,5,'Enrique Molina','ACTIVA',TRUE,'Sala equipada con computador y televisor',@id_usuario_auditoria,@id_usuario_auditoria),
('LAB-001','Laboratorio de Fisiologia','1',25,2,6,'Laboratorios','ACTIVA',FALSE,'Laboratorio equipado con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-001','Auditorio Ronald Ramm','1',120,4,7,'Pasillo Principal','ACTIVA',TRUE,'Auditorio equipado con data show',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-002','Sala COWORK','1',20,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con dos televisores',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-003','Laboratorio de Biologia','1',30,2,7,'Pasillo Principal','ACTIVA',FALSE,'Laboratorio equipado con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-004','Laboratorio de Fisica','1',30,2,7,'Pasillo Principal','ACTIVA',FALSE,'Laboratorio equipado con data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-103','Sala 103','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-105','Sala 105','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-106','Sala 106','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-091','Sala 91','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-093A','Sala 93A','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-093B','Sala 93B','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con computador y data',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-094','Sala 94','1',35,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-005','Sala de Recursos Didacticos','1',25,1,7,'Pasillo Principal','ACTIVA',TRUE,'Sala equipada con pantalla touch',@id_usuario_auditoria,@id_usuario_auditoria),
('PAS-006','Sala Pedro Rios','1',20,3,7,'Pasillo Principal','ACTIVA',TRUE,'Sala de reuniones equipada con televisor',@id_usuario_auditoria,@id_usuario_auditoria);

INSERT INTO sala_qr (id_sala,codigo_qr,url_destino,activo,id_usuario_creacion,id_usuario_actualizacion)
SELECT s.id_sala, CONCAT('QR-', s.codigo), CONCAT('https://sgtsl.azurewebsites.net/revision/', s.codigo), TRUE, @id_usuario_auditoria, @id_usuario_auditoria FROM sala s;

/* Plantillas generales de revisión por tipo de sala. */
INSERT INTO plantilla_revision (nombre,id_tipo_sala,activo,id_usuario_creacion,id_usuario_actualizacion) VALUES
('Checklist Sala',1,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('Checklist Laboratorio',2,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('Checklist Reuniones',3,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
('Checklist Auditorio',4,TRUE,@id_usuario_auditoria,@id_usuario_auditoria);

INSERT INTO plantilla_revision_item (id_plantilla,id_tipo_equipo,orden_visual,obligatorio,activo,id_usuario_creacion,id_usuario_actualizacion) VALUES
(1,1,1,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(1,2,2,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(1,3,3,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(1,4,4,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
(2,2,1,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(2,1,2,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(2,6,3,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
(3,3,1,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(3,4,2,FALSE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),
(4,1,1,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria),(4,5,2,TRUE,TRUE,@id_usuario_auditoria,@id_usuario_auditoria);

/*
==============================================================================
CHECKLIST TÉCNICO PARAMETRIZABLE
==============================================================================
*/
INSERT INTO checklist_item (codigo,nombre,descripcion,activo) VALUES
('ENCENDIDO','Encendido del equipo','Verifica si el equipo enciende correctamente.',TRUE),
('APAGADO','Apagado correcto','Verifica si el equipo apaga sin errores.',TRUE),
('CABLE_PODER','Cable de poder','Revisión física del cable de alimentación.',TRUE),
('HDMI','Cable HDMI','Revisión de cable HDMI y señal de video.',TRUE),
('VGA','Cable VGA','Revisión de cable VGA cuando corresponde.',TRUE),
('IMAGEN','Imagen / proyección','Verifica que exista imagen visible y estable.',TRUE),
('SONIDO','Sonido','Verifica salida de audio y volumen.',TRUE),
('TOUCH','Función touch','Verifica respuesta táctil en pantalla interactiva.',TRUE),
('MOUSE','Mouse','Verifica funcionamiento físico y conexión del mouse.',TRUE),
('TECLADO','Teclado','Verifica funcionamiento físico y conexión del teclado.',TRUE),
('MONITOR','Monitor / pantalla','Verifica imagen, energía y conexión del monitor.',TRUE),
('RED_CABLEADA','Red cableada','Verifica conexión a red por cable.',TRUE),
('WIFI','WiFi','Verifica conectividad inalámbrica.',TRUE),
('ACTUALIZACION','Actualización del equipo','Verifica si el equipo requiere actualización.',TRUE),
('CONTROL_REMOTO','Control remoto','Verifica existencia y funcionamiento del control remoto.',TRUE),
('PUERTOS_USB','Puertos USB','Verifica funcionamiento de puertos USB.',TRUE),
('PUERTO_HDMI','Puerto HDMI','Verifica estado físico del puerto HDMI.',TRUE),
('MICROFONO','Micrófono','Verifica entrada de audio cuando corresponde.',TRUE),
('PARLANTES','Parlantes','Verifica salida de audio desde parlantes.',TRUE),
('ESTADO_FISICO','Estado físico general','Revisión visual de golpes, daños o desgaste.',TRUE);

INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='PC' AND ci.codigo IN ('ENCENDIDO','MOUSE','TECLADO','MONITOR','RED_CABLEADA','WIFI','ACTUALIZACION','PUERTOS_USB','ESTADO_FISICO');
INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='PROYECTOR' AND ci.codigo IN ('ENCENDIDO','HDMI','VGA','IMAGEN','CONTROL_REMOTO','CABLE_PODER','PUERTO_HDMI','ESTADO_FISICO');
INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='PANTALLA_TOUCH' AND ci.codigo IN ('ENCENDIDO','IMAGEN','TOUCH','HDMI','SONIDO','CONTROL_REMOTO','ESTADO_FISICO');
INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='TELEVISOR' AND ci.codigo IN ('ENCENDIDO','IMAGEN','HDMI','SONIDO','CONTROL_REMOTO','ESTADO_FISICO');
INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='AUDIO' AND ci.codigo IN ('ENCENDIDO','SONIDO','MICROFONO','PARLANTES','CABLE_PODER','ESTADO_FISICO');
INSERT INTO tipo_equipo_checklist (id_tipo_equipo,id_checklist_item,obligatorio,orden)
SELECT te.id_tipo_equipo, ci.id_checklist_item, TRUE, 1 FROM tipo_equipo te JOIN checklist_item ci WHERE te.nombre='WIFI' AND ci.codigo IN ('ENCENDIDO','WIFI','CABLE_PODER','ESTADO_FISICO');

/*
==============================================================================
CARGA DE EQUIPOS Y ASIGNACIÓN A SALAS
==============================================================================
*/

/* Equipos principales derivados del catastro. Se registra un equipo agrupado cuando el catastro indica cantidades grandes. */
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT 'ADM-001-PT-001','Pantalla touch Sala de Reuniones','Sin especificar','Sin especificar',id_tipo_equipo,'OPERATIVO','Equipo registrado según catastro institucional.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM tipo_equipo WHERE nombre='PANTALLA_TOUCH';

INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT 'ART-001-PC-001','Computadores Laboratorio de Educación','Sin especificar','Cantidad referencial: 32 equipos',id_tipo_equipo,'OPERATIVO','Registro agrupado de 32 computadores según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM tipo_equipo WHERE nombre='PC';
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT 'ART-001-PT-001','Pantalla touch Laboratorio de Educación','Sin especificar','Sin especificar',id_tipo_equipo,'OPERATIVO','Pantalla touch registrada según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM tipo_equipo WHERE nombre='PANTALLA_TOUCH';
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT 'ART-002-PR-001','Data Laboratorio de Música','Sin especificar','Sin especificar',id_tipo_equipo,'OPERATIVO','Proyector/data registrado según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM tipo_equipo WHERE nombre='PROYECTOR';

/* Equipos por prefijo según tipo de sala y catastro. */
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT CONCAT(s.codigo,'-PC-001'), CONCAT('Computador ',s.nombre), 'Sin especificar','Sin especificar', te.id_tipo_equipo,'OPERATIVO','Computador registrado según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM sala s JOIN tipo_equipo te ON te.nombre='PC' WHERE s.codigo IN ('ART-003','ART-004','ART-005','ART-006','ART-007','AUL-013','AUL-021','BIB-001','BIB-002','EM-001','EM-421','EM-422','PAS-003','PAS-103','PAS-106','PAS-091','PAS-093B');
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT CONCAT(s.codigo,'-PR-001'), CONCAT('Data ',s.nombre), 'Sin especificar','Sin especificar', te.id_tipo_equipo,'OPERATIVO','Proyector/data registrado según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM sala s JOIN tipo_equipo te ON te.nombre='PROYECTOR' WHERE s.codigo IN ('ART-003','ART-004','ART-005','ART-006','ART-007','AUL-001','AUL-022','AUL-023','AUL-024','AUL-031','AUL-032','AUL-033','AUL-034','BIB-007','EM-421','PAS-001','PAS-003','PAS-004','PAS-103','PAS-106','PAS-091','PAS-093B');
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT CONCAT(s.codigo,'-PT-001'), CONCAT('Pantalla touch ',s.nombre), 'Sin especificar','Sin especificar', te.id_tipo_equipo,'OPERATIVO','Pantalla touch registrada según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM sala s JOIN tipo_equipo te ON te.nombre='PANTALLA_TOUCH' WHERE s.codigo IN ('AUL-011','AUL-012','EM-411','EM-412','LAB-001','PAS-105','PAS-093A','PAS-094','PAS-005');
INSERT INTO equipo (codigo_inventario,nombre_equipo,marca,modelo,id_tipo_equipo,estado_activo,observaciones,eliminado_logico,id_usuario_creacion,id_usuario_actualizacion)
SELECT CONCAT(s.codigo,'-TV-001'), CONCAT('Televisor ',s.nombre), 'Sin especificar','Sin especificar', te.id_tipo_equipo,'OPERATIVO','Televisor registrado según catastro.',FALSE,@id_usuario_auditoria,@id_usuario_auditoria FROM sala s JOIN tipo_equipo te ON te.nombre='TELEVISOR' WHERE s.codigo IN ('AUL-013','AUL-021','BIB-001','BIB-002','EM-422','PAS-002','PAS-006');

/* Asignación de equipos a sala con ubicación física ajustada para revisión técnica. */
INSERT INTO sala_equipo (id_sala,id_equipo,fecha_instalacion,ubicacion_en_sala,es_principal,estado_asignacion,observaciones,id_usuario_creacion,id_usuario_actualizacion)
SELECT s.id_sala,e.id_equipo,CURDATE(),
CASE
    WHEN e.codigo_inventario LIKE '%-PC-001' THEN 'Mesa docente'
    WHEN e.codigo_inventario LIKE '%-PR-001' THEN 'Sector frontal / techo'
    WHEN e.codigo_inventario LIKE '%-PT-001' THEN 'Muro principal'
    WHEN e.codigo_inventario LIKE '%-TV-001' THEN 'Muro lateral'
    ELSE 'Sala'
END,
TRUE,'ACTIVA','Asignación inicial según catastro institucional.',@id_usuario_auditoria,@id_usuario_auditoria
FROM sala s INNER JOIN equipo e ON e.codigo_inventario LIKE CONCAT(s.codigo,'-%');

/*
==============================================================================
DATOS DE PRUEBA FUNCIONAL
==============================================================================
*/
INSERT INTO revision (id_sala,id_usuario_revisor,fecha_revision,observacion_general,origen_revision,estado_revision_general,id_usuario_actualizacion)
VALUES (1,@id_usuario_auditoria,NOW(),'Revisión técnica inicial de prueba.','MANUAL','FINALIZADA',@id_usuario_auditoria);

INSERT INTO incidencia (numero_ticket,id_sala,id_sala_equipo,id_revision,id_tipo_incidencia,id_estado_incidencia,id_usuario_reporta,titulo,descripcion,prioridad,id_usuario_actualizacion)
VALUES (1,1,1,NULL,1,1,@id_usuario_auditoria,'Proyector sin imagen','Incidencia inicial para validar dashboard y flujo de soporte.','MEDIA',@id_usuario_auditoria);

/*
==============================================================================
INICIALIZACIÓN DE CORRELATIVOS
------------------------------------------------------------------------------
El último número visible de incidencia queda sincronizado con la incidencia
inicial. El backend incrementa este valor dentro de una transacción.
==============================================================================
*/
INSERT INTO sistema_correlativo (codigo, ultimo_numero) VALUES ('INCIDENCIA', 1);

 /*
==============================================================================
CARGA INICIAL DE HISTORIAL DE INCIDENCIAS
------------------------------------------------------------------------------
Se registra el historial funcional de la incidencia inicial para mantener
coherencia con el módulo de seguimiento implementado en el backend.
==============================================================================
*/
INSERT INTO incidencia_historial
(
    id_incidencia,
    id_usuario,
    accion,
    descripcion
)
SELECT
    i.id_incidencia,
    @id_usuario_auditoria,
    'REGISTRO',
    CONCAT('Se registró la incidencia SGTSL-INC-', LPAD(i.numero_ticket, 6, '0'), ' con prioridad ', i.prioridad, '.')
FROM incidencia i;

/*
==============================================================================
CARGA INICIAL DE HISTORIAL DE REVISIONES
------------------------------------------------------------------------------
Se registra el historial funcional de la revisión inicial para mantener
coherencia con el módulo de seguimiento implementado en el backend.
==============================================================================
*/
INSERT INTO revision_historial
(
    id_revision,
    id_usuario,
    accion,
    descripcion
)
SELECT
    r.id_revision,
    @id_usuario_auditoria,
    'REGISTRO',
    CONCAT('Se registró la revisión REV-', LPAD(r.id_revision, 6, '0'), ' para la sala ', s.codigo, ' - ', s.nombre, '.')
FROM revision r
INNER JOIN sala s
    ON r.id_sala = s.id_sala;


/*
==============================================================================
VISTAS DE APOYO Y KPI
==============================================================================
*/
CREATE OR REPLACE VIEW vw_auditoria_log_detalle AS
SELECT al.id_auditoria, al.fecha_evento, al.accion, al.tabla_afectada, al.id_registro_afectado, al.descripcion, u.id_usuario, CONCAT(u.nombres,' ',u.apellidos) AS usuario_responsable, u.correo AS correo_usuario, al.ip_origen, al.user_agent
FROM auditoria_log al LEFT JOIN usuario u ON al.id_usuario = u.id_usuario;

CREATE OR REPLACE VIEW vw_usuarios_roles AS
SELECT u.id_usuario, CONCAT(u.nombres,' ',u.apellidos) AS usuario, u.correo, r.nombre_rol, ur.activo AS rol_activo, ur.fecha_asignacion, uc.correo AS usuario_asigna, ua.correo AS usuario_actualiza
FROM usuario u INNER JOIN usuario_rol ur ON u.id_usuario=ur.id_usuario INNER JOIN rol r ON ur.id_rol=r.id_rol INNER JOIN usuario uc ON ur.id_usuario_creacion=uc.id_usuario LEFT JOIN usuario ua ON ur.id_usuario_actualizacion=ua.id_usuario;

CREATE OR REPLACE VIEW vw_roles_permisos AS
SELECT r.nombre_rol, p.codigo_permiso, p.nombre_permiso, rp.fecha_asignacion, uc.correo AS usuario_asigna, ua.correo AS usuario_actualiza
FROM rol r INNER JOIN rol_permiso rp ON r.id_rol=rp.id_rol INNER JOIN permiso p ON rp.id_permiso=p.id_permiso INNER JOIN usuario uc ON rp.id_usuario_creacion=uc.id_usuario LEFT JOIN usuario ua ON rp.id_usuario_actualizacion=ua.id_usuario;

CREATE OR REPLACE VIEW vw_kpi_resumen_general AS
SELECT (SELECT COUNT(*) FROM sala WHERE eliminado_logico=FALSE) AS total_salas_activas, (SELECT COUNT(*) FROM equipo WHERE eliminado_logico=FALSE) AS total_equipos_activos, (SELECT COUNT(*) FROM revision) AS total_revisiones, (SELECT COUNT(*) FROM incidencia) AS total_incidencias, (SELECT COUNT(*) FROM incidencia WHERE fecha_cierre IS NULL) AS incidencias_abiertas, (SELECT COUNT(*) FROM baja_equipo) AS total_bajas_registradas;

CREATE OR REPLACE VIEW vw_kpi_incidencias_por_estado AS
SELECT ei.nombre AS estado_incidencia, COUNT(i.id_incidencia) AS total_incidencias FROM estado_incidencia ei LEFT JOIN incidencia i ON ei.id_estado_incidencia=i.id_estado_incidencia GROUP BY ei.nombre;
CREATE OR REPLACE VIEW vw_kpi_incidencias_por_prioridad AS
SELECT prioridad, COUNT(*) AS total_incidencias FROM incidencia GROUP BY prioridad;
CREATE OR REPLACE VIEW vw_kpi_incidencias_por_tipo AS
SELECT ti.nombre AS tipo_incidencia, COUNT(i.id_incidencia) AS total_incidencias FROM tipo_incidencia ti LEFT JOIN incidencia i ON ti.id_tipo_incidencia=i.id_tipo_incidencia GROUP BY ti.nombre;
CREATE OR REPLACE VIEW vw_kpi_incidencias_por_sala AS
SELECT s.codigo AS codigo_sala, s.nombre AS nombre_sala, COUNT(i.id_incidencia) AS total_incidencias FROM sala s LEFT JOIN incidencia i ON s.id_sala=i.id_sala WHERE s.eliminado_logico=FALSE GROUP BY s.id_sala,s.codigo,s.nombre ORDER BY total_incidencias DESC;
CREATE OR REPLACE VIEW vw_kpi_equipos_por_estado AS
SELECT estado_activo, COUNT(*) AS total_equipos FROM equipo WHERE eliminado_logico=FALSE GROUP BY estado_activo;
CREATE OR REPLACE VIEW vw_kpi_equipos_por_tipo AS
SELECT te.nombre AS tipo_equipo, COUNT(e.id_equipo) AS total_equipos FROM tipo_equipo te LEFT JOIN equipo e ON te.id_tipo_equipo=e.id_tipo_equipo AND e.eliminado_logico=FALSE GROUP BY te.nombre;
CREATE OR REPLACE VIEW vw_kpi_revisiones_por_sala AS
SELECT s.codigo AS codigo_sala, s.nombre AS nombre_sala, COUNT(r.id_revision) AS total_revisiones, MAX(r.fecha_revision) AS ultima_revision FROM sala s LEFT JOIN revision r ON s.id_sala=r.id_sala WHERE s.eliminado_logico=FALSE GROUP BY s.id_sala,s.codigo,s.nombre;
CREATE OR REPLACE VIEW vw_kpi_revisiones_mensuales AS
SELECT YEAR(fecha_revision) AS anio, MONTH(fecha_revision) AS mes, COUNT(*) AS total_revisiones FROM revision GROUP BY YEAR(fecha_revision),MONTH(fecha_revision) ORDER BY anio DESC, mes DESC;
CREATE OR REPLACE VIEW vw_kpi_incidencias_mensuales AS
SELECT YEAR(fecha_reporte) AS anio, MONTH(fecha_reporte) AS mes, COUNT(*) AS total_incidencias FROM incidencia GROUP BY YEAR(fecha_reporte),MONTH(fecha_reporte) ORDER BY anio DESC, mes DESC;
CREATE OR REPLACE VIEW vw_kpi_bajas_por_estado AS
SELECT estado_baja, COUNT(*) AS total_bajas FROM baja_equipo GROUP BY estado_baja;
CREATE OR REPLACE VIEW vw_kpi_auditoria_por_accion AS
SELECT accion, COUNT(*) AS total_eventos FROM auditoria_log GROUP BY accion;

/*
==============================================================================
PROCEDIMIENTOS ALMACENADOS PRINCIPALES
==============================================================================
*/
DELIMITER $$

CREATE PROCEDURE sp_registrar_incidencia (
    IN p_id_sala INT,
    IN p_id_sala_equipo INT,
    IN p_id_revision INT,
    IN p_id_tipo_incidencia INT,
    IN p_id_estado_incidencia INT,
    IN p_id_usuario_reporta INT,
    IN p_titulo VARCHAR(150),
    IN p_descripcion VARCHAR(1500),
    IN p_prioridad VARCHAR(20)
)
BEGIN
    /*
    --------------------------------------------------------------------------
    El procedimiento utiliza sistema_correlativo para generar numero_ticket
    independiente del id_incidencia. La fila del correlativo se bloquea con
    FOR UPDATE mientras dura la transacción.
    --------------------------------------------------------------------------
    */
    DECLARE v_numero_ticket INT;

    START TRANSACTION;

    SELECT ultimo_numero + 1
    INTO v_numero_ticket
    FROM sistema_correlativo
    WHERE codigo = 'INCIDENCIA'
    FOR UPDATE;

    INSERT INTO incidencia
    (
        numero_ticket,
        id_sala,
        id_sala_equipo,
        id_revision,
        id_tipo_incidencia,
        id_estado_incidencia,
        id_usuario_reporta,
        titulo,
        descripcion,
        prioridad,
        id_usuario_actualizacion
    )
    VALUES
    (
        v_numero_ticket,
        p_id_sala,
        p_id_sala_equipo,
        p_id_revision,
        p_id_tipo_incidencia,
        p_id_estado_incidencia,
        p_id_usuario_reporta,
        p_titulo,
        p_descripcion,
        p_prioridad,
        p_id_usuario_reporta
    );

    UPDATE sistema_correlativo
    SET ultimo_numero = v_numero_ticket
    WHERE codigo = 'INCIDENCIA';

    COMMIT;
END$$

CREATE PROCEDURE sp_cerrar_incidencia (IN p_id_incidencia INT, IN p_id_usuario_cierre INT, IN p_observacion_cierre VARCHAR(1000))
BEGIN
    UPDATE incidencia SET fecha_cierre=NOW(), observacion_cierre=p_observacion_cierre, id_usuario_cierre=p_id_usuario_cierre, id_usuario_actualizacion=p_id_usuario_cierre, id_estado_incidencia=(SELECT id_estado_incidencia FROM estado_incidencia WHERE nombre='CERRADA' LIMIT 1) WHERE id_incidencia=p_id_incidencia;
END$$

CREATE PROCEDURE sp_registrar_revision (IN p_id_sala INT, IN p_id_usuario_revisor INT, IN p_observacion_general VARCHAR(1000), IN p_origen_revision VARCHAR(30))
BEGIN
    INSERT INTO revision (id_sala,id_usuario_revisor,fecha_revision,observacion_general,origen_revision,estado_revision_general,id_usuario_actualizacion)
    VALUES (p_id_sala,p_id_usuario_revisor,NOW(),p_observacion_general,p_origen_revision,'FINALIZADA',p_id_usuario_revisor);
END$$

CREATE PROCEDURE sp_solicitar_baja_equipo (IN p_id_equipo INT, IN p_id_usuario_solicita INT, IN p_motivo_baja VARCHAR(500), IN p_observacion_tecnica VARCHAR(1000))
BEGIN
    INSERT INTO baja_equipo (id_equipo,id_usuario_solicita,motivo_baja,observacion_tecnica,estado_baja)
    VALUES (p_id_equipo,p_id_usuario_solicita,p_motivo_baja,p_observacion_tecnica,'SOLICITADA');
END$$

CREATE PROCEDURE sp_aprobar_baja_equipo (IN p_id_baja_equipo INT, IN p_id_usuario_aprueba INT)
BEGIN
    UPDATE baja_equipo SET id_usuario_aprueba=p_id_usuario_aprueba, fecha_aprobacion=NOW(), estado_baja='APROBADA' WHERE id_baja_equipo=p_id_baja_equipo;
END$$

CREATE PROCEDURE sp_ejecutar_baja_equipo (IN p_id_baja_equipo INT, IN p_id_usuario_ejecuta INT)
BEGIN
    DECLARE v_id_equipo INT;
    SELECT id_equipo INTO v_id_equipo FROM baja_equipo WHERE id_baja_equipo=p_id_baja_equipo;
    UPDATE baja_equipo SET id_usuario_ejecuta=p_id_usuario_ejecuta, fecha_ejecucion=NOW(), estado_baja='EJECUTADA' WHERE id_baja_equipo=p_id_baja_equipo;
    UPDATE equipo SET estado_activo='BAJA', eliminado_logico=TRUE, id_usuario_actualizacion=p_id_usuario_ejecuta WHERE id_equipo=v_id_equipo;
    UPDATE sala_equipo SET estado_asignacion='RETIRADA', fecha_retiro=CURDATE(), id_usuario_actualizacion=p_id_usuario_ejecuta WHERE id_equipo=v_id_equipo AND estado_asignacion='ACTIVA';
END$$

CREATE PROCEDURE sp_asignar_rol_usuario (IN p_id_usuario INT, IN p_id_rol INT, IN p_id_usuario_creacion INT)
BEGIN
    INSERT INTO usuario_rol (id_usuario,id_rol,id_usuario_creacion,id_usuario_actualizacion)
    VALUES (p_id_usuario,p_id_rol,p_id_usuario_creacion,p_id_usuario_creacion);
END$$

CREATE PROCEDURE sp_asignar_permiso_rol (IN p_id_rol INT, IN p_id_permiso INT, IN p_id_usuario_creacion INT)
BEGIN
    INSERT INTO rol_permiso (id_rol,id_permiso,id_usuario_creacion,id_usuario_actualizacion)
    VALUES (p_id_rol,p_id_permiso,p_id_usuario_creacion,p_id_usuario_creacion);
END$$

CREATE PROCEDURE sp_registrar_evidencia_incidencia (IN p_id_incidencia INT, IN p_nombre_archivo VARCHAR(255), IN p_ruta_archivo VARCHAR(500), IN p_tipo_mime VARCHAR(100), IN p_tamano_bytes BIGINT, IN p_id_usuario_subida INT)
BEGIN
    INSERT INTO incidencia_evidencia (id_incidencia,nombre_archivo,ruta_archivo,tipo_mime,tamano_bytes,id_usuario_subida)
    VALUES (p_id_incidencia,p_nombre_archivo,p_ruta_archivo,p_tipo_mime,p_tamano_bytes,p_id_usuario_subida);
END$$

CREATE PROCEDURE sp_obtener_permisos_usuario (IN p_id_usuario INT)
BEGIN
    SELECT DISTINCT p.codigo_permiso, p.nombre_permiso, p.descripcion
    FROM usuario u INNER JOIN usuario_rol ur ON u.id_usuario=ur.id_usuario INNER JOIN rol r ON ur.id_rol=r.id_rol INNER JOIN rol_permiso rp ON r.id_rol=rp.id_rol INNER JOIN permiso p ON rp.id_permiso=p.id_permiso
    WHERE u.id_usuario=p_id_usuario AND u.activo=TRUE AND ur.activo=TRUE AND r.activo=TRUE AND p.activo=TRUE;
END$$

/*
==============================================================================
TRIGGERS AUTOMÁTICOS DE AUDITORÍA
==============================================================================
*/
CREATE TRIGGER trg_auditoria_sala_insert AFTER INSERT ON sala FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_creacion,'sala',NEW.id_sala,'INSERT','Se registró una nueva sala en el sistema.',NULL,JSON_OBJECT('id_sala',NEW.id_sala,'codigo',NEW.codigo,'nombre',NEW.nombre,'piso',NEW.piso,'capacidad',NEW.capacidad,'ubicacion_detalle',NEW.ubicacion_detalle,'estado_sala',NEW.estado_sala,'permite_reserva',NEW.permite_reserva,'observaciones',NEW.observaciones,'eliminado_logico',NEW.eliminado_logico),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_sala_update AFTER UPDATE ON sala FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_actualizacion,'sala',NEW.id_sala,'UPDATE','Se modificó información de una sala.',JSON_OBJECT('codigo',OLD.codigo,'nombre',OLD.nombre,'piso',OLD.piso,'capacidad',OLD.capacidad,'ubicacion_detalle',OLD.ubicacion_detalle,'estado_sala',OLD.estado_sala,'permite_reserva',OLD.permite_reserva,'observaciones',OLD.observaciones,'eliminado_logico',OLD.eliminado_logico),JSON_OBJECT('codigo',NEW.codigo,'nombre',NEW.nombre,'piso',NEW.piso,'capacidad',NEW.capacidad,'ubicacion_detalle',NEW.ubicacion_detalle,'estado_sala',NEW.estado_sala,'permite_reserva',NEW.permite_reserva,'observaciones',NEW.observaciones,'eliminado_logico',NEW.eliminado_logico),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_equipo_insert AFTER INSERT ON equipo FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_creacion,'equipo',NEW.id_equipo,'INSERT','Se registró un nuevo equipo tecnológico.',NULL,JSON_OBJECT('id_equipo',NEW.id_equipo,'codigo_inventario',NEW.codigo_inventario,'nombre_equipo',NEW.nombre_equipo,'estado_activo',NEW.estado_activo,'tiene_factura',NEW.tiene_factura,'numero_factura',NEW.numero_factura,'observacion_factura',NEW.observacion_factura),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_equipo_update AFTER UPDATE ON equipo FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_actualizacion,'equipo',NEW.id_equipo,'UPDATE','Se modificó información de un equipo tecnológico.',JSON_OBJECT('nombre_equipo',OLD.nombre_equipo,'estado_activo',OLD.estado_activo,'eliminado_logico',OLD.eliminado_logico,'tiene_factura',OLD.tiene_factura,'numero_factura',OLD.numero_factura,'observacion_factura',OLD.observacion_factura),JSON_OBJECT('nombre_equipo',NEW.nombre_equipo,'estado_activo',NEW.estado_activo,'eliminado_logico',NEW.eliminado_logico,'tiene_factura',NEW.tiene_factura,'numero_factura',NEW.numero_factura,'observacion_factura',NEW.observacion_factura),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_incidencia_insert AFTER INSERT ON incidencia FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_reporta,'incidencia',NEW.id_incidencia,'INSERT','Se registró una nueva incidencia.',NULL,JSON_OBJECT('id_incidencia',NEW.id_incidencia,'titulo',NEW.titulo,'prioridad',NEW.prioridad,'id_estado_incidencia',NEW.id_estado_incidencia),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_incidencia_update AFTER UPDATE ON incidencia FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_actualizacion,'incidencia',NEW.id_incidencia,'UPDATE','Se modificó una incidencia.',JSON_OBJECT('id_estado_incidencia',OLD.id_estado_incidencia,'prioridad',OLD.prioridad,'fecha_cierre',OLD.fecha_cierre),JSON_OBJECT('id_estado_incidencia',NEW.id_estado_incidencia,'prioridad',NEW.prioridad,'fecha_cierre',NEW.fecha_cierre),NULL,'Trigger MySQL');
END$$

CREATE TRIGGER trg_auditoria_baja_equipo_insert AFTER INSERT ON baja_equipo FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent)
    VALUES (NEW.id_usuario_solicita,'baja_equipo',NEW.id_baja_equipo,'BAJA_EQUIPO','Se registró una solicitud de baja de equipo.',NULL,JSON_OBJECT('id_baja_equipo',NEW.id_baja_equipo,'id_equipo',NEW.id_equipo,'estado_baja',NEW.estado_baja,'motivo_baja',NEW.motivo_baja),NULL,'Trigger MySQL');
END$$

DELIMITER ;

/*
==============================================================================
AUDITORÍA INICIAL Y VALIDACIONES FINALES
==============================================================================
*/
INSERT INTO auditoria_log (id_usuario,tabla_afectada,id_registro_afectado,accion,descripcion,valor_anterior,valor_nuevo,ip_origen,user_agent) VALUES
(@id_usuario_auditoria,'usuario',NULL,'INSERT','Carga inicial de usuarios administradores y docente guía con RUN ficticios válidos para pruebas.',NULL,JSON_OBJECT('cantidad_usuarios_iniciales',4),'127.0.0.1','Carga inicial SQL - MySQL Workbench'),
(@id_usuario_auditoria,'sala',NULL,'INSERT','Carga completa de salas institucionales según catastro.',NULL,JSON_OBJECT('total_salas',(SELECT COUNT(*) FROM sala)),'127.0.0.1','Carga inicial SQL - MySQL Workbench'),
(@id_usuario_auditoria,'equipo',NULL,'INSERT','Carga inicial de equipamiento tecnológico y asignaciones por sala.',NULL,JSON_OBJECT('total_equipos',(SELECT COUNT(*) FROM equipo)),'127.0.0.1','Carga inicial SQL - MySQL Workbench'),
(@id_usuario_auditoria,'checklist_item',NULL,'INSERT','Carga de checklist técnico parametrizable por tipo de equipo.',NULL,JSON_OBJECT('total_items',(SELECT COUNT(*) FROM checklist_item)),'127.0.0.1','Carga inicial SQL - MySQL Workbench');

SELECT * FROM sistema_correlativo;
SELECT id_incidencia, numero_ticket, CONCAT('SGTSL-INC-', LPAD(numero_ticket, 6, '0')) AS ticket_visible, titulo FROM incidencia ORDER BY numero_ticket;
SELECT * FROM vw_kpi_resumen_general;
SELECT * FROM vw_usuarios_roles;
SELECT * FROM vw_kpi_equipos_por_tipo;
SELECT * FROM vw_kpi_incidencias_por_estado;
SELECT * FROM vw_kpi_revisiones_mensuales;
SELECT * FROM vw_auditoria_log_detalle ORDER BY fecha_evento DESC;
