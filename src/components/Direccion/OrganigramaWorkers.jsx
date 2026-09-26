import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import { listarWorkers } from './direccionApi';
import { Cargando, ErrorCarga, EstadoVacio, Panel, botonSecundario, inputClase } from './DireccionComunes';
import {
  CLASES_ESTADO_ORG, LIMITE_WORKERS, ancestrosDe, buscar, construirArbol, expandidosIniciales, todosLosExpandibles,
} from './organigrama';

// Vista Organigrama de Dirección → Gerencias (TECNO-0001 · F1). SOLO
// LECTURA: no edita workers. Ver organigrama.js para el armado del árbol.
const ETIQUETA_ESTADO_ORG = { EN_USO: 'En uso', A_ENCENDER: 'A encender', CATALOGO: 'Catálogo' };
const ORDEN_ESTADO_ORG = ['EN_USO', 'A_ENCENDER', 'CATALOGO'];

const ChipEstadoOrg = ({ valor }) => {
  if (!valor) return null;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${CLASES_ESTADO_ORG[valor] || CLASES_ESTADO_ORG.CATALOGO}`}>
      {ETIQUETA_ESTADO_ORG[valor] || valor}
    </span>
  );
};

const Nodo = ({ nodo, abiertos, coincidencias, onAlternar }) => {
  const tieneHijos = nodo.hijos.length > 0;
  const abierto = tieneHijos && abiertos.has(nodo.clave);
  const esCoincidencia = coincidencias.has(nodo.clave);

  return (
    <li role="treeitem" aria-expanded={tieneHijos ? abierto : undefined} aria-label={nodo.codigo}>
      <div
        data-coincide={esCoincidencia || undefined}
        className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 sm:px-3 transition ${
          esCoincidencia
            ? 'border-amber-400/70 bg-amber-500/10 ring-1 ring-amber-400/50'
            : 'border-slate-700 bg-slate-900/40'
        }`}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => onAlternar(nodo.clave)}
            aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${nodo.codigo}`}
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <Icon name="chevron-down" size={16} className={`transition-transform ${abierto ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-white break-all">{nodo.codigo}</span>
            {nodo.nivel_org && <span className="text-[11px] text-slate-500">{nodo.nivel_org}</span>}
            <ChipEstadoOrg valor={nodo.estado_org} />
            {nodo.gerencia_codigo && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-blue-500/40 bg-blue-500/15 text-blue-200 whitespace-nowrap">
                {nodo.gerencia_codigo}
              </span>
            )}
            {tieneHijos && !abierto && (
              <span className="text-[11px] text-slate-500">{nodo.hijos.length} a cargo</span>
            )}
          </div>
          {nodo.cargo && <p className="text-slate-300 text-sm mt-0.5">{nodo.cargo}</p>}
          {nodo.casilla && <p className="text-slate-400 text-xs mt-0.5 break-all">{nodo.casilla}</p>}
        </div>
      </div>
      {abierto && (
        <ul role="group" className="mt-2 ml-2 pl-2 sm:ml-4 sm:pl-4 border-l border-slate-700 space-y-2">
          {nodo.hijos.map((h) => (
            <Nodo key={h.clave} nodo={h} abiertos={abiertos} coincidencias={coincidencias} onAlternar={onAlternar} />
          ))}
        </ul>
      )}
    </li>
  );
};

