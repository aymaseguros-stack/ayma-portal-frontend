import React, { useEffect, useState } from 'react';
import BandejaImpedidas from './BandejaImpedidas';
import { obtenerImpedidasTrabajoAbierto } from './artCotizacionesApi';
import { numeroAr } from './artCarteraConstants';
import { motivoCorto, textoComoRevertir } from './artCotizacionesConstants';

// Empresas IMPEDIDAS (OPERACIONES-0012 · ART-115). El criterio es del
// backend (`impedimento_comercial`): estado ARCA excluyente o no_cotizar.
// Acá sólo se muestra el objeto `impedimento` tal cual viene; el motivo va
// crudo ("ESTADO_ARCA:BAJA_OFICIO", "NO_COTIZAR:<motivo>") salvo el prefijo
// ESTADO_ARCA en los resúmenes cortos.

// El badge vive en su propio módulo (la bandeja de decisión lo usa y esta
// tarjeta usa la bandeja); se re-exporta para no mover a quienes ya lo
// importan de acá (FE #94 y #95).
export { default as BadgeImpedida } from './BadgeImpedida';

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

// Tarjeta del resumen de Dirección (ADMIN). Si el endpoint falla, lo dice;
// no pinta ceros. "Revisar casos" (OPERACIONES-0013 FE-2) abre la bandeja de
// decisión DENTRO de la tarjeta: sin rutas ni menús nuevos. Después de una
// resolución firme se vuelven a pedir los contadores.
export const TrabajoAbiertoImpedidas = ({ token }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [bandejaAbierta, setBandejaAbierta] = useState(false);

  useEffect(() => {
    let cancelado = false;
    obtenerImpedidasTrabajoAbierto(token)
      .then((r) => { if (!cancelado) { setData(r); setError(null); } })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token, version]);

  const totales = data?.totales_por_tipo || {};
  const empresas = Array.isArray(data?.empresas) ? data.empresas : [];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4" data-testid="trabajo-abierto-impedidas">
      <h4 className="font-semibold text-white">Trabajo abierto sobre impedidas</h4>
      <p className="text-[11px] text-slate-500">Pool ART sobre empresas con estado ARCA excluyente o no cotizar.</p>
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
                    {' · '}<span className="font-mono text-red-300" title={textoComoRevertir(e.impedimento)}>{e.motivo}</span>
                    {' · '}{TIPOS.map((t) => `${t.label.toLowerCase()} ${e[t.id] ?? 0}`).join(' · ')}
                  </li>
                ))}
              </ul>
          </details>
        </>
      )}
      {data && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setBandejaAbierta((v) => !v)}
            aria-expanded={bandejaAbierta}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium"
          >
            {bandejaAbierta ? 'Ocultar casos' : 'Revisar casos'}
          </button>
          {bandejaAbierta && (
            <BandejaImpedidas token={token} onResuelto={() => setVersion((v) => v + 1)} />
          )}
        </div>
      )}
    </div>
  );
};
