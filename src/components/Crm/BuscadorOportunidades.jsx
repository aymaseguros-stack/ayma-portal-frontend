import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { authHeader, formatApiError } from '../../utils/api';
import { etiquetaOrigen } from './oportunidadCatalogos';
import { ESTADO_CRM_BADGE, formatMoneda } from './oportunidadConstants';
import IdCorto from './IdCorto';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// C-15 / C-6m - encontrar la oportunidad por lo que uno tiene en la mano.
//
// C-6m AGREGÓ LO QUE MÁS SE USA: hasta el PR #194 el `q` del backend miraba
// notas, origen, patente y número de solicitud, así que escribir EL APELLIDO
// del cliente -que es lo primero que uno tiene cuando atiende el teléfono- no
// traía nada. Y un buscador que devuelve vacío no se lee como "buscaste en el
// campo equivocado": se lee como "esa oportunidad no está cargada", y lo que
// sigue es cargarla de nuevo. Ahora mira además la persona, la empresa y el
// id (completo o sus 8 primeros).
//
// UN SOLO CAMPO, NO TRES. El backend tiene filtros propios para `patente` y
// para `numero_solicitud_compania`, pero también busca por los dos dentro del
// `q` general - y es a propósito: el operador que tiene el HAC394 en la mano
// no sabe, ni tiene por qué, en qué campo está guardado. Un buscador que le
// pide elegir primero es un buscador que se usa mal o no se usa.
//
// EL TÉRMINO VIAJA TAL CUAL, SIN NORMALIZAR ACÁ. El `q` del backend ya
// normaliza la patente antes de compararla (y la compara EXACTA: una patente
// es un identificador, un parcial traería dos autos distintos), mientras que
// para las notas, el origen y el número de solicitud usa el texto crudo con
// un LIKE. Normalizar del lado del navegador rompería esas tres: "4-1875"
// saldría como "41875" y no coincidiría con lo que el operador lee en el
// extranet de la compañía.
//
// POR QUÉ NO FILTRA LAS TARJETAS YA CARGADAS: el pipeline sólo trae lo que
// está en una columna visible, y la pregunta "¿cuál era la oportunidad del
// HAC394?" casi siempre es sobre una que ya se cerró.

const BuscadorOportunidades = ({ token, onAbrir }) => {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const termino = texto.trim();
    if (!termino) { setResultados(null); setError(null); return undefined; }

    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL(`${API_URL}/api/v1/crm/oportunidades`);
        url.searchParams.set('q', termino);
        url.searchParams.set('limit', '25');
        const res = await fetch(url.toString(), { headers: authHeader(token) });
        if (!res.ok) throw new Error(await formatApiError(res));
        const data = await res.json();
        if (!vigente) return;
        setResultados(data.items || []);
        setError(null);
      } catch (err) {
        if (!vigente) return;
        setResultados([]);
        setError(err.message);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);

    return () => { vigente = false; clearTimeout(t); };
  }, [texto, token]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          aria-label="Buscar por nombre, ID, patente, N° de solicitud, origen o notas"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, ID, patente, N° de solicitud, origen o notas"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 text-sm"
        />
      </div>

      {texto.trim() && (
        <div className="border border-slate-700 rounded-lg divide-y divide-slate-700 max-h-72 overflow-y-auto">
          {buscando && <p className="text-slate-500 text-sm p-3">Buscando...</p>}
          {!buscando && error && <p className="text-red-300 text-sm p-3">{error}</p>}
          {!buscando && !error && resultados?.length === 0 && (
            <p className="text-slate-500 text-sm p-3">
              Sin resultados. El nombre, el origen y las notas se buscan por partes; la patente y el
              ID, exactos (el ID también por sus 8 primeros). Los acentos cuentan: "Martinez" no
              encuentra a "Martínez".
            </p>
          )}
          {!buscando && !error && (resultados || []).map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => onAbrir(o.id)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700/60 transition flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="font-medium">{o.nombre_vinculado || 'Sin vincular'}</span>
              <IdCorto valor={o.id_corto} idCompleto={o.id} />
              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{o.track}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${ESTADO_CRM_BADGE[o.estado_crm] || 'bg-slate-500/20 text-slate-400'}`}>
                {o.estado_crm}
              </span>
              {o.patente && <span className="font-mono text-xs text-slate-300">{o.patente}</span>}
              {o.numero_solicitud_compania && (
                <span className="font-mono text-xs text-slate-500">sol. {o.numero_solicitud_compania}</span>
              )}
              {o.origen && <span className="text-xs text-slate-500">{etiquetaOrigen(o.origen)}</span>}
              <span className="ml-auto text-xs text-slate-400">{formatMoneda(o.prima_estimada)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuscadorOportunidades;
