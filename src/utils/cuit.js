// Validación de CUIT/CUIL argentino (dígito verificador, algoritmo AFIP).
// Espejo del validador del backend (app/services/cuit.py) para dar feedback
// inmediato en el formulario antes de enviar al servidor.
const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export const limpiarCuit = (cuit) => (cuit || '').replace(/\D/g, '');

export const esCuitValido = (cuit) => {
  const digitos = limpiarCuit(cuit);
  if (digitos.length !== 11) return false;

  const numeros = digitos.split('').map(Number);
  const verificador = numeros[10];

  const suma = numeros.slice(0, 10).reduce((acc, n, i) => acc + n * MULTIPLICADORES[i], 0);
  const resto = suma % 11;
  const resultado = 11 - resto;

  let esperado;
  if (resultado === 11) esperado = 0;
  else if (resultado === 10) return false;
  else esperado = resultado;

  return esperado === verificador;
};

export const formatearCuit = (cuit) => {
  const digitos = limpiarCuit(cuit);
  if (digitos.length !== 11) return cuit;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
};
