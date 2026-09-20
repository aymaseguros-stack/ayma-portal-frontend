import React from 'react';
import { GRUPOS_CATEGORIAS } from './adjuntosApi';

// Las opciones del desplegable de categorías, agrupadas con <optgroup>.
//
// UN SOLO COMPONENTE PARA LOS DOS DESPLEGABLES (el de cada archivo al subir,
// en AdjuntosUI, y el filtro de la pestaña Documentos). Antes cada uno
// mapeaba la lista por su cuenta: con 8 categorías eso era una línea repetida,
// con 15 y agrupadas serían dos bloques que se desincronizan al primer cambio.
//
// El <optgroup> es HTML nativo, no un menú propio: el desplegable del sistema
// es lo que ya saben usar en el teclado y en el celular, y agruparlo no pide
// renunciar a eso.
export const OpcionesCategorias = () => (
  <>
    {GRUPOS_CATEGORIAS.map(({ grupo, categorias }) => (
      <optgroup key={grupo} label={grupo}>
        {categorias.map(([valor, titulo]) => (
          <option key={valor} value={valor}>{titulo}</option>
        ))}
      </optgroup>
    ))}
  </>
);

export default OpcionesCategorias;
