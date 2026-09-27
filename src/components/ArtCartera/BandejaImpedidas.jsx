import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import BadgeImpedida from './BadgeImpedida';
import { mensajeConflictoResolver } from './artCotizacionesConstants';
import { obtenerImpedidasTrabajoAbierto, resolverImpedida } from './artCotizacionesApi';
import { numeroAr } from './artCarteraConstants';
import { useEsAdmin } from '../../utils/sesion';

// Bandeja de decisión sobre el trabajo abierto de empresas IMPEDIDAS
// (OPERACIONES-0013 · ART-121 FE-2). Vive DENTRO de la tarjeta de Dirección:
// cero rutas y cero menús nuevos.
//
// Fuente: GET /art/admin/impedidas-trabajo-abierto?detalle=true (backend
// #237/#238). Orden y contadores son los del backend: acá no se calcula nada.
//
// Resolver (sólo ADMIN, sólo oportunidad/tarea; un pedido no se resuelve
// por acá): POST .../{tipo}/{item_id}/resolver. Mismo circuito que Armar
// tanda: Previsualizar (dry_run=true) y recién después Confirmar con el MISMO
// body (dry_run=false). Cambiar la decisión o el detalle invalida la
// previsualización; un 409 bloquea Confirmar.

const TIPO_LABEL = { oportunidad: 'Oportunidad', tarea: 'Tarea', pedido_abierto: 'Pedido' };
const TIPOS_RESOLUBLES = new Set(['oportunidad', 'tarea']);
const DECISIONES = ['CERRAR', 'MANTENER'];

const fechaHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

const UltimaResolucion = ({ ultima }) => {
  if (!ultima) return <span className="text-amber-300">Sin decisión</span>;
  return (
    <span data-testid="ultima-resolucion">
      <span className="font-medium text-slate-100">{ultima.decision}</span>
      {' · '}{ultima.por || '—'}
      {' · '}{fechaHora(ultima.en)}
    </span>
  );
};

const Foto = ({ titulo, foto }) => (
  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-xs space-y-1 min-w-0">
    <p className="text-slate-400 uppercase">{titulo}</p>
    {foto && typeof foto === 'object' ? (
      <dl className="grid grid-cols-[auto,1fr] gap-x-2">
        {Object.entries(foto).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200 break-words">{v === null || v === undefined || v === '' ? '—' : String(v)}</dd>
          </React.Fragment>
        ))}
      </dl>
    ) : <p>—</p>}
  </div>
);

