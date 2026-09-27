import React, { useEffect, useState } from 'react';
import { obtenerImpedidasTrabajoAbierto } from './artCotizacionesApi';
import { numeroAr } from './artCarteraConstants';
import { motivoCorto } from './artCotizacionesConstants';

// Empresas IMPEDIDAS (OPERACIONES-0012 · ART-115). El criterio es del
// backend (`impedimento_comercial`): estado ARCA excluyente o no_cotizar.
// Acá sólo se muestra el objeto `impedimento` tal cual viene; el motivo va
// crudo ("ESTADO_ARCA:BAJA_OFICIO", "NO_COTIZAR:<motivo>") salvo el prefijo
// ESTADO_ARCA en los resúmenes cortos.

const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

// Badge rojo de una fila con trabajo abierto sobre una empresa impedida.
// Sin impedimento no renderiza nada: la fila se ve igual que antes.
export const BadgeImpedida = ({ impedimento, className = '' }) => {
  if (!impedimento) return null;
  return (
    <span
      className={`${badgeBase} bg-red-600/30 text-red-200 border border-red-500/50 ${className}`}
      title={impedimento.como_revertir || undefined}
      data-testid="badge-impedida"
    >
      Impedida · {impedimento.motivo}
    </span>
  );
};

// Bloque "Impedidas (N) — no se piden" del armado de tanda.
export const EmpresasImpedidas = ({ lista }) => {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  return (
    <div role="alert" className="text-sm text-red-200 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2" data-testid="empresas-impedidas">
      <p className="font-medium">Impedidas ({lista.length}) — no se piden</p>
      <ul className="mt-1 space-y-1 text-xs">
        {lista.map((imp) => (
          <li key={imp.empresa_id || imp.cuit}>
            <span className="text-red-100">{imp.razon_social || '—'}</span>
            {' · CUIT '}{imp.cuit || '—'}
            {' · '}<span className="font-mono">{imp.motivo}</span>
            {imp.como_revertir && <span className="block text-red-300/80">{imp.como_revertir}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Línea "Excluidas de la cola: N (BAJA_OFICIO x · LIMITADA y)". Con total 0
// no se muestra nada.
export const ExcluidasImpedidas = ({ excluidas }) => {
  const total = Number(excluidas?.total) || 0;
  if (total <= 0) return null;
  const detalle = Object.entries(excluidas.por_motivo || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([motivo, n]) => `${motivoCorto(motivo)} ${n}`)
    .join(' · ');
  return (
    <p className="text-xs text-slate-400" data-testid="excluidas-impedidas">
      Excluidas de la cola: {total}{detalle ? ` (${detalle})` : ''}
    </p>
  );
};

const TIPOS = [
  { id: 'oportunidad', label: 'Oportunidades' },
  { id: 'tarea', label: 'Tareas' },
  { id: 'pedido_abierto', label: 'Pedidos' },
];

// Tarjeta de sólo lectura para el resumen de Dirección (ADMIN). Si el
// endpoint falla, lo dice; no pinta ceros.
export const TrabajoAbiertoImpedidas = ({ token }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerImpedidasTrabajoAbierto(token)
      .then((r) => { if (!cancelado) setData(r); })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token]);

  const totales = data?.totales_por_tipo || {};
  const empresas = Array.isArray(data?.empresas) ? data.empresas : [];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4" data-testid="trabajo-abierto-impedidas">
      <h4 className="font-semibold text-white">Trabajo abierto sobre impedidas</h4>
      <p className="text-[11px] text-slate-500">Pool ART sobre empresas con estado ARCA excluyente o no cotizar. Sólo lectura.</p>
      {error && <p role="alert" className="text-sm text-red-300 mt-2">No se pudo cargar. {error}</p>}
      {!data && !error && <p className="text-sm text-slate-400 mt-2">Cargando…</p>}
      {data && !data.totales_por_tipo && <p className="text-sm text-slate-300 mt-2">Sin dato todavía</p>}
      {data?.totales_por_tipo && empresas.length === 0 && (
        <p className="text-sm text-slate-300 mt-2">Ninguna empresa impedida tiene trabajo abierto.</p>
      )}
      {data?.totales_por_tipo && empresas.length > 0 && (
        <>
          <p className="text-sm text-slate-200 mt-2">
            {TIPOS.map((t) => `${numeroAr(totales[t.id] ?? 0)} ${t.label.toLowerCase()}`).join(' · ')}
            <span className="text-slate-500"> · {numeroAr(data.total_empresas ?? empresas.length)} empresas</span>
          </p>
          <details className="mt-2">
              <summary className="text-xs text-blue-400 cursor-pointer">Ver empresas</summary>
              <ul className="mt-2 space-y-1 text-xs max-h-64 overflow-y-auto">
                {empresas.map((e) => (
                  <li key={e.empresa_id} className="text-slate-300">
                    <span className="text-slate-100">{e.razon_social || '—'}</span>
                    {' · CUIT '}{e.cuit || '—'}
                    {' · '}<span className="font-mono text-red-300" title={e.impedimento?.como_revertir || undefined}>{e.motivo}</span>
                    {' · '}{TIPOS.map((t) => `${t.label.toLowerCase()} ${e[t.id] ?? 0}`).join(' · ')}
                  </li>
                ))}
              </ul>
          </details>
        </>
      )}
    </div>
  );
};
