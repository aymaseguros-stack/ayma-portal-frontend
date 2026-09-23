import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { fechaHora } from '../../utils/fechas';
import SelectorCompania from './SelectorCompania';
import {
  obtenerRiesgo, guardarRiesgo, enviarACotizar, catalogoNoColocable,
  declararNoColocable, reabrirNoColocable,
  MOTIVO_NO_COLOCABLE_LABEL, MOTIVO_NO_COLOCABLE_OTRO,
} from './riesgoApi';

// C-17 / D-C25 / D-C23: la pestaña "Riesgo" de la ficha de una oportunidad.
//
// EL FORMULARIO LO DESCRIBE EL BACKEND. Cada campo se dibuja desde `campos`
// (clave, título, tipo, opciones, requerido, editable) tal como lo devuelve
// `GET /crm/oportunidades/{id}/riesgo`. No hay acá ninguna lista de campos por
// track, y es a propósito: el catálogo vive en
// app/models/crm/riesgo_catalogos.py y el schema Pydantic se deriva de él, así
// que una tercera copia en el navegador sería la que queda vieja. Un track que
// mañana sume un campo lo muestra esta pantalla sin tocar una línea.
//
// LOS CAMPOS NO EDITABLES SE MUESTRAN IGUAL. El CUIT sale de la empresa
// vinculada y los adjuntos (F931, póliza del tercero) son filas de
// `documentos`: no se tipean acá. Esconderlos haría que la completitud dijera
// 80% sin que se vea qué falta; mostrarlos en gris con su ayuda dice dónde se
// carga cada uno.

const ESTADOS_QUE_ADMITEN_NO_COLOCABLE = ['DATO', 'PROSPECTO'];

// '' significa "no lo toqué" y no viaja; `null` sí viaja y BORRA el campo.
// Distinguirlos es lo que hace que el PUT sea un merge de verdad: mandar todo
// el formulario con los vacíos en '' convertiría cada guardado en un borrado
// silencioso de lo que se cargó desde otra pantalla.
const aValorDeApi = (tipo, crudo) => {
  if (crudo === '' || crudo === undefined) return null;
  if (tipo === 'entero') return Number.parseInt(crudo, 10);
  if (tipo === 'decimal') return Number(crudo);
  if (tipo === 'booleano') return crudo === true || crudo === 'true';
  return crudo;
};

const aValorDeForm = (tipo, valor) => {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'booleano') return valor ? 'true' : 'false';
  return String(valor);
};