const ResolverImpedidaModal = ({ token, item, decisionInicial, onCerrar, onConfirmado }) => {
  const [decision, setDecision] = useState(decisionInicial);
  const [detalle, setDetalle] = useState('');
  const [previa, setPrevia] = useState(null);
  const [conflicto, setConflicto] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const clave = JSON.stringify({ decision, detalle: detalle.trim() });
  const previaVigente = previa && previa.clave === clave;
  const conflictoVigente = conflicto && conflicto.clave === clave;
  const puedeConfirmar = previaVigente && !conflictoVigente && !cargando;

  const llamar = (body, dryRun) => resolverImpedida(
    token, { tipo: item.tipo, itemId: item.item_id, ...body }, { dryRun },
  );

  const previsualizar = async () => {
    setCargando(true);
    setError(null);
    setConflicto(null);
    setPrevia(null);
    try {
      const r = await llamar(JSON.parse(clave), true);
      setPrevia({ clave, respuesta: r });
    } catch (err) {
      if (err.status === 409) setConflicto({ clave, texto: mensajeConflictoResolver(err) });
      else setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    // Doble guarda: sin una previsualización exitosa del MISMO body no se escribe.
    if (!puedeConfirmar) return;
    setCargando(true);
    setError(null);
    try {
      const r = await llamar(JSON.parse(previa.clave), false);
      onConfirmado?.(r);
    } catch (err) {
      if (err.status === 409) setConflicto({ clave: previa.clave, texto: mensajeConflictoResolver(err) });
      else setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const r = previaVigente ? previa.respuesta : null;
  const cascada = Array.isArray(r?.cascada) ? r.cascada : [];

  return (
    <Modal title={`Resolver ${TIPO_LABEL[item.tipo]?.toLowerCase() || item.tipo} · ${item.razon_social || item.cuit || ''}`} onClose={onCerrar}>
      <div className="space-y-4" aria-label="Resolver impedida">
        <div className="text-sm text-slate-300 flex flex-wrap items-center gap-2">
          <span>CUIT {item.cuit || '—'} · {item.estado}</span>
          <BadgeImpedida impedimento={item.impedimento} />
        </div>
        <fieldset className="flex gap-4 text-sm">
          <legend className="text-xs text-slate-400 mb-1">Decisión</legend>
          {DECISIONES.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="radio" name="decision-impedida" value={d} checked={decision === d} onChange={() => setDecision(d)} />
              {d}
            </label>
          ))}
        </fieldset>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="ri-detalle">Detalle (opcional)</label>
          <textarea
            id="ri-detalle"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            maxLength={500}
            rows={2}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={previsualizar}
            disabled={cargando}
            className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm font-medium disabled:opacity-50"
          >
            Previsualizar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-medium disabled:opacity-50"
          >
            {cargando && previaVigente ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>

        {previa && !previaVigente && (
          <p className="text-sm text-amber-300">La decisión cambió después de previsualizar: volvé a previsualizar.</p>
        )}
        {conflictoVigente && (
          <p role="alert" className="text-sm text-red-200 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2" data-testid="conflicto-resolver">
            {conflicto.texto}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        {r && (
          <div className="space-y-3 border border-amber-500/40 rounded-xl p-3" aria-label="Previsualización de la resolución">
            <p className="text-amber-300 text-sm font-medium">Previsualización — todavía no se escribió nada.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Foto titulo="Antes" foto={r.antes} />
              <Foto titulo="Después" foto={r.despues} />
            </div>
            <div className="text-xs text-slate-300" data-testid="cascada-resolver">
              {cascada.length === 0 ? (
                <p className="text-slate-500">Sin tareas en cascada.</p>
              ) : (
                <>
                  <p>Tareas que se cancelarían: {cascada.length}</p>
                  <ul className="mt-1 space-y-0.5">
                    {cascada.map((c) => (
                      <li key={c.item_id}>
                        {c.antes?.titulo || c.item_id}: {c.antes?.estado || '—'} → {c.despues?.estado || '—'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const BandejaImpedidas = ({ token, onResuelto }) => {
  const esAdmin = useEsAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [resolviendo, setResolviendo] = useState(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    obtenerImpedidasTrabajoAbierto(token, { detalle: true })
      .then((r) => { if (!cancelado) { setData(r); setError(null); } })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token, version]);

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="mt-3 space-y-2" data-testid="bandeja-impedidas">
      {error && <p role="alert" className="text-sm text-red-300">No se pudo cargar la bandeja. {error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Cargando casos…</p>}
      {data && (
        <p className="text-sm text-slate-200" data-testid="pendientes-de-decision">
          Pendientes de decisión: <span className="font-semibold">{numeroAr(data.pendientes_de_decision ?? 0)}</span>
          <span className="text-slate-500"> · {numeroAr(items.length)} casos</span>
        </p>
      )}
      {data && items.length === 0 && <p className="text-sm text-slate-300">No hay casos abiertos.</p>}
      {items.length > 0 && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 sticky top-0 bg-slate-800">
              <tr>
                <th className="px-2 py-1">Razón social</th>
                <th className="px-2 py-1">CUIT</th>
                <th className="px-2 py-1">Tipo</th>
                <th className="px-2 py-1">Estado</th>
                <th className="px-2 py-1">Impedimento</th>
                <th className="px-2 py-1">En pool</th>
                <th className="px-2 py-1">Antigüedad</th>
                <th className="px-2 py-1">Última resolución</th>
                {esAdmin && <th className="px-2 py-1">Decidir</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={`${it.tipo}:${it.item_id}`} className="border-t border-slate-700 text-slate-300" data-testid="fila-impedida">
                  <td className="px-2 py-1 text-slate-100">{it.razon_social || '—'}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{it.cuit || '—'}</td>
                  <td className="px-2 py-1">{TIPO_LABEL[it.tipo] || it.tipo}</td>
                  <td className="px-2 py-1">{it.estado || '—'}</td>
                  <td className="px-2 py-1"><BadgeImpedida impedimento={it.impedimento} /></td>
                  <td className="px-2 py-1">{it.en_pool ? 'Sí' : 'No'}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {it.antiguedad_dias === null || it.antiguedad_dias === undefined ? '—' : `${numeroAr(it.antiguedad_dias)} días`}
                  </td>
                  <td className="px-2 py-1"><UltimaResolucion ultima={it.ultima_resolucion} /></td>
                  {esAdmin && (
                    <td className="px-2 py-1 whitespace-nowrap">
                      {TIPOS_RESOLUBLES.has(it.tipo) && DECISIONES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setResolviendo({ item: it, decision: d })}
                          className="mr-1 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                        >
                          {d}
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {resolviendo && (
        <ResolverImpedidaModal
          token={token}
          item={resolviendo.item}
          decisionInicial={resolviendo.decision}
          onCerrar={() => setResolviendo(null)}
          onConfirmado={() => {
            setResolviendo(null);
            setVersion((v) => v + 1);
            onResuelto?.();
          }}
        />
      )}
    </div>
  );
};

export default BandejaImpedidas;
