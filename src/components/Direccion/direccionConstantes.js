// Vocabularios del módulo DIRECCIÓN. Copiados UNO A UNO de los enums de
// app/models/direccion.py del backend (PR #165): las columnas son VARCHAR y
// quien valida es app/schemas/direccion.py, así que un valor inventado acá
// vuelve como 422. No agregar opciones sin agregarlas antes en el backend.

export const ESTADOS_FRENTE = ['ABIERTO', 'EN_CURSO', 'BLOQUEADO', 'CERRADO', 'DERIVADO'];
export const EJECUTORES_FRENTE = ['code', 'chrome', 'cowork', 'sebs', 'otro'];
export const ESTADOS_DECISION = ['ABIERTA', 'CERRADA', 'DESCARTADA'];
export const ESTADOS_WORKER = ['ACTIVO', 'DESARROLLO', 'SUSPENDIDO', 'DISEÑADO'];
export const TIPOS_PROVEEDOR = [
  'ASEGURADORA', 'ART', 'CANAL_COTIZACION', 'TECNOLOGIA', 'DATOS',
  'PROFESIONAL', 'LOCACION', 'SERVICIOS', 'OTRO',
];
export const ESTADOS_PROVEEDOR = ['ACTIVO', 'EN_EVALUACION', 'BAJA'];
export const MONEDAS = ['ARS', 'USD'];
export const RUBROS_PRESUPUESTO = [
  'ALQUILERES', 'SERVICIOS_WEB', 'IA', 'MARKETING', 'TELEFONIA',
  'PROFESIONALES', 'IMPUESTOS_TASAS', 'OTROS',
];
export const ESTADOS_TAREA_PROVEEDOR = ['PENDIENTE', 'EN_CURSO', 'HECHA'];
export const TIPOS_COBERTURA = ['ART', 'RC', 'OTRA'];
export const SEVERIDADES_HALLAZGO = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];
export const ESTADOS_HALLAZGO = ['ABIERTO', 'CERRADO', 'FALSO', 'ACEPTADO'];
export const SISTEMAS_HALLAZGO = ['portal', 'vault', 'landing', 'worker', 'org'];

// Etiqueta legible de un valor de enum en SCREAMING_SNAKE.
export const etiqueta = (valor) => {
  if (!valor) return '—';
  return String(valor).replace(/_/g, ' ');
};

// Colores del semáforo (ROJO/AMARILLO/VERDE; app/services/direccion.py).
export const CLASES_SEMAFORO = {
  ROJO: 'bg-red-500/20 text-red-300 border-red-500/40',
  AMARILLO: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
  VERDE: 'bg-green-500/20 text-green-300 border-green-500/40',
};

export const PUNTO_SEMAFORO = {
  ROJO: 'bg-red-500',
  AMARILLO: 'bg-yellow-400',
  VERDE: 'bg-green-500',
};

export const CLASES_ESTADO = {
  ABIERTO: 'bg-blue-500/20 text-blue-300',
  ABIERTA: 'bg-blue-500/20 text-blue-300',
  EN_CURSO: 'bg-indigo-500/20 text-indigo-300',
  BLOQUEADO: 'bg-red-500/20 text-red-300',
  DERIVADO: 'bg-purple-500/20 text-purple-300',
  CERRADO: 'bg-slate-600/40 text-slate-300',
  CERRADA: 'bg-slate-600/40 text-slate-300',
  DESCARTADA: 'bg-slate-600/40 text-slate-400',
  ACTIVO: 'bg-green-500/20 text-green-300',
  EN_EVALUACION: 'bg-yellow-500/20 text-yellow-200',
  BAJA: 'bg-slate-600/40 text-slate-400',
  DESARROLLO: 'bg-yellow-500/20 text-yellow-200',
  SUSPENDIDO: 'bg-red-500/20 text-red-300',
  'DISEÑADO': 'bg-slate-600/40 text-slate-300',
  PENDIENTE: 'bg-blue-500/20 text-blue-300',
  HECHA: 'bg-green-500/20 text-green-300',
  CRITICO: 'bg-red-600/30 text-red-200',
  ALTO: 'bg-orange-500/20 text-orange-300',
  MEDIO: 'bg-yellow-500/20 text-yellow-200',
  BAJO: 'bg-slate-600/40 text-slate-300',
  FALSO: 'bg-slate-600/40 text-slate-400',
  ACEPTADO: 'bg-purple-500/20 text-purple-300',
  OK: 'bg-green-500/20 text-green-300',
};

// Los montos llegan como string (Decimal serializado en el backend): se
// formatea sin sumar monedas distintas, igual que el backend.
export const formatearMonto = (valor, moneda) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '—';
  const texto = numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda ? `${moneda} ${texto}` : texto;
};

// Fecha corta sin inventar zona horaria: el backend manda ISO.
export const fechaCorta = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const diasDesde = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};