const BarraCompletitud = ({ porcentaje }) => (
  <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden" role="presentation">
    <div
      className={`h-full transition-all ${porcentaje >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
      style={{ width: `${Math.max(0, Math.min(100, porcentaje))}%` }}
    />
  </div>
);

const CampoRiesgo = ({ campo, valor, onCambio }) => {
  const comun = 'w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm disabled:opacity-60';
  const id = `riesgo-${campo.clave}`;

  const control = () => {
    if (!campo.editable) {
      return (
        <input
          id={id} type="text" value={valor || ''} disabled readOnly
          placeholder="Se carga fuera de la ficha"
          className={comun}
        />
      );
    }
    if (campo.tipo === 'opcion') {
      return (
        <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)} className={comun}>
          <option value="">Sin especificar</option>
          {campo.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (campo.tipo === 'booleano') {
      // TRES OPCIONES, no un checkbox. `gnc` es un booleano REQUERIDO: `null`
      // cuenta como faltante y `false` NO. Un checkbox no puede expresar "no
      // se declaró todavía", así que toda ficha de un auto sin GNC quedaría
      // incompleta para siempre o completa sin que nadie lo haya dicho.
      return (
        <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)} className={comun}>
          <option value="">Sin declarar</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      );
    }
    const tipoHtml = campo.tipo === 'fecha' ? 'date'
      : (campo.tipo === 'entero' || campo.tipo === 'decimal') ? 'number' : 'text';
    return (
      <input
        id={id}
        type={tipoHtml}
        step={campo.tipo === 'decimal' ? 'any' : undefined}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className={`${comun} ${campo.tipo === 'patente' ? 'font-mono uppercase' : ''}`}
      />
    );
  };

  return (
    <div>
      <label className="block text-slate-400 text-sm mb-1.5" htmlFor={id}>
        {campo.titulo}
        {campo.requerido && <span className="text-blue-400"> *</span>}
        {!campo.editable && <span className="ml-2 text-xs text-slate-500">(sólo lectura)</span>}
      </label>
      {control()}
      {campo.ayuda && <p className="text-slate-500 text-xs mt-1">{campo.ayuda}</p>}
    </div>
  );
};

const RiesgoTab = ({ token, oportunidad, onCambio }) => {
  const oportunidadId = oportunidad.id;
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({});
  const [tocados, setTocados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  // Los faltantes que devolvió un 422 del backend, que puede ver algo que la
  // completitud local no (un adjunto que se anuló entre el GET y el POST).
  const [faltantesDelBackend, setFaltantesDelBackend] = useState(null);

  const [mostrarNoColocable, setMostrarNoColocable] = useState(false);
  const [motivos, setMotivos] = useState(null);
  const [formNc, setFormNc] = useState({ motivo: '', compania: '', detalle: '' });
  const [guardandoNc, setGuardandoNc] = useState(false);
  const [errorNc, setErrorNc] = useState(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerRiesgo(token, oportunidadId);
      setFicha(data);
      const inicial = {};
      for (const campo of data.campos || []) {
        inicial[campo.clave] = aValorDeForm(campo.tipo, data.valores?.[campo.clave]);
      }
      setForm(inicial);
      setTocados({});
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // Se recarga al cambiar de oportunidad. `cargar` se redefine en cada render
  // y meterlo en las dependencias volvería a pedir la ficha en bucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [oportunidadId]);

  const escribibles = useMemo(
    () => (ficha?.campos || []).filter((c) => c.editable),
    [ficha],
  );

  const hayCambios = Object.keys(tocados).length > 0;
  const completitud = ficha?.completitud ?? 0;
  const faltantes = faltantesDelBackend || ficha?.faltantes || [];
  const completa = completitud >= 100;
  const noColocable = Boolean(oportunidad.no_colocable_en);
  const puedeDeclararNoColocable =
    !noColocable && ESTADOS_QUE_ADMITEN_NO_COLOCABLE.includes(oportunidad.estado_crm);

  const cambiar = (clave) => (valor) => {
    setForm((prev) => ({ ...prev, [clave]: valor }));
    setTocados((prev) => ({ ...prev, [clave]: true }));
    setFaltantesDelBackend(null);
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const valores = {};
      for (const campo of escribibles) {
        if (!tocados[campo.clave]) continue;
        valores[campo.clave] = aValorDeApi(campo.tipo, form[campo.clave]);
      }
      const data = await guardarRiesgo(token, oportunidadId, valores);
      setFicha(data);
      setTocados({});
      setFaltantesDelBackend(null);
      setAviso('Ficha guardada');
      // La patente vive en `oportunidades.patente`, no en el JSON: guardarla
      // cambia la tarjeta del Kanban y el buscador, así que la ficha de
      // arriba tiene que releerse.
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const mandarACotizar = async () => {
    setEnviando(true);
    setError(null);
    setAviso(null);
    setFaltantesDelBackend(null);
    try {
      const r = await enviarACotizar(token, oportunidadId);
      setAviso(
        r.cambio
          ? (r.estado_cambio
            ? `Pedido registrado. La oportunidad pasa a ${r.estado_crm} (+${r.puntos} puntos).`
            : `Pedido registrado. El estado queda en ${r.estado_crm}.`)
          : 'La ficha no cambió desde el último envío: el pedido no se duplica.',
      );
      await cargar();
      // La tarjeta pasa a PROSPECTO sin recargar la página: lo recarga el
      // padre, que es el que tiene el pipeline.
      onCambio?.();
    } catch (err) {
      // 422 = ficha incompleta, y el backend manda los faltantes en el
      // detalle. Se muestran como lista, que es lo accionable; "Error 422" a
      // secas manda a adivinar.
      if (err.status === 422) {
        const detalle = String(err.message).replace(/^Error 422:\s*/, '');
        setFaltantesDelBackend(detalle.split(/[;,]\s*/).filter(Boolean));
        setError('La ficha está incompleta: el pedido no se envió.');
      } else {
        setError(err.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  const abrirNoColocable = async () => {
    setErrorNc(null);
    setFormNc({ motivo: '', compania: '', detalle: '' });
    setMostrarNoColocable(true);
    if (motivos) return;
    try {
      const cat = await catalogoNoColocable(token);
      setMotivos(cat.motivos || []);
    } catch (err) {
      // El catálogo es para COTEJAR, no para poder abrir el modal: si no
      // contesta, se dibuja con las etiquetas conocidas y el 422 del backend
      // sigue siendo la última palabra.
      console.warn('[riesgo] no se pudo leer el catálogo de no colocable:', err.message);
      setMotivos(Object.keys(MOTIVO_NO_COLOCABLE_LABEL));
    }
  };

  const confirmarNoColocable = async () => {
    if (!formNc.motivo) { setErrorNc('Elegí un motivo'); return; }
    if (formNc.motivo === MOTIVO_NO_COLOCABLE_OTRO && !formNc.detalle.trim()) {
      setErrorNc('El motivo OTRO pide un detalle: sin él, dentro de seis meses nadie sabe por qué no se colocó');
      return;
    }
    setGuardandoNc(true);
    setErrorNc(null);
    try {
      await declararNoColocable(token, oportunidadId, formNc);
      setMostrarNoColocable(false);
      onCambio?.();
    } catch (err) {
      setErrorNc(err.message);
    } finally {
      setGuardandoNc(false);
    }
  };

  const reabrir = async () => {
    setError(null);
    try {
      const r = await reabrirNoColocable(token, oportunidadId);
      setAviso(r.mensaje);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  };

  if (cargando) return <p className="text-slate-400 text-center py-8">Cargando la ficha de riesgo...</p>;
  if (error && !ficha) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>
    );
  }
  if (!ficha) return null;

  const tituloBotonCotizar = completa
    ? 'Manda el riesgo al mercado y registra el pedido'
    : `Faltan: ${faltantes.join(', ')}`;

  return (
    <div className="space-y-5">
      {/* Completitud + faltantes. El indicador cuenta SÓLO los requeridos: con
          los opcionales adentro, una ficha de AUTO sin versión quedaría en 89%
          para siempre, y un indicador que nunca llega a 100 deja de mirarse. */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Completitud de la ficha ({ficha.track})</span>
          <span className={completa ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>{completitud}%</span>
        </div>
        <BarraCompletitud porcentaje={completitud} />
        {faltantes.length > 0 ? (
          <div className="text-sm text-amber-300/90">
            <p className="text-slate-400 text-xs mb-1">Falta cargar:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {faltantes.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ) : (
          <p className="text-emerald-400/90 text-sm">Lista para mandar a cotizar.</p>
        )}
        {ficha.enviada_a_cotizar_en && (
          <p className="text-xs text-slate-500">
            Enviada a cotizar el {fechaHora(ficha.enviada_a_cotizar_en)}.
            {ficha.cambios_sin_enviar && (
              <span className="text-amber-300"> Hay cambios posteriores sin enviar.</span>
            )}
          </p>
        )}
      </div>

      {noColocable && (
        <div className="bg-slate-700/40 border border-slate-600 text-slate-300 px-4 py-3 rounded-lg text-sm space-y-2">
          <p>
            <span className="font-semibold">No colocable</span>
            {' '}· {MOTIVO_NO_COLOCABLE_LABEL[oportunidad.no_colocable_motivo] || oportunidad.no_colocable_motivo}
            {oportunidad.no_colocable_compania && ` · consultada: ${oportunidad.no_colocable_compania}`}
          </p>
          {oportunidad.no_colocable_detalle && (
            <p className="text-slate-400 text-xs">{oportunidad.no_colocable_detalle}</p>
          )}
          <p className="text-slate-500 text-xs">
            El MERCADO dijo que no: no es un NO del cliente ni una baja. Sale del pipeline y de las
            métricas; la fila no se borra y vuelve con "Reabrir".
          </p>
          <button
            type="button"
            onClick={reabrir}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
          >
            <Icon name="arrow-path" />
            Reabrir: vuelve al pipeline
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}
      {aviso && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-lg text-sm">{aviso}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(ficha.campos || []).map((campo) => (
          <CampoRiesgo
            key={campo.clave}
            campo={campo}
            valor={form[campo.clave] ?? ''}
            onCambio={cambiar(campo.clave)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/60">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !hayCambios}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition text-sm"
        >
          <Icon name="check-badge" />
          {guardando ? 'Guardando...' : 'Guardar ficha'}
        </button>

        {/* DESHABILITADO MIENTRAS FALTE ALGO, con los faltantes en el tooltip.
            El `title` va en un <span> y no en el <button>: un botón
            deshabilitado no dispara eventos de mouse en varios navegadores, o
            sea que el tooltip -que es lo único que explica por qué no se
            puede- no aparecería justo cuando hace falta. */}
        <span title={tituloBotonCotizar}>
          <button
            type="button"
            onClick={mandarACotizar}
            disabled={!completa || enviando || hayCambios || noColocable}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm"
          >
            <Icon name="paper-airplane" />
            {enviando ? 'Enviando...' : 'Enviar a cotizar'}
          </button>
        </span>
        {hayCambios && (
          <span className="self-center text-xs text-amber-300">
            Guardá la ficha antes de mandarla: se envía lo que está guardado.
          </span>
        )}

        {puedeDeclararNoColocable && (
          <button
            type="button"
            onClick={abrirNoColocable}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg transition text-sm ml-auto"
          >
            <Icon name="exclamation-triangle" />
            No colocable
          </button>
        )}
      </div>

      {mostrarNoColocable && (
        <Modal title="El mercado no toma este riesgo" onClose={() => setMostrarNoColocable(false)} maxWidth="max-w-lg" zClass="z-[60]">
          <div className="space-y-5">
            <p className="text-sm text-slate-400">
              Esto NO es una pérdida comercial ni una baja: el cliente no dijo que no, no hubo
              compañía que lo cotizara. Sale del pipeline y de las métricas sin contar como
              cotización perdida, y se puede reabrir.
            </p>

            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="nc-motivo">Motivo *</label>
              <select
                id="nc-motivo"
                value={formNc.motivo}
                onChange={(e) => setFormNc((p) => ({ ...p, motivo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              >
                <option value="">Elegí un motivo</option>
                {(motivos || Object.keys(MOTIVO_NO_COLOCABLE_LABEL)).map((m) => (
                  <option key={m} value={m}>{MOTIVO_NO_COLOCABLE_LABEL[m] || m}</option>
                ))}
              </select>
            </div>

            {/* La compañía consultada es OPCIONAL y sale del padrón: "no la
                toma nadie" y "no la toma San Cristóbal" son dos afirmaciones
                distintas, y la segunda sólo sirve si se puede contar. */}
            <SelectorCompania
              token={token}
              valor={formNc.compania}
              onChange={(v) => setFormNc((p) => ({ ...p, compania: v }))}
              label="Compañía consultada (opcional)"
            />

            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="nc-detalle">
                Detalle {formNc.motivo === MOTIVO_NO_COLOCABLE_OTRO && <span className="text-blue-400">*</span>}
              </label>
              <textarea
                id="nc-detalle"
                rows={3}
                maxLength={500}
                value={formNc.detalle}
                onChange={(e) => setFormNc((p) => ({ ...p, detalle: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>

            {errorNc && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorNc}</div>
            )}

            <div className="flex gap-4">
              <button type="button" onClick={() => setMostrarNoColocable(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarNoColocable}
                disabled={guardandoNc}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {guardandoNc ? 'Marcando...' : 'Marcar no colocable'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default RiesgoTab;
