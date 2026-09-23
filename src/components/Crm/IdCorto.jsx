import React, { useState } from 'react';

// C-6m: el `id_corto` (los 8 primeros del id), copiable de un clic.
//
// POR QUÉ COPIABLE Y NO SÓLO VISIBLE. El identificador se usa para pegarlo en
// un WhatsApp, en un mail a la compañía o en el buscador de otra pantalla. Un
// identificador que hay que transcribir a mano se transcribe mal, y un
// buscador que devuelve vacío por un dígito cambiado se lee como "esa
// oportunidad no está cargada" -que es exactamente el modo de falla que C-6m
// vino a cerrar-.
//
// NO SE CALCULA ACÁ: el valor lo manda el backend en `id_corto` (calculado al
// serializar, no persistido). El corte a 8 local es sólo el fallback para una
// respuesta vieja que no lo traiga.
const IdCorto = ({ valor, idCompleto, className = '' }) => {
  const texto = valor || (idCompleto ? String(idCompleto).slice(0, 8) : null);
  const [copiado, setCopiado] = useState(false);
  if (!texto) return null;

  const copiar = async (e) => {
    // La ficha se abre con un clic en la tarjeta: sin esto, copiar el id
    // abriría además el modal.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin permiso de portapapeles (contexto no seguro) el id sigue a la
      // vista y se puede seleccionar a mano: no se muestra un error por algo
      // que no impide leerlo.
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={`Copiar el ID ${texto}`}
      aria-label={`Copiar el ID ${texto}`}
      className={`font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-900 transition ${className}`}
    >
      {copiado ? 'copiado' : texto}
    </button>
  );
};

export default IdCorto;
