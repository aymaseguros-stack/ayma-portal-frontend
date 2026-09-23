// L-2: ver a los inactivos y a los anulados, y sólo el ADMIN.
//
// UN SOLO VOCABULARIO PARA LOS DOS LISTADOS, igual que del lado del backend
// (app/services/visibilidad_listados.py). Personas y leads no comparten
// columnas -una persona se da de baja con `dada_de_baja_en`, un lead con
// `estado='anulado'`- pero sí comparten LA PREGUNTA, y dos vocabularios para
// la misma pregunta es cómo una pantalla termina mandando `inactivos` a una y
// `inactivo` a la otra. Acá está una sola vez.
//
// D-C22: TODO LO QUE NO SEA `activos` ES SÓLO ADMIN. El selector no se le
// dibuja a un agente, y el backend contesta 403 (no 401: el token es válido,
// el rol no alcanza) si llegara igual. ESCONDERLO NO ES EL CONTROL: el control
// es el 403.
export const ACTIVOS = 'activos';
export const INACTIVOS = 'inactivos';
export const ANULADOS = 'anulados';
export const TODOS = 'todos';

export const VISIBILIDADES = [
  { valor: ACTIVOS, label: 'Activos' },
  { valor: INACTIVOS, label: 'Inactivos' },
  { valor: ANULADOS, label: 'Dados de baja' },
  { valor: TODOS, label: 'Todos' },
];

// `todos` NO incluye a los anulados, y no es un descuido: C-6k dejó escrito
// que las dadas de baja no vuelven "ni con estado=todos". Se las ve pidiéndolas
// por su nombre. El cartel lo dice en la pantalla para que nadie lea el "Todos"
// como "todo lo que hay".
export const AYUDA_VISIBILIDAD = {
  [ACTIVOS]: null,
  [INACTIVOS]: 'Personas apagadas a mano. No incluye las dadas de baja.',
  [ANULADOS]: 'Las dadas de baja: la fila no se borró nunca, sólo salió de las lecturas del negocio.',
  [TODOS]: 'Activos e inactivos. Las dadas de baja NO vuelven acá: se piden por su nombre en "Dados de baja".',
};
