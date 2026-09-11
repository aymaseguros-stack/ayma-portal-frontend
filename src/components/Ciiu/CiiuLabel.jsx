import React from 'react';

// Tope de caracteres de la DESCRIPCIÓN (el código nunca se recorta). 60 es
// lo que entra en una celda de tabla sin romper el ancho de las columnas
// numéricas que vienen después; el texto completo queda en el `title`.
export const MAX_DESCRIPCION = 60;

export const TEXTO_SIN_CATALOGO = 'no está en el catálogo 2026';

const VACIO = '—';

// Un código CIIU NUNCA se muestra solo (bloque D3): "251200" no le dice
// nada a nadie, "251200 — Fabricación de tanques..." sí. Este es el único
// lugar donde se arma ese texto, así que la ficha, la grilla, el drill-down
// y el CSV dicen exactamente lo mismo.
//
// La descripción SIEMPRE viaja en la misma respuesta que el código (el
// backend la resuelve contra `ciiu_actividad` en PR #104): esto no pide
// nada. Una llamada por fila serían 100 requests por página de tabla.
//
// `descripcion` en null no es un error: el código existe en la cartera pero
// no está en el catálogo vigente (Anexo I, Res. SRT 23/2026). Se dice así,
// en gris, en vez de mostrar el código pelado - "sin descripción" y "no
// existe la actividad" son cosas distintas y el vendedor tiene que poder
// distinguirlas de un vistazo.
const CiiuLabel = ({ codigo, descripcion, className = '' }) => {
  const codigoTexto = codigo === null || codigo === undefined ? '' : String(codigo).trim();
  if (!codigoTexto) return <span className={`text-slate-500 ${className}`}>{VACIO}</span>;

  const desc = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (!desc) {
    const texto = `${codigoTexto} — ${TEXTO_SIN_CATALOGO}`;
    return <span className={`text-slate-500 ${className}`} title={texto}>{texto}</span>;
  }

  const recortada = desc.length > MAX_DESCRIPCION
    ? `${desc.slice(0, MAX_DESCRIPCION).trimEnd()}…`
    : desc;
  return (
    <span className={className} title={`${codigoTexto} — ${desc}`}>
      {codigoTexto} — {recortada}
    </span>
  );
};

export default CiiuLabel;
