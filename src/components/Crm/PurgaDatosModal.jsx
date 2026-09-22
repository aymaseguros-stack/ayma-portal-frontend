import React, { useState } from 'react';
import Modal from '../Modal';
import { Icon } from '../Icons';
import { fechaHora } from '../../utils/fechas';
import {
  MOTIVOS_PURGA, MOTIVO_OTRO, PALABRA_CONFIRMACION, purgarSolicitud,
} from './emisionApi';

// "Purgar datos" (C-6i punto 2). SÓLO ADMIN, y no se deshace.
//
// DOS PASOS Y NO UNO, porque el backend exige los dos: la corrida en seco
// devuelve el plan -cuántos campos, cuáles POR NOMBRE, qué archivos- y un
// `simulacion_id` que vale 10 minutos, una sola vez, y sólo para la HUELLA
// de ese plan. Si entre simular y ejecutar llegó otro archivo, el backend
// contesta 409 y hay que volver a mirar. Esta pantalla no puede saltear el
// primer paso ni guardar la credencial para después: el botón de ejecutar
// no existe hasta que hay plan.
//
// EL DRY_RUN NO MUESTRA UN SOLO VALOR, y tampoco acá: lista los NOMBRES de
// los campos. Una pantalla que mostrara el DNI para preguntar si se borra
// el DNI sería una lectura de datos personales con otro nombre, y el
// backend la deja asentada en `auditoria_accesos` igual que a la firme.
//
// TIPEAR "PURGAR" ES EL TERCER CANDADO. El default `dry_run=true` protege
// de quien no leyó la firma del endpoint; el `simulacion_id`, de quien la
// leyó y mandó la firme sin mirar. Ninguno de los dos protege del clic de
// más sobre la pantalla correcta.
const PurgaDatosModal = ({ token, solicitud, referencia, onCerrar, onPurgada }) => {
  const [motivo, setMotivo] = useState('PRUEBA');
  const [detalle, setDetalle] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [plan, setPlan] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [purgando, setPurgando] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const pideDetalle = motivo === MOTIVO_OTRO;
  const detalleFalta = pideDetalle && !detalle.trim();

  const simular = async () => {
    if (simulando) return;                       // guarda de reentrada (H-66)
    if (detalleFalta) {
      setError('Con motivo "Otro" hay que decir de dónde salió el pedido.');
      return;
    }
    setSimulando(true);
    setError(null);
    try {
      setPlan(await purgarSolicitud(token, solicitud.id, {
        motivo, detalle: detalle.trim(), dry_run: true,
      }));
    } catch (err) {
      setError(err.message);
      setPlan(null);
    } finally {
      setSimulando(false);
    }
  };

  const purgar = async () => {
    if (purgando) return;                        // UN SOLO POST POR CLIC (H-66)
    if (!plan?.simulacion_id) return;
    setPurgando(true);
    setError(null);
    try {
      const r = await purgarSolicitud(token, solicitud.id, {
        motivo, detalle: detalle.trim(), simulacion_id: plan.simulacion_id, dry_run: false,
      });
      setResultado(r);
      // LA CREDENCIAL ES DE UN SOLO USO. Se tire lo que se tire, el plan
      // que la contenía ya no sirve: dejarlo en pantalla ofrecería un botón
      // que sólo puede devolver 409.
      setPlan(null);
      if (r?.completa) onPurgada?.(r);
    } catch (err) {
      setError(err.message);
      setPlan(null);
      setConfirmacion('');
    } finally {
      setPurgando(false);
    }
  };

  // El cambio de motivo INVALIDA el plan: la credencial se emitió para ese
  // motivo y ese contenido. Seguir mostrándolo haría creer que se puede
  // ejecutar con un motivo distinto del que se simuló.
  const cambiarMotivo = (valor) => {
    setMotivo(valor);
    setPlan(null);
    setConfirmacion('');
  };

  const habilitado = !!plan?.simulacion_id
    && confirmacion.trim().toUpperCase() === PALABRA_CONFIRMACION
    && !purgando;

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

  return (
    <Modal title="Purgar datos de la solicitud" onClose={onCerrar} maxWidth="max-w-2xl" zClass="z-[60]">
      <div className="space-y-5">
        <div className="bg-red-500/10 border border-red-500/40 text-red-100 px-4 py-3 rounded-lg text-sm space-y-1">
          <p className="font-semibold flex items-center gap-2">
            <Icon name="exclamation-triangle" size={16} />
            Esto borra los datos para siempre y no se puede deshacer.
          </p>
          <p className="text-red-200/90">
            Se van el formulario cifrado, el hash de IP y el user agent del consentimiento, y los
            archivos de Drive. Queda la constancia: la fila de la solicitud, la versión y la fecha
            del consentimiento, y el sha256 de cada archivo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Oportunidad</p>
            <p className="font-mono text-blue-300 break-all">{referencia || solicitud.oportunidad_id}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Solicitud</p>
            <p className="font-mono text-slate-300 break-all text-xs">{solicitud.id}</p>
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="purga-motivo">Motivo *</label>
          <select
            id="purga-motivo"
            value={motivo}
            onChange={(e) => cambiarMotivo(e.target.value)}
            disabled={purgando}
            className={inputClass}
          >
            {MOTIVOS_PURGA.map((m) => (
              <option key={m.valor} value={m.valor}>{m.titulo}</option>
            ))}
          </select>
        </div>

        {pideDetalle && (
          <div>
            <label className="block text-slate-400 text-sm mb-2" htmlFor="purga-detalle">
              De dónde salió el pedido *
            </label>
            <textarea
              id="purga-detalle"
              rows={2}
              value={detalle}
              onChange={(e) => { setDetalle(e.target.value); setPlan(null); setConfirmacion(''); }}
              disabled={purgando}
              className={inputClass}
            />
            <p className="text-slate-500 text-xs mt-1">
              No copies acá el dato que se borra: escribí de dónde viene el pedido.
            </p>
          </div>
        )}

        {!resultado && (
          <button
            type="button"
            onClick={simular}
            disabled={simulando || purgando}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-semibold transition"
          >
            <Icon name="magnifying-glass" size={16} />
            {simulando ? 'Simulando…' : plan ? 'Volver a simular' : 'Simular'}
          </button>
        )}

        {plan && (
          <div className="border border-slate-700 rounded-lg p-4 space-y-3 text-sm">
            <p className="text-white font-medium">Qué se va a borrar</p>
            <ul className="text-slate-300 space-y-1">
              <li>{plan.campos_cifrados} campo(s) del formulario</li>
              <li>{plan.adjuntos_a_purgar} archivo(s), {plan.archivos_en_drive} de ellos en Drive</li>
              {plan.adjuntos_ya_purgados > 0 && (
                <li className="text-slate-500">{plan.adjuntos_ya_purgados} ya estaban purgados</li>
              )}
              <li className="text-slate-400">
                Consentimiento: {plan.consentimiento_ip_hash ? 'hash de IP' : 'sin hash de IP'}
                {plan.consentimiento_user_agent ? ' y user agent' : ''}
              </li>
            </ul>

            {(plan.campos || []).length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-1">
                  Campos (sólo los nombres — esta pantalla no muestra los valores)
                </p>
                <p className="text-slate-300 text-xs break-words">{plan.campos.join(', ')}</p>
              </div>
            )}

            {(plan.adjuntos || []).length > 0 && (
              <ul className="space-y-1">
                {plan.adjuntos.map((a) => (
                  <li key={a.id} className="text-slate-300 text-xs flex gap-2">
                    <span className="truncate flex-1">{a.nombre_original}</span>
                    <span className="text-slate-500">{a.categoria}</span>
                    <span className={a.en_drive ? 'text-slate-500' : 'text-amber-300'}>
                      {a.en_drive ? 'en Drive' : a.subida_estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-slate-500 text-xs">
              La simulación vale hasta {fechaHora(plan.simulacion_vence_en)} y un solo uso. Si llega
              otro archivo antes de ejecutar, hay que volver a simular.
            </p>

            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="purga-confirmacion">
                Escribí {PALABRA_CONFIRMACION} para habilitar el borrado
              </label>
              <input
                id="purga-confirmacion"
                type="text"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                disabled={purgando}
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <button
              type="button"
              onClick={purgar}
              disabled={!habilitado}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition"
            >
              {purgando ? 'Purgando…' : 'Purgar definitivamente'}
            </button>
          </div>
        )}

        {resultado && (
          <div className={`px-4 py-3 rounded-lg text-sm border ${resultado.completa
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
            : 'bg-amber-500/15 border-amber-500/40 text-amber-100'}`}
          >
            <p className="font-medium">
              {resultado.completa
                ? 'Datos purgados.'
                : 'La purga quedó a medias: hay archivos que no se pudieron borrar de Drive.'}
            </p>
            <p className="mt-1">
              {resultado.campos_cifrados} campo(s) y {resultado.adjuntos_purgados?.length || 0} archivo(s) borrados.
            </p>
            {(resultado.archivos_no_borrados || []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {resultado.archivos_no_borrados.map((a) => (
                  <li key={a.adjunto_id}>{a.nombre_original}: {a.motivo}</li>
                ))}
              </ul>
            )}
            {!resultado.completa && (
              <p className="mt-2 text-xs">
                La solicitud NO quedó marcada como purgada a propósito: volvé a correr la purga y
                retoma exactamente lo que faltó.
              </p>
            )}
            {resultado.detalle && <p className="mt-2 text-xs">{resultado.detalle}</p>}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
      </div>
    </Modal>
  );
};

export default PurgaDatosModal;
