import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { buscarCiiu, MAX_RESULTADOS_CIIU } from '../ArtCartera/artCarteraApi';

export const DEBOUNCE_MS = 300;

const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// Autocompletado contra GET /art/ciiu?q= (bloque D3). Se abre desde el botón
// "cambiar" que está al lado de cualquier CIIU y muestra
// "código — descripción — sección".
//
// DEBOUNCE de 300 ms y NO se dispara con el campo vacío: cada tecla contra un
// catálogo de 948 filas es una consulta de más, y el listado completo sin
// término no ayuda a nadie. El `limit` es el tope duro del backend (50).
//
// `onElegir` en null = modo consulta: el buscador muestra el catálogo pero no
// puede escribir nada. Es el caso de la cartera ART, donde `empresas.ciiu` lo
// escriben los backfills (ARCA/padrón) y no hay endpoint que lo edite a mano;
// con `onElegir` la misma pantalla pasa a ser un selector (CRM, donde
// `ciiu_codigo` sí es un campo editable de la empresa).
const CiiuBuscador = ({ token, onElegir, onCerrar, valorInicial = '' }) => {
  const [q, setQ] = useState(valorInicial ? String(valorInicial) : '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const termino = q.trim();
    if (!termino) {
      setData(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    let cancelado = false;
    setLoading(true);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const resultado = await buscarCiiu(token, termino, { limit: MAX_RESULTADOS_CIIU });
          if (!cancelado) { setData(resultado || {}); setError(null); }
        } catch (err) {
          if (!cancelado) { setError(err.message); setData(null); }
        } finally {
          if (!cancelado) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [token, q]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length;

  return (
    <div className="bg-slate-800/70 rounded-xl border border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon name="magnifying-glass" size={14} />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código (2512) o actividad (tanques)"
            aria-label="Buscar en el catálogo CIIU"
            className={`${inputClass} pl-9`}
          />
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el buscador de CIIU"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <Icon name="x-mark" size={16} />
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-200 text-sm bg-red-500/15 border border-red-500/50 rounded-lg p-2">
          No se pudo consultar el catálogo CIIU. {error}
        </p>
      )}

      {!error && loading && <p className="text-slate-400 text-sm">Buscando...</p>}

      {!error && !loading && q.trim() && items.length === 0 && (
        <p className="text-slate-400 text-sm">Sin coincidencias en el catálogo 2026.</p>
      )}

      {items.length > 0 && (
        <ul className="max-h-64 overflow-y-auto divide-y divide-slate-700 rounded-lg border border-slate-700">
          {items.map((item) => {
            const texto = `${item.codigo} — ${item.descripcion}${item.seccion ? ` — sección ${item.seccion}` : ''}`;
            return (
              <li key={item.codigo}>
                {onElegir ? (
                  <button
                    type="button"
                    onClick={() => onElegir(item)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/60 transition"
                  >
                    {texto}
                  </button>
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-300">{texto}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* `truncado` no es cosmético: sin el aviso, una búsqueda por "fabricación"
          se lee como "el catálogo tiene 50 actividades de fabricación". */}
      {data?.truncado && (
        <p className="text-yellow-200/90 text-xs">
          {total} coincidencias; se muestran las primeras {items.length}. Afiná el término.
        </p>
      )}

      {!onElegir && (
        <p className="text-slate-500 text-xs">
          Consulta del catálogo: el CIIU de la cartera ART lo cargan los procesos de padrón, no se edita desde acá.
        </p>
      )}
    </div>
  );
};

export default CiiuBuscador;