const OrganigramaWorkers = ({ token, conmutador }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [termino, setTermino] = useState('');
  const [abiertos, setAbiertos] = useState(() => new Set());

  const arbol = useMemo(() => construirArbol(workers), [workers]);
  const coincidencias = useMemo(() => buscar(arbol.nodos, termino), [arbol, termino]);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const filas = await listarWorkers(token, { limit: LIMITE_WORKERS });
      setWorkers(filas);
      setAbiertos(expandidosIniciales(construirArbol(filas).nodos));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const alternar = (clave) => setAbiertos((prev) => {
    const sig = new Set(prev);
    if (sig.has(clave)) sig.delete(clave); else sig.add(clave);
    return sig;
  });

  // Buscar abre la rama de cada coincidencia (sin cerrar lo que ya estaba
  // abierto: el que busca no pierde el lugar donde estaba mirando).
  const cambiarTermino = (valor) => {
    setTermino(valor);
    const ancestros = ancestrosDe(arbol.nodos, buscar(arbol.nodos, valor));
    if (ancestros.size) setAbiertos((prev) => new Set([...prev, ...ancestros]));
  };

  const porEstado = useMemo(() => {
    const cuenta = {};
    arbol.nodos.forEach((n) => { if (n.estado_org) cuenta[n.estado_org] = (cuenta[n.estado_org] || 0) + 1; });
    return cuenta;
  }, [arbol]);

  const hayArbol = arbol.nodos.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">Gerencias</h2>
          <p className="text-slate-400 text-sm mt-1">Organigrama por línea de reporte, desde @SEBASTIAN. Sólo lectura.</p>
        </div>
        {conmutador}
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="el organigrama" onReintentar={cargar} />}

      {loading ? (
        <Cargando texto="Cargando el organigrama…" />
      ) : !error && !hayArbol ? (
        <Panel>
          <EstadoVacio
            icono="building-office"
            titulo="Todavía no hay organigrama cargado"
            detalle="Ninguna fila de workers tiene nivel de organigrama. Se carga con la semilla (importar-semilla)."
          />
        </Panel>
      ) : !error && (
        <>
          {workers.length >= LIMITE_WORKERS && (
            <div role="status" className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-3 text-amber-100 text-sm">
              Se leyeron {LIMITE_WORKERS} filas, el tope del endpoint: puede haber posiciones que no se ven.
            </div>
          )}

          <Panel>
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <Icon name="magnifying-glass" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    aria-label="Buscar en el organigrama"
                    placeholder="Buscar por nombre, función o casilla"
                    value={termino}
                    onChange={(e) => cambiarTermino(e.target.value)}
                    className={inputClase + ' pl-9'}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" className={botonSecundario + ' flex-1 sm:flex-none whitespace-nowrap'} onClick={() => setAbiertos(todosLosExpandibles(arbol.nodos))}>
                    Expandir todo
                  </button>
                  <button type="button" className={botonSecundario + ' flex-1 sm:flex-none whitespace-nowrap'} onClick={() => setAbiertos(expandidosIniciales(arbol.nodos))}>
                    Hasta N4
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>{arbol.nodos.size} posiciones</span>
                {ORDEN_ESTADO_ORG.filter((e) => porEstado[e]).map((e) => (
                  <span key={e} className="inline-flex items-center gap-1">
                    <ChipEstadoOrg valor={e} /> {porEstado[e]}
                  </span>
                ))}
                {arbol.operativas > 0 && (
                  <span>· {arbol.operativas} operativas sin posición (no se dibujan)</span>
                )}
                {termino.trim() && (
                  <span aria-live="polite" className="text-amber-200">
                    · {coincidencias.size === 0 ? 'Sin coincidencias' : `${coincidencias.size} coincidencia${coincidencias.size === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
            </div>
          </Panel>

          {arbol.raiz ? (
            <ul role="tree" aria-label="Organigrama" className="space-y-2">
              <Nodo nodo={arbol.raiz} abiertos={abiertos} coincidencias={coincidencias} onAlternar={alternar} />
            </ul>
          ) : (
            <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              No está la raíz @SEBASTIAN entre los workers con organigrama: el árbol no se puede armar.
            </div>
          )}

          {arbol.huerfanos.length > 0 && (
            <Panel
              titulo="Sin línea de reporte a la raíz"
              subtitulo="Su reporta_a no existe o no llega a @SEBASTIAN. Se muestran aparte para que no queden escondidas."
            >
              <ul role="tree" aria-label="Posiciones sin línea de reporte" className="p-4 space-y-2">
                {arbol.huerfanos.map((h) => (
                  <Nodo key={h.clave} nodo={h} abiertos={abiertos} coincidencias={coincidencias} onAlternar={alternar} />
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
};

export default OrganigramaWorkers;
