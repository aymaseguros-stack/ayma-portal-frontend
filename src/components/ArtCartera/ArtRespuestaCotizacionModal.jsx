import React, { useState } from 'react';
import Modal from '../Modal';
import { registrarRespuestaCotizacion } from './artCotizacionesApi';
import {
  MOTIVOS_RECHAZO_ART,
  TIPOS_CARGA_RESPUESTA,
  armarBodyRespuesta,
} from './artCotizacionesConstants';
import { aseguradoraLabel } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

const FORM_INICIAL = {
  tipo: '',
  alicuota: '',
  dias_sla: '',
  motivo: '',
  productor_bloqueante: '',
  fecha_respuesta: '',
  nota: '',
};

const tipoLabel = (id) => TIPOS_CARGA_RESPUESTA.find((t) => t.id === id)?.label || id;

// Lo que se muestra en el paso de confirmación: el body que VA a viajar,
// leído campo por campo. No se reformatea la alícuota: es la que tipeó.
const Resumen = ({ body }) => (
  <dl className="text-sm space-y-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3">
    <div className="flex gap-2"><dt className="text-slate-400 w-36">Respuesta</dt><dd>{tipoLabel(body.respuesta)}</dd></div>
    {body.alicuota_pct !== undefined && (
      <div className="flex gap-2"><dt className="text-slate-400 w-36">Alícuota</dt><dd>{String(body.alicuota_pct).replace('.', ',')}%</dd></div>
    )}
    {body.dias_sla !== undefined && (
      <div className="flex gap-2"><dt className="text-slate-400 w-36">SLA técnica</dt><dd>{body.dias_sla} días</dd></div>
    )}
    {body.motivo && (
      <div className="flex gap-2"><dt className="text-slate-400 w-36">Motivo</dt><dd>{body.motivo}</dd></div>
    )}
    {body.productor_bloqueante && (
      <div className="flex gap-2"><dt className="text-slate-400 w-36">Productor</dt><dd>{body.productor_bloqueante}</dd></div>
    )}
    <div className="flex gap-2">
      <dt className="text-slate-400 w-36">Fecha</dt>
      <dd>{body.fecha_respuesta ? fechaCorta(body.fecha_respuesta) : 'hoy (la pone el backend)'}</dd>
    </div>
    {body.nota && (
      <div className="flex gap-2"><dt className="text-slate-400 w-36">Nota</dt><dd>{body.nota}</dd></div>
    )}
  </dl>
);

// "Cargar respuesta" de las bandejas Pedidas y En técnica. Dos pasos: el
// formulario y después el resumen con la confirmación explícita. El
// endpoint no tiene dry_run, así que el resumen es la única red: un 8,5
// tipeado 85 se ve acá o se ve en la tarifa de la empresa.
const ArtRespuestaCotizacionModal = ({ token, par, onCerrar, onRegistrada }) => {
  const [form, setForm] = useState(FORM_INICIAL);
  const [paso, setPaso] = useState('form');
  const [body, setBody] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const revisar = (e) => {
    e.preventDefault();
    const armado = armarBodyRespuesta(par, form);
    if (armado.error) {
      setError(armado.error);
      return;
    }
    setError(null);
    setBody(armado.body);
    setPaso('confirmar');
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const resultado = await registrarRespuestaCotizacion(token, body);
      onRegistrada?.(resultado);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const titulo = `Cargar respuesta · ${aseguradoraLabel(par.aseguradora)}`;

  return (
    <Modal title={titulo} onClose={onCerrar} maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          {par.razon_social || 'Empresa'} · CUIT {par.cuit || 'sin dato'}
          {par.fecha_pedido ? ` · pedida el ${fechaCorta(par.fecha_pedido)}` : ''}
        </p>

        {paso === 'form' && (
          <form onSubmit={revisar} className="space-y-4" aria-label="Respuesta de la compañía">
            <div>
              <label className={labelClass} htmlFor="resp-tipo">Qué contestó la compañía</label>
              <select id="resp-tipo" className={inputClass} value={form.tipo} onChange={set('tipo')}>
                <option value="">Elegí…</option>
                {TIPOS_CARGA_RESPUESTA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {form.tipo === 'ALICUOTA' && (
              <div>
                <label className={labelClass} htmlFor="resp-alicuota">Alícuota (%)</label>
                <input id="resp-alicuota" className={inputClass} inputMode="decimal" value={form.alicuota} onChange={set('alicuota')} placeholder="8,5" />
              </div>
            )}
            {form.tipo === 'TECNICA' && (
              <div>
                <label className={labelClass} htmlFor="resp-sla">Días de SLA de técnica (vacío = el de la compañía)</label>
                <input id="resp-sla" className={inputClass} inputMode="numeric" value={form.dias_sla} onChange={set('dias_sla')} />
              </div>
            )}
            {form.tipo === 'RECHAZADA' && (
              <div>
                <label className={labelClass} htmlFor="resp-motivo">Motivo del rechazo</label>
                <select id="resp-motivo" className={inputClass} value={form.motivo} onChange={set('motivo')}>
                  <option value="">Elegí…</option>
                  {MOTIVOS_RECHAZO_ART.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {form.tipo === 'BLOQUEADA' && (
              <div>
                <label className={labelClass} htmlFor="resp-productor">Productor que tiene el bloqueo</label>
                <input id="resp-productor" className={inputClass} value={form.productor_bloqueante} onChange={set('productor_bloqueante')} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="resp-fecha">Fecha de la respuesta (vacío = hoy)</label>
                <input id="resp-fecha" type="date" className={inputClass} value={form.fecha_respuesta} onChange={set('fecha_respuesta')} />
              </div>
              <div>
                <label className={labelClass} htmlFor="resp-nota">Nota</label>
                <input id="resp-nota" className={inputClass} value={form.nota} onChange={set('nota')} />
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium">
                Revisar
              </button>
            </div>
          </form>
        )}

        {paso === 'confirmar' && body && (
          <div className="space-y-4">
            <p className="text-sm text-amber-300">
              Revisá antes de registrar: la respuesta cierra el pedido y queda en el historial de la empresa.
            </p>
            <Resumen body={body} />
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPaso('form'); setError(null); }}
                disabled={enviando}
                className="px-3 py-2 rounded-lg bg-slate-700 text-sm"
              >
                Volver a editar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
              >
                {enviando ? 'Registrando…' : 'Confirmar y registrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ArtRespuestaCotizacionModal;
