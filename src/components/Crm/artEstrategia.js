// Metadata de la clasificación empresas.estrategia_art (backend SRT worker).
// Un solo lugar para label/color/descripción: lo usan CarteraArtPanel (tarjetas,
// badges de tabla, filtro) y la sección ART de la ficha de empresa.
export const ESTRATEGIA_ART_INFO = {
  ATACAR_DESDE_BERKLEY: {
    label: 'Atacar desde Berkley',
    descripcion: 'Cotizables en Berkley',
    color: 'blue',
  },
  ATACAR_A_BERKLEY: {
    label: 'Atacar a Berkley',
    descripcion: 'Ofrecer alternativa',
    color: 'green',
  },
  SIN_COBERTURA_DEUDA: {
    label: 'Sin cobertura',
    descripcion: 'Verificar deuda antes de cotizar',
    color: 'orange',
  },
  SIN_DATO: {
    label: 'Sin verificar',
    descripcion: 'Falta consulta SRT',
    color: 'gray',
  },
};

export const ESTRATEGIA_ART_ORDEN = [
  'ATACAR_DESDE_BERKLEY',
  'ATACAR_A_BERKLEY',
  'SIN_COBERTURA_DEUDA',
  'SIN_DATO',
];

const COLOR_BADGE_CLASSES = {
  blue: 'bg-blue-500/20 text-blue-300',
  green: 'bg-green-500/20 text-green-300',
  orange: 'bg-orange-500/20 text-orange-300',
  gray: 'bg-slate-500/20 text-slate-400',
};

export const estrategiaArtInfo = (valor) => ESTRATEGIA_ART_INFO[valor] || ESTRATEGIA_ART_INFO.SIN_DATO;

export const estrategiaArtBadgeClass = (valor) => COLOR_BADGE_CLASSES[estrategiaArtInfo(valor).color];
