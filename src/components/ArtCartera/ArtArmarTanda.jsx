import React, { useMemo, useState } from 'react';
import { armarTanda, proponerTanda } from './artCotizacionesApi';
import { CANALES_TANDA, armarBodyTanda, canalLabel } from './artCotizacionesConstants';
import { aseguradoraLabel, numeroAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';
import { useEsAdmin } from '../../utils/sesion';
import ArtDotacionDeclaradaModal from './ArtDotacionDeclaradaModal';

const labelClass = 'block text-slate-400 text-xs mb-1';
const selectClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const N_PROPUESTA = 20;

// Resultado de POST /art/tandas (seco o firme), empresa por empresa. Las
// tres listas las decide el backend: `pedidos` (lo que se pide),
// `impedidas` (ART actual, BLOQUEADA/RECHAZADA vigentes) y `ya_pedidas`
// (AVISO: ya hay un PEDIDA abierto al canal, no se duplica).
const ResultadoTanda = ({ resultado }) => (
  <div className="space-y-3">
    <p className="text-sm text-slate-300">
      {resultado.total_pedidos} pedidos · {resultado.total_impedidas} impedidas ·{' '}
      <span className={resultado.total_ya_pedidas > 0 ? 'text-amber-300 font-semibold' : ''}>
        {resultado.total_ya_pedidas} ya pedidas
      </span>
      {' · '}{canalLabel(resultado.canal)} · envío {fechaCorta(resultado.fecha_envio)}
    </p>
    {resultado.total_ya_pedidas > 0 && (
      <p role="alert" className="text-sm text-amber-200 bg-amber-500/15 border border-amber-500/40 rounded-lg px-3 py-2">
        ⚠ Hay {resultado.total_ya_pedidas} par(es) con un pedido abierto a este canal. No se duplican, pero
        revisá si esa empresa tiene que ir en esta tanda.
      </p>
    )}
    <div className="space-y-2">
      {(resultado.empresas || []).map((emp) => (
        <div key={emp.empresa_id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium text-slate-200">
            {emp.razon_social || emp.cuit || emp.empresa_id}
            {emp.override && <span className={`${badgeBase} ml-2 bg-blue-500/20 text-blue-300`}>selección manual</span>}
          </p>
          <p className="text-xs text-slate-300">
            Se pide a: {emp.pedidos.length
              ? emp.pedidos.map((p) => aseguradoraLabel(p.aseguradora)).join(', ')
              : <span className="text-slate-500">ninguna</span>}
          </p>
          {emp.impedidas.length > 0 && (
            <ul className="text-xs text-red-300 list-disc pl-5">
              {emp.impedidas.map((i) => (
                <li key={i.aseguradora}>{aseguradoraLabel(i.aseguradora)} — {i.motivo || i.estado_vigente}</li>
              ))}
            </ul>
          )}
          {emp.ya_pedidas.length > 0 && (
            <ul className="text-xs text-amber-300 list-disc pl-5">
              {emp.ya_pedidas.map((y) => (
                <li key={y.evento_id}>
                  {aseguradoraLabel(y.aseguradora)} ya pedida el {fechaCorta(y.fecha_pedido)}
                  {y.tanda_id ? ` (tanda #${y.tanda_id})` : ' (pedido suelto)'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  </div>
);

// VISTA 3 - Armar tanda. Tres pasos que NO se pueden saltear:
//   1. Proponer  -> GET /art/tandas/propuesta (sólo lectura).
//   2. Previsualizar -> POST /art/tandas?dry_run=true con la selección.
//   3. Confirmar envío -> el MISMO body con dry_run=false, sólo si el body no
//      cambió desde la previsualización y después de una confirmación
//      explícita. Cambiar un tilde invalida la previsualización.
const ArtArmarTanda = ({ token }) => {
  const esAdmin = useEsAdmin();
  const [canal, setCanal] = useState('SILICON_BROKERS');
  const [propuesta, setPropuesta] = useState(null);
  const [seleccion, setSeleccion] = useState({});
  const [nota, setNota] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const [empresaDotacion, setEmpresaDotacion] = useState(null);

  const items = useMemo(() => (Array.isArray(propuesta?.items) ? propuesta.items : []), [propuesta]);
  const body = useMemo(
    () => armarBodyTanda({ canal, propuesta: items, seleccion, nota }),
    [canal, items, seleccion, nota],
  );
  const bodyJson = JSON.stringify(body);
  const previaVigente = previa && previa.bodyJson === bodyJson;

  // `conservar`: al volver a proponer después de ajustar una dotación, la
  // selección hecha se mantiene para las empresas que siguen en la lista.
  const proponer = async ({ conservar = false } = {}) => {
    setCargando(true);
    setError(null);
    setPrevia(null);
    setConfirmando(false);
    setEnviado(null);
    try {
      const r = await proponerTanda(token, { canal, n: N_PROPUESTA });
      setPropuesta(r);
      setSeleccion((previa) => {
        const inicial = {};
        (r?.items || []).forEach((it) => {
          const propuestas = it.aseguradoras || [];
          const antes = conservar ? previa[it.empresa_id] : null;
          inicial[it.empresa_id] = antes
            ? { incluida: antes.incluida, aseguradoras: propuestas.filter((a) => antes.aseguradoras.includes(a)) }
            : { incluida: false, aseguradoras: [...propuestas] };
        });
        return inicial;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const cambiarCanal = (nuevo) => {
    setCanal(nuevo);
    setPropuesta(null);
    setSeleccion({});
    setPrevia(null);
    setConfirmando(false);
    setEnviado(null);
  };

  const toggleEmpresa = (id) => {
    setConfirmando(false);
    setSeleccion((s) => ({ ...s, [id]: { ...s[id], incluida: !s[id]?.incluida } }));
  };

  const toggleAseguradora = (id, aseg) => {
    setConfirmando(false);
    setSeleccion((s) => {
      const actuales = new Set(s[id]?.aseguradoras || []);
      if (actuales.has(aseg)) actuales.delete(aseg); else actuales.add(aseg);
      return { ...s, [id]: { ...s[id], aseguradoras: [...actuales] } };
    });
  };

  const previsualizar = async () => {
    setCargando(true);
    setError(null);
    setConfirmando(false);
    try {
      const r = await armarTanda(token, body, { dryRun: true });
      setPrevia({ bodyJson, respuesta: r });
    } catch (err) {
      setError(err.message);
      setPrevia(null);
    } finally {
      setCargando(false);
    }
  };

  const confirmarEnvio = async () => {
    // Doble guarda: sin una previsualización del MISMO body no se escribe.
    if (!previaVigente) return;
    setCargando(true);
    setError(null);
    try {
      const r = await armarTanda(token, JSON.parse(previa.bodyJson), { dryRun: false });
      setEnviado(r);
      setPrevia(null);
      setConfirmando(false);
      setPropuesta(null);
      setSeleccion({});
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const seleccionadas = body.empresa_ids.length;

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass} htmlFor="at-canal">Canal</label>
          <select id="at-canal" className={selectClass} value={canal} onChange={(e) => cambiarCanal(e.target.value)}>
            {CANALES_TANDA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => proponer()}
          disabled={cargando}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
        >
          Proponer
        </button>
        <div className="grow min-w-[200px]">
          <label className={labelClass} htmlFor="at-nota">Nota de la tanda</label>
          <input id="at-nota" className={`${selectClass} w-full`} value={nota} maxLength={2000} onChange={(e) => { setNota(e.target.value); setConfirmando(false); }} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      {enviado && (
        <div role="status" className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2">
          <p className="text-green-300 font-medium">
            {enviado.tanda_creada ? `Tanda #${enviado.tanda_id} creada.` : 'No se creó tanda: no había pedidos nuevos.'}
          </p>
          <ResultadoTanda resultado={enviado} />
        </div>
      )}

      {propuesta && (
        <>
          <div className="text-xs text-slate-400 space-y-1">
            <p>
              {propuesta.total} empresas con la ventana abierta (vencen en {propuesta.dias_min_a_vencimiento}+ días) ·
              compañías del canal: {(propuesta.companias_del_canal || []).map(aseguradoraLabel).join(', ')}
            </p>
            <p>
              Excluidas: {propuesta.excluidas_ventana_cerrada} por ventana cerrada · {propuesta.excluidas_pedido_abierto} con
              pedido abierto · {propuesta.excluidas_sin_compania} sin compañía del canal.
            </p>
          </div>
          {propuesta.excluidas_permanencia_total > 0 && (
            <div role="alert" className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <p className="font-medium">
                {propuesta.excluidas_permanencia_total} empresa(s) fuera por permanencia mínima (Res. SRT 46/2018):
              </p>
              <ul className="list-disc pl-5 text-xs mt-1">
                {(propuesta.excluidas_permanencia || []).map((x) => (
                  <li key={x.empresa_id}>
                    {x.empresa || x.cuit || x.empresa_id} — {x.motivo || 'permanencia'}
                    {x.habilitada_desde ? ` · habilitada desde ${fechaCorta(x.habilitada_desde)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className={thClass}><span className="sr-only">Incluir</span></th>
                  <th className={thClass}>Empresa</th>
                  <th className={thClass}>Vencimiento</th>
                  <th className={thClass}>Dotación</th>
                  <th className={thClass}>Aseguradoras a pedir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No hay empresas para proponer en este canal.</td></tr>
                )}
                {items.map((it) => {
                  const sel = seleccion[it.empresa_id] || { incluida: false, aseguradoras: [] };
                  const tildadas = new Set(sel.aseguradoras);
                  return (
                    <tr key={it.empresa_id} className={sel.incluida ? 'bg-blue-500/5' : ''}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Incluir ${it.razon_social || it.empresa_id}`}
                          checked={sel.incluida}
                          onChange={() => toggleEmpresa(it.empresa_id)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <p className="text-slate-200">{it.razon_social || '—'}</p>
                        <p className="text-xs text-slate-500">CUIT {it.cuit || '—'}{it.art_actual_resuelta ? ` · ART actual ${aseguradoraLabel(it.art_actual_resuelta)}` : ''}</p>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-slate-300">
                        {fechaCorta(it.fecha_vencimiento) || '—'}
                        {it.dias_a_vencimiento !== null && it.dias_a_vencimiento !== undefined && (
                          <span className="block text-xs text-slate-500">{it.dias_a_vencimiento} días</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 align-top ${it.dotacion_revisar ? 'bg-amber-500/10' : ''}`} data-dotacion-revisar={it.dotacion_revisar ? 'true' : 'false'}>
                        <p className="text-slate-200">
                          {it.dotacion === null || it.dotacion === undefined ? 'Sin dato' : numeroAr(it.dotacion)}
                          {it.sospechosa && <span className="ml-1 text-red-300" title="Dotación >5.000 — verificar contra F931">⚠</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {it.dotacion_fuente || 'sin fuente'} · confianza {it.dotacion_confianza || '—'}
                        </p>
                        {it.dotacion_revisar && (
                          <span className={`${badgeBase} mt-1 bg-amber-500/20 text-amber-300`}>revisar dotación</span>
                        )}
                        {esAdmin && (
                          <button
                            type="button"
                            onClick={() => setEmpresaDotacion(it)}
                            className="block mt-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Ajustar dotación
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {(it.aseguradoras || []).map((a) => (
                            <label key={a} className="inline-flex items-center gap-1 text-xs text-slate-300">
                              <input
                                type="checkbox"
                                aria-label={`${aseguradoraLabel(a)} para ${it.razon_social || it.empresa_id}`}
                                checked={tildadas.has(a)}
                                disabled={!sel.incluida}
                                onChange={() => toggleAseguradora(it.empresa_id, a)}
                              />
                              {aseguradoraLabel(a)}
                            </label>
                          ))}
                        </div>
                        {(it.impedidas || []).length > 0 && (
                          <p className="text-xs text-red-300 mt-1">
                            Impedidas: {it.impedidas.map(aseguradoraLabel).join(', ')}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-400">{seleccionadas} empresa(s) seleccionada(s)</span>
            <button
              type="button"
              onClick={previsualizar}
              disabled={cargando || seleccionadas === 0}
              className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm font-medium disabled:opacity-50"
            >
              Previsualizar
            </button>
          </div>

          {previa && !previaVigente && (
            <p className="text-sm text-amber-300">La selección cambió después de previsualizar: volvé a previsualizar.</p>
          )}

          {previaVigente && (
            <div className="bg-slate-800 rounded-2xl border border-amber-500/40 p-4 space-y-3" aria-label="Previsualización de la tanda">
              <p className="text-amber-300 font-medium">Previsualización — todavía no se escribió nada.</p>
              <ResultadoTanda resultado={previa.respuesta} />
              {!confirmando ? (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  disabled={cargando || previa.respuesta.total_pedidos === 0}
                  className="px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-medium disabled:opacity-50"
                >
                  Confirmar envío
                </button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <span className="text-sm text-green-200">
                    Se registran {previa.respuesta.total_pedidos} pedidos en una tanda nueva de {canalLabel(canal)}. ¿Confirmás?
                  </span>
                  <button
                    type="button"
                    onClick={confirmarEnvio}
                    disabled={cargando}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
                  >
                    {cargando ? 'Enviando…' : 'Sí, registrar la tanda'}
                  </button>
                  <button type="button" onClick={() => setConfirmando(false)} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {empresaDotacion && (
        <ArtDotacionDeclaradaModal
          token={token}
          empresa={empresaDotacion}
          onCerrar={() => setEmpresaDotacion(null)}
          onGuardada={() => {
            setEmpresaDotacion(null);
            // La dotación cambia la propuesta: se vuelve a pedir, y la
            // previsualización anterior deja de valer.
            proponer({ conservar: true });
          }}
        />
      )}
    </div>
  );
};

export default ArtArmarTanda;
