// Utilidades para formatear y validar RUN/RUT chileno.
// Se utiliza en login y formularios de usuarios.

export function limpiarRut(rut) {
  return rut.replace(/\./g, '').replace('-', '').trim().toUpperCase();
}

export function formatearRut(rut) {
  const rutLimpio = limpiarRut(rut);

  if (rutLimpio.length < 2) {
    return rutLimpio;
  }

  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  let cuerpoFormateado = '';
  let contador = 0;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    cuerpoFormateado = cuerpo[i] + cuerpoFormateado;
    contador++;

    if (contador === 3 && i !== 0) {
      cuerpoFormateado = '.' + cuerpoFormateado;
      contador = 0;
    }
  }

  return `${cuerpoFormateado}-${dv}`;
}

export function validarRut(rut) {
  const rutLimpio = limpiarRut(rut);

  if (rutLimpio.length < 8) {
    return {
      valido: false,
      estado: 'incompleto',
      mensaje: 'RUN incompleto.'
    };
  }

  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  if (!/^\d+$/.test(cuerpo)) {
    return {
      valido: false,
      estado: 'invalido',
      mensaje: 'El cuerpo del RUN debe contener solo números.'
    };
  }

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado =
    dvEsperado === 11 ? '0' :
    dvEsperado === 10 ? 'K' :
    String(dvEsperado);

  if (dvCalculado === dv) {
    return {
      valido: true,
      estado: 'valido',
      mensaje: 'RUN válido.'
    };
  }

  return {
    valido: false,
    estado: 'invalido',
    mensaje: 'RUN inválido.'
  };
}
