import React, { useState } from 'react';
import Modal from '../Modal';
import { correrCervi } from './artCotizacionesApi';
import { OMITIDAS_LABEL, alertaInfo } from './artCerviConstants';
import { decimalAr, numeroAr } from './artCarteraConstants';

const labelClass = 'block text-slate-400 text-xs mb-1';
const thClass = 'text-left px-2 py-1 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const Contadores = ({ c }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="corrida-contadores">
    <dt className="text-slate-400">Candidatas</dt><dd>{numeroAr(c.candidatas)}</dd>
    <dt className="text-slate-400">Propuestas</dt><dd className="font-semibold">{numeroAr(c.propuestas)}</dd>
    {Object.entries(c.omitidas_por_motivo || {}).map(([k, v]) => (
      <React.Fragment key={k}>
        <dt className="text-slate-400">Omitidas · {OMITIDAS_LABEL[k] || k}</dt><dd>{numeroAr(v)}</dd>
      </React.Fragment>
    ))}
    <dt className="text-slate-400">Fuera del límite</dt><dd>{numeroAr(c.fuera_de_limite ?? 0)}</dd>
    <dt className="text-slate-400">Errores</dt><dd>{numeroAr(c.errores ?? 0)}</dd>
  </dl>
);

// "Correr CERVI": siempre dry_run=true primero (el backend no escribe nada,
// ni la corrida) y recién con "Confirmar corrida" dry_run=false con el
// MISMO limit. Un 4xx muestra el `detail` del backend y no se reintenta.
const ArtCorridaCerviModal = ({ token, onCerrar, onCorrida }) => {
  const [limit, setLimit] = useState('50');
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const n = Number(String(limit).trim());
  const limitValido = Number.isInteger(n) && n >= 1;

  const simular = async (e) => {
    e.preventDefault();
    if (!limitValido) { setError('El límite tiene que ser un entero mayor a 0.'); return; }
    setEnviando(true);
    setError(null);
    try {
      setPrevia({ limit: n, respuesta: await correrCervi(token, { limit: n }, { dryRun: true }) });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await correrCervi(token, { limit: previa.limit }, { dryRun: false });
      onCorrida?.(r);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const items = previa?.respuesta?.items || [];

  return (
    <Modal title="Correr CERVI" onClose={onCerrar} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {!previa && (
          <form onSubmit={simular} className="space-y-3" aria-label="Simular corrida">
            <p className="text-sm text-slate-300">
              Propone la dotación por promedio sectorial (Cuadro 1 SRT) para la cola de la próxima tanda.
              Primero se simula: no se escribe nada hasta confirmar. Nunca escribe en la empresa.
            </p>
            <div className="w-32">
              <label className={labelClass} htmlFor="cervi-limit">Límite</label>
              <input
                id="cervi-limit"
                inputMode="numeric"
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">Cancelar</button>
              <button type="submit" disabled={enviando} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
                {enviando ? 'Simulando…' : 'Simular (dry run)'}
              </button>
            </div>
          </form>
        )}
        {previa && (
          <div className="space-y-3">
            <p className="text-sm text-amber-300">
              Simulación (no se escribió nada{previa.respuesta?.escritura === false ? ', escritura=false' : ''}). Confirmá para grabar las propuestas.
            </p>
            <Contadores c={previa.respuesta?.contadores || {}} />
            <div className="overflow-x-auto max-h-80 border border-slate-700 rounded-lg">
              <table className="w-full text-xs" aria-label="Propuestas de la simulación">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className={thClass}>Empresa</th>
                    <th className={thClass}>Vence en</th>
                    <th className={thClass}>CIIU</th>
                    <th className={thClass}>Planilla</th>
                    <th className={thClass}>Prom.</th>
                    <th className={thClass}>Propuesta</th>
                    <th className={thClass}>Tramo</th>
                    <th className={thClass}>Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="px-2 py-4 text-center text-slate-500">La corrida no propondría nada.</td></tr>
                  )}
                  {items.map((it) => (
                    <tr key={it.empresa_id}>
                      <td className="px-2 py-1">{it.razon_social || it.cuit || it.empresa_id}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{it.vence_en_dias === null || it.vence_en_dias === undefined ? '—' : `${it.vence_en_dias} d`}</td>
                      <td className="px-2 py-1">{it.ciiu || '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{it.dotacion_previa === null || it.dotacion_previa === undefined ? '—' : numeroAr(it.dotacion_previa)} <span className="text-slate-500">{it.fuente_previa || ''}</span></td>
                      <td className="px-2 py-1">{decimalAr(it.prom_sector)}</td>
                      <td className="px-2 py-1 font-semibold">{numeroAr(it.valor_propuesto)}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{it.tramo_previo || '—'} → {it.tramo_nuevo || '—'}</td>
                      <td className="px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          {(it.alertas || []).map((a) => {
                            const info = alertaInfo(a);
                            return <span key={a} className={`${badgeBase} ${info.clase}`} title={a}>{info.label}{info.detalle ? ` ${info.detalle}` : ''}</span>;
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={enviando} onClick={() => { setPrevia(null); setError(null); }} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">
                Volver
              </button>
              <button
                type="button"
                disabled={enviando || items.length === 0}
                onClick={confirmar}
                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
              >
                {enviando ? 'Grabando…' : 'Confirmar corrida'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ArtCorridaCerviModal;
