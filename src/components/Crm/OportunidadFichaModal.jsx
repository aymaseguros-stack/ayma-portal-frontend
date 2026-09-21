import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { Dato } from './FichaHelpers';
import { authHeader, formatApiError } from '../../utils/api';
import { fechaCorta, fechaHora } from '../../utils/fechas';
import Timeline from './Timeline';
import DocumentosTab from './DocumentosTab';
import { SelectorAdjuntos, AvisoSubidaFallida, AvisoDuplicadosAdjuntos } from './AdjuntosUI';
import { subirAdjuntos } from './adjuntosApi';
import { nombreDeEmpresa, contactosDeEmpresa, etiquetaTitularConReferencia } from './empresasApi';
import CotizacionEntregadaModal from './CotizacionEntregadaModal';
import TransicionEstadoModal from './TransicionEstadoModal';
import {
  ESTADO_CRM_BADGE, CANALES_VALIDOS, MOTIVOS_PERDIDA_VALIDOS,
  ACTO_A_ESTADO, ACTO_LABEL, formatMoneda,
} from './oportunidadConstants';
import { interaccionesQueParecenActo } from './actosAMano';
import DeclaracionLoop from './DeclaracionLoop';
import { FORM_LOOP_VACIO, payloadLoop, validarLoop } from './declaracionLoop';
import SelectorCompania from './SelectorCompania';
import IdentificacionRiesgo from './IdentificacionRiesgo';
import { etiquetaOrigen, FUENTE_AHORRO_LABEL, RESULTADO_LOOP_LABEL } from './oportunidadCatalogos';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Dónde se ofrece "Registrar cotización entregada". El acto COTIZACION lleva
// a POTENCIAL, así que los estados desde los que se entrega una cotización por
// primera vez son DATO y PROSPECTO: ahí es la acción principal del día a día.
const ESTADOS_QUE_COTIZAN = ['DATO', 'PROSPECTO'];

const FICHA_TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'documentos', label: 'Documentos' },
];

// Ficha de una oportunidad puntual: datos, timeline unificado (interacciones +
// tareas) y tareas propias, con acciones de registrar interacción y cerrar.
const OportunidadFichaModal = ({ token, oportunidadId, onClose, onChanged }) => {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('datos');

  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [mostrarInteraccion, setMostrarInteraccion] = useState(false);
  const [interaccionForm, setInteraccionForm] = useState({ canal: 'LLAMADA', direccion: 'OUT', asunto: '', resumen: '' });
  const [guardandoInteraccion, setGuardandoInteraccion] = useState(false);
  const [puntosGanados, setPuntosGanados] = useState(null);

  // Adjuntos de la interacción: se eligen en el modal pero se suben DESPUÉS
  // de que la interacción existe (hace falta su id). Si esa subida falla, la
  // interacción ya está guardada y no se pierde: queda el pendiente para
  // reintentar el lote entero.
  const [adjuntosElegidos, setAdjuntosElegidos] = useState([]);
  const [subidaPendiente, setSubidaPendiente] = useState(null);
  const [duplicadosAdjuntos, setDuplicadosAdjuntos] = useState([]);
  const [reintentando, setReintentando] = useState(false);

  // Empresa titular + persona de referencia.
  const [nombreEmpresa, setNombreEmpresa] = useState(null);
  const [mostrarReferencia, setMostrarReferencia] = useState(false);
  const [refResultados, setRefResultados] = useState([]);
  const [refQuery, setRefQuery] = useState('');
  const [refVinculadas, setRefVinculadas] = useState([]);
  const [guardandoReferencia, setGuardandoReferencia] = useState(false);

  // Pipeline dirigido por actos (backend PR #176). Acá NO hay un selector de
  // `estado_crm`: el estado se deriva del acto registrado. Lo único explícito
  // son LOOP y RECUPERABLE, cada uno con sus campos obligatorios.
  const [mostrarCotizacion, setMostrarCotizacion] = useState(false);
  const botonCotizacionRef = useRef(null);
  const [transicionDestino, setTransicionDestino] = useState(null);
  const [avisoPipeline, setAvisoPipeline] = useState(null);

  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [cierreForm, setCierreForm] = useState({
    resultado: 'GANADA', motivo_perdida: '', motivo_perdida_detalle: '', compania_ganadora: '',
    // D-B8: el cierre PERDIDA es UNA DE LAS CUATRO PUERTAS A LOOP, y es la
    // que más se usa para registrar el NO que la compañía actual defendió
    // bajando la tarifa. Sin `resultado_loop` el backend contesta 409.
    ...FORM_LOOP_VACIO,
  });
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const cargarDetalle = async () => {
    const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}`, { headers });
    if (!res.ok) throw new Error('Error ' + res.status);
    setDetalle(await res.json());
  };

  useEffect(() => {
    setLoading(true);
    cargarDetalle().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidadId]);

  useEffect(() => {
    if (!detalle?.empresa_id) return undefined;
    let vigente = true;
    nombreDeEmpresa(token, detalle.empresa_id).then((n) => { if (vigente) setNombreEmpresa(n); });
    contactosDeEmpresa(token, detalle.empresa_id).then((l) => { if (vigente) setRefVinculadas(l); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle?.empresa_id]);

  useEffect(() => {
    if (!refQuery.trim()) { setRefResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(refQuery)}`, { headers: authHeader(token) });
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();
        setRefResultados(data.personas || []);
      } catch (err) {
        console.error('Error buscando contacto de referencia:', err);
        setRefResultados([]);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refQuery]);

  // El backend acepta persona_id en PATCH /crm/oportunidades/{id}
  // (OportunidadUpdate), así que el contacto de referencia se puede agregar o
  // cambiar sobre una oportunidad ya creada sin tocar la empresa titular.
  const guardarReferencia = async (persona) => {
    setGuardandoReferencia(true);
    setErrorAccion(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ persona_id: persona ? persona.id : null }),
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      setMostrarReferencia(false);
      setRefQuery('');
      await cargarDetalle();
      onChanged?.();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setGuardandoReferencia(false);
    }
  };

  // Un lote pendiente se reintenta entero: la subida es atómica por lote.
  const subirLote = async (interaccionId, elegidos) => {
    const { duplicados } = await subirAdjuntos(token, elegidos, { interaccion_id: interaccionId });
    setDuplicadosAdjuntos(duplicados);
  };

  const reintentarSubida = async () => {
    if (!subidaPendiente) return;
    setReintentando(true);
    try {
      await subirLote(subidaPendiente.interaccionId, subidaPendiente.elegidos);
      setSubidaPendiente(null);
      await cargarDetalle();
      setTimelineRefreshKey(k => k + 1);
    } catch (err) {
      setSubidaPendiente(prev => ({ ...prev, mensaje: err.message }));
    } finally {
      setReintentando(false);
    }
  };

  const registrarInteraccion = async (e) => {
    e.preventDefault();
    setGuardandoInteraccion(true);
    setErrorAccion(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/interacciones`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          oportunidad_id: oportunidadId,
          canal: interaccionForm.canal,
          direccion: interaccionForm.direccion,
          asunto: interaccionForm.asunto || null,
          resumen: interaccionForm.resumen || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo registrar la interacción');
      }
      const creada = await res.json();
      setPuntosGanados(Number(creada.puntos_scoring || 0));
      setMostrarInteraccion(false);
      setInteraccionForm({ canal: 'LLAMADA', direccion: 'OUT', asunto: '', resumen: '' });
      setDuplicadosAdjuntos([]);
      setSubidaPendiente(null);

      // Primero la interacción, después sus adjuntos con ese id. El backend
      // hereda oportunidad/persona/empresa de la interacción: no se duplica
      // esa lógica acá.
      if (adjuntosElegidos.length > 0) {
        const lote = adjuntosElegidos;
        setAdjuntosElegidos([]);
        try {
          await subirLote(creada.id, lote);
        } catch (errSubida) {
          setSubidaPendiente({ interaccionId: creada.id, elegidos: lote, mensaje: errSubida.message });
        }
      }

      await cargarDetalle();
      setTimelineRefreshKey(k => k + 1);
      onChanged?.();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setGuardandoInteraccion(false);
    }
  };

  const cerrarOportunidad = async (e) => {
    e.preventDefault();
    if (cierreForm.resultado === 'PERDIDA' && !cierreForm.motivo_perdida) {
      setErrorAccion('Elegí un motivo de pérdida');
      return;
    }
    if (cierreForm.resultado === 'PERDIDA') {
      const problema = validarLoop(cierreForm);
      if (problema) { setErrorAccion(problema); return; }
    }
    setGuardandoCierre(true);
    setErrorAccion(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}/cerrar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          resultado: cierreForm.resultado,
          motivo_perdida: cierreForm.resultado === 'PERDIDA' ? cierreForm.motivo_perdida : null,
          motivo_perdida_detalle: cierreForm.resultado === 'PERDIDA' ? (cierreForm.motivo_perdida_detalle || null) : null,
          compania_ganadora: cierreForm.resultado === 'GANADA' ? (cierreForm.compania_ganadora || null) : null,
          ...(cierreForm.resultado === 'PERDIDA' ? payloadLoop(cierreForm) : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo cerrar la oportunidad');
      }
      setMostrarCierre(false);
      await cargarDetalle();
      onChanged?.();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setGuardandoCierre(false);
    }
  };

  const completarTarea = async (tareaId) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/tareas/${tareaId}/completar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      await cargarDetalle();
      onChanged?.();
    } catch (err) {
      alert('No se pudo completar la tarea: ' + err.message);
    }
  };

  // Tras registrar el acto se RECARGA la ficha desde el backend en vez de
  // pintar el estado que devolvió la respuesta: el estado es del servidor, y
  // una ficha que se cree su propio estado es cómo volvería a ser una opinión.
  const refrescarTrasPipeline = async (respuesta, textoBase) => {
    const partes = [textoBase];
    if (respuesta?.idempotente) partes.push('(ya estaba registrada con la misma clave)');
    if (Number(respuesta?.puntos) > 0) partes.push(`+${Number(respuesta.puntos)} puntos`);
    if (respuesta?.seguimiento_id) partes.push('primer seguimiento programado a +24 h');
    if (respuesta?.seguimientos_cancelados > 0) {
      partes.push(`${respuesta.seguimientos_cancelados} seguimiento(s) cancelado(s)`);
    }
    if (respuesta?.detalle) partes.push(respuesta.detalle);
    setAvisoPipeline(partes.filter(Boolean).join(' · '));
    setMostrarCotizacion(false);
    setTransicionDestino(null);
    await cargarDetalle();
    setTimelineRefreshKey((k) => k + 1);
    onChanged?.();
  };

  const cerrada = detalle && detalle.resultado !== 'EN_CURSO';
  const esCliente = detalle?.estado_crm === 'CLIENTE';
  const puedeCotizar = !cerrada && ESTADOS_QUE_COTIZAN.includes(detalle?.estado_crm);

  // Interacciones cuyo asunto delata un acto escrito a mano (ver actosAMano.js).
  // NO se convierten solas: el aviso lleva al botón y decide la persona.
  const actosEscritosAMano = interaccionesQueParecenActo(detalle?.interacciones);
  const irAlBotonDeCotizacion = () => {
    const boton = botonCotizacionRef.current;
    if (!boton) return;
    boton.scrollIntoView({ block: 'center' });
    boton.focus();
  };

  return (
    <Modal
      title={loading ? 'Cargando...' : (detalle?.nombre_vinculado || detalle?.token || 'Oportunidad')}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {loading || !detalle ? (
        <p className="text-slate-400 text-center py-8">Cargando ficha...</p>
      ) : (
        <div className="space-y-6">
          {/* Encabezado */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-blue-400">{detalle.token}</span>
            <span className="px-2 py-1 bg-slate-700 rounded text-xs font-medium">{detalle.track}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_CRM_BADGE[detalle.estado_crm] || 'bg-slate-500/20 text-slate-400'}`}>
              {detalle.estado_crm}
            </span>
            {cerrada && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${detalle.resultado === 'GANADA' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {detalle.resultado}
              </span>
            )}
            <span className="ml-auto font-semibold">{formatMoneda(detalle.prima_estimada)}</span>
          </div>

          {detalle.empresa_id && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <Icon name="building-office" className="text-slate-400" />
              <span>{etiquetaTitularConReferencia(nombreEmpresa, detalle.persona_id ? detalle.nombre_vinculado : null) || 'Empresa'}</span>
              <button
                type="button"
                onClick={() => { setErrorAccion(null); setMostrarReferencia(true); }}
                className="text-blue-400 hover:text-blue-300 text-xs underline"
              >
                {detalle.persona_id ? 'Cambiar contacto de referencia' : 'Agregar contacto de referencia'}
              </button>
            </div>
          )}

          {subidaPendiente && (
            <AvisoSubidaFallida
              mensaje={subidaPendiente.mensaje}
              onReintentar={reintentarSubida}
              reintentando={reintentando}
            />
          )}

          {duplicadosAdjuntos.length > 0 && <AvisoDuplicadosAdjuntos duplicados={duplicadosAdjuntos} />}

          {puedeCotizar && actosEscritosAMano.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-lg text-sm space-y-2">
              <p>
                Hay {actosEscritosAMano.length} interacción(es) con un asunto de acto escrito a mano
                {' '}({actosEscritosAMano.map((x) => ACTO_LABEL[x.acto] || x.acto).filter((v, i, a) => a.indexOf(v) === i).join(', ')}).
                {' '}Una interacción suma +2 y NO mueve el estado: para que la cotización cuente
                hay que registrarla con el botón <strong>Registrar cotización entregada</strong>,
                que guarda compañía y premio, mueve la oportunidad a POTENCIAL y programa el seguimiento.
              </p>
              <ul className="list-disc list-inside text-amber-300/80 text-xs">
                {actosEscritosAMano.slice(0, 3).map((x) => (
                  <li key={x.interaccion.id}>
                    {x.interaccion.asunto}
                    {x.interaccion.fecha && <span className="text-amber-300/60"> · {fechaHora(x.interaccion.fecha)}</span>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={irAlBotonDeCotizacion}
                className="text-amber-100 underline hover:text-white text-sm"
              >
                Ir a "Registrar cotización entregada"
              </button>
              <p className="text-amber-300/60 text-xs">
                La interacción NO se convierte sola: si era sólo una nota, dejala como está.
              </p>
            </div>
          )}

          {avisoPipeline && (
            <div className="bg-blue-500/15 border border-blue-500/40 text-blue-200 px-4 py-2 rounded-lg text-sm">
              {avisoPipeline}
            </div>
          )}

          {puntosGanados !== null && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-lg text-sm">
              +{puntosGanados} puntos de scoring por esta interacción
            </div>
          )}

          {/* Tabs y acciones en DOS filas. Iban en una sola
              (`justify-between`) con la fila de botones en un `flex gap-2`
              SIN `flex-wrap`, dentro de un modal `max-w-3xl` cuyo contenedor
              es `overflow-y-auto` (o sea, recortado en horizontal): con cinco
              botones la fila medía más que el modal y los del medio - entre
              ellos "Registrar cotización entregada" - quedaban fuera de la
              parte visible. El botón estaba en el bundle y en el DOM; no se
              veía. */}
          <div className="space-y-3">
            <div className="flex gap-1 overflow-x-auto">
              {FICHA_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {t.label}
                  {t.id === 'documentos' && detalle.adjuntos_count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-600 rounded text-xs">{detalle.adjuntos_count}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setErrorAccion(null); setMostrarInteraccion(true); }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm whitespace-nowrap"
              >
                <Icon name="chat-bubble" />
                Registrar interacción
              </button>
              {/* Al lado de "Registrar interacción" a propósito: es la acción
                  del día a día y va donde el usuario ya está mirando. */}
              {puedeCotizar && (
                <button
                  ref={botonCotizacionRef}
                  onClick={() => { setErrorAccion(null); setAvisoPipeline(null); setMostrarCotizacion(true); }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition text-sm whitespace-nowrap"
                >
                  <Icon name="document-text" />
                  Registrar cotización entregada
                </button>
              )}
              {!cerrada && (
                <>
                  <button
                    onClick={() => { setErrorAccion(null); setAvisoPipeline(null); setTransicionDestino('LOOP'); }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-600/80 hover:bg-yellow-600 rounded-lg transition text-sm whitespace-nowrap"
                  >
                    <Icon name="clock" />
                    Pasar a LOOP
                  </button>
                  {/* RECUPERABLE es la baja de un CLIENTE y sólo se alcanza desde
                      ahí: ofrecerlo en otro estado sería un 409 asegurado. */}
                  {esCliente && (
                    <button
                      onClick={() => { setErrorAccion(null); setAvisoPipeline(null); setTransicionDestino('RECUPERABLE'); }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-orange-600/80 hover:bg-orange-600 rounded-lg transition text-sm whitespace-nowrap"
                    >
                      <Icon name="exclamation-triangle" />
                      Marcar recuperable
                    </button>
                  )}
                  <button
                    onClick={() => { setErrorAccion(null); setMostrarCierre(true); }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm whitespace-nowrap"
                  >
                    <Icon name="check-badge" />
                    Cerrar oportunidad
                  </button>
                </>
              )}
            </div>
          </div>

          {tab === 'datos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <IdentificacionRiesgo
                token={token}
                oportunidad={detalle}
                onGuardado={async () => { await cargarDetalle(); onChanged?.(); }}
              />
              <Dato label="Etapa SAIDA" valor={detalle.etapa_saida} />
              <Dato label="Origen" valor={etiquetaOrigen(detalle.origen)} />
              <Dato label="Probabilidad de cierre" valor={detalle.probabilidad_cierre !== null && detalle.probabilidad_cierre !== undefined ? `${detalle.probabilidad_cierre}%` : null} />
              <Dato label="Fecha de cierre estimada" valor={detalle.fecha_cierre_estimada} />
              <Dato label="Fecha de alta" valor={fechaCorta(detalle.fecha_alta)} />
              {cerrada && (
                <>
                  <Dato label="Fecha de cierre real" valor={detalle.fecha_cierre_real} />
                  {detalle.resultado === 'PERDIDA' && <Dato label="Motivo de pérdida" valor={detalle.motivo_perdida} />}
                  {detalle.resultado === 'GANADA' && <Dato label="Compañía ganadora" valor={detalle.compania_ganadora} />}
                </>
              )}
              {/* D-B8: lo declarado al entrar a LOOP. Se muestra SIEMPRE que
                  haya `resultado_loop`, no sólo con la oportunidad cerrada:
                  una que volvió de LOOP a POTENCIAL conserva lo que se
                  declaró, y borrarlo de la vista sería perder el antecedente
                  justo cuando se la vuelve a trabajar. */}
              {detalle.resultado_loop && (
                <>
                  <Dato
                    label="Resultado del LOOP"
                    valor={RESULTADO_LOOP_LABEL[detalle.resultado_loop] || detalle.resultado_loop}
                  />
                  {detalle.resultado_loop === 'CON_EFECTO' && (
                    <>
                      <Dato
                        label="Alícuotas (previa → posterior)"
                        valor={
                          detalle.alicuota_previa !== null && detalle.alicuota_previa !== undefined
                            ? `${detalle.alicuota_previa}% → ${detalle.alicuota_posterior}%`
                            : null
                        }
                      />
                      <Dato label="Fuente de la posterior" valor={detalle.alicuota_posterior_fuente} />
                      <Dato label="Ahorro anual generado" valor={formatMoneda(detalle.ahorro_anual_generado)} />
                      <Dato
                        label="Origen del ahorro"
                        valor={detalle.ahorro_fuente ? (FUENTE_AHORRO_LABEL[detalle.ahorro_fuente] || detalle.ahorro_fuente) : null}
                      />
                    </>
                  )}
                </>
              )}
              <Dato label="Notas" valor={detalle.notas} full />
              {/* El estado NO es un campo editable: se deja a la vista de qué
                  acto sale cada etapa, que es lo que reemplaza al desplegable. */}
              <div className="md:col-span-2 text-xs text-slate-500 border-t border-slate-700/60 pt-3">
                El estado se deriva del acto registrado:{' '}
                {Object.entries(ACTO_A_ESTADO).map(([acto, estado], i) => (
                  <span key={acto}>
                    {i > 0 && ' · '}
                    <span className="text-slate-400">{acto}</span> → {estado}
                  </span>
                ))}
                . LOOP y RECUPERABLE son las únicas dos que se piden a mano.
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <Timeline
              key={timelineRefreshKey}
              token={token}
              tipo="oportunidad"
              id={oportunidadId}
              destinatarioEmail={detalle.email}
              oportunidadId={oportunidadId}
            />
          )}

          {tab === 'documentos' && (
            <DocumentosTab
              token={token}
              filtro={{ oportunidad_id: oportunidadId }}
              onCambio={async () => { await cargarDetalle(); onChanged?.(); }}
            />
          )}

          {tab === 'tareas' && (
            detalle.tareas.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sin tareas</p>
            ) : (
              <div className="space-y-2">
                {detalle.tareas.map((t) => (
                  <div key={t.id} className="bg-slate-700/30 rounded-lg p-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.estado === 'COMPLETADA'}
                      disabled={t.estado === 'COMPLETADA'}
                      onChange={() => completarTarea(t.id)}
                      className="w-4 h-4 mt-1 rounded shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${t.estado === 'COMPLETADA' ? 'line-through text-slate-500' : ''}`}>{t.titulo}</span>
                        <span className="text-slate-500 text-xs shrink-0">{fechaHora(t.fecha_programada)}</span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-600 rounded text-xs">{t.prioridad}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Sub-modal: registrar interacción */}
      {mostrarInteraccion && (
        <Modal title="Registrar interacción" onClose={() => setMostrarInteraccion(false)} maxWidth="max-w-md">
          <form onSubmit={registrarInteraccion} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Canal</label>
                <select
                  value={interaccionForm.canal}
                  onChange={(e) => setInteraccionForm(prev => ({ ...prev, canal: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  {CANALES_VALIDOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Dirección</label>
                <select
                  value={interaccionForm.direccion}
                  onChange={(e) => setInteraccionForm(prev => ({ ...prev, direccion: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  <option value="OUT">Saliente</option>
                  <option value="IN">Entrante</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Asunto</label>
              <input
                type="text"
                value={interaccionForm.asunto}
                onChange={(e) => setInteraccionForm(prev => ({ ...prev, asunto: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Resumen</label>
              <textarea
                value={interaccionForm.resumen}
                onChange={(e) => setInteraccionForm(prev => ({ ...prev, resumen: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            <SelectorAdjuntos
              elegidos={adjuntosElegidos}
              onElegidos={setAdjuntosElegidos}
              deshabilitado={guardandoInteraccion}
            />

            {errorAccion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorAccion}</div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarInteraccion(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoInteraccion} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardandoInteraccion ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sub-modal: contacto de referencia */}
      {mostrarReferencia && (
        <Modal title="Contacto de referencia" onClose={() => setMostrarReferencia(false)} maxWidth="max-w-md" zClass="z-[60]">
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              La empresa sigue siendo la titular de la oportunidad; la persona es la referencia.
            </p>
            <div className="relative">
              <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={refQuery}
                onChange={(e) => setRefQuery(e.target.value)}
                placeholder="Buscar persona..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm"
              />
            </div>
            <div className="max-h-56 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-700">
              {(refQuery.trim() ? refResultados : refVinculadas).length === 0 ? (
                <p className="text-slate-500 text-sm p-3">{refQuery.trim() ? 'Sin resultados' : 'Esta empresa no tiene personas vinculadas'}</p>
              ) : (
                (refQuery.trim() ? refResultados : refVinculadas).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    disabled={guardandoReferencia}
                    onClick={() => guardarReferencia(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/60 transition disabled:opacity-50"
                  >
                    <span className="font-medium">{p.nombre} {p.apellido || ''}</span>
                    {p.rol && <span className="text-slate-500 ml-2 text-xs">{p.rol}</span>}
                  </button>
                ))
              )}
            </div>
            {errorAccion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorAccion}</div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarReferencia(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              {detalle?.persona_id && (
                <button
                  type="button"
                  disabled={guardandoReferencia}
                  onClick={() => guardarReferencia(null)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-red-600/40 disabled:opacity-50 rounded-lg transition"
                >
                  Quitar referencia
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Sub-modal: cotización entregada (acto COTIZACION -> POTENCIAL) */}
      {mostrarCotizacion && detalle && (
        <CotizacionEntregadaModal
          token={token}
          oportunidad={{ id: oportunidadId }}
          onCerrar={() => setMostrarCotizacion(false)}
          onRegistrada={(r) => refrescarTrasPipeline(r, 'Cotización entregada registrada')}
        />
      )}

      {/* Sub-modal: LOOP / RECUPERABLE */}
      {transicionDestino && detalle && (
        <TransicionEstadoModal
          token={token}
          oportunidad={{ id: oportunidadId }}
          destino={transicionDestino}
          onCerrar={() => setTransicionDestino(null)}
          onAplicada={(r) => refrescarTrasPipeline(r, `Estado: ${r.estado_anterior} → ${r.estado_crm}`)}
        />
      )}

      {/* Sub-modal: cerrar oportunidad */}
      {mostrarCierre && (
        <Modal title="Cerrar oportunidad" onClose={() => setMostrarCierre(false)} maxWidth="max-w-lg">
          <form onSubmit={cerrarOportunidad} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Resultado</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCierreForm(prev => ({ ...prev, resultado: 'GANADA' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${cierreForm.resultado === 'GANADA' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  Ganada
                </button>
                <button
                  type="button"
                  onClick={() => setCierreForm(prev => ({ ...prev, resultado: 'PERDIDA' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${cierreForm.resultado === 'PERDIDA' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  Perdida
                </button>
              </div>
            </div>

            {cierreForm.resultado === 'GANADA' ? (
              /* LISTA CERRADA (C-16): el backend valida contra el padrón de
                 proveedores y contesta 422 con lo que no esté. Un campo de
                 texto acá es cómo "La Segunda" y "La Segunda ART" terminaban
                 siendo la misma compañía en el tablero de producción. */
              <SelectorCompania
                token={token}
                valor={cierreForm.compania_ganadora}
                onChange={(v) => setCierreForm(prev => ({ ...prev, compania_ganadora: v }))}
                deshabilitado={guardandoCierre}
              />
            ) : (
              <>
                <div>
                  <label className="block text-slate-400 text-sm mb-2" htmlFor="cierre-motivo">Motivo *</label>
                  <select
                    id="cierre-motivo"
                    value={cierreForm.motivo_perdida}
                    onChange={(e) => setCierreForm(prev => ({ ...prev, motivo_perdida: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                    required
                  >
                    <option value="">Elegí un motivo...</option>
                    {MOTIVOS_PERDIDA_VALIDOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2" htmlFor="cierre-detalle">Detalle</label>
                  <textarea
                    id="cierre-detalle"
                    value={cierreForm.motivo_perdida_detalle}
                    onChange={(e) => setCierreForm(prev => ({ ...prev, motivo_perdida_detalle: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                  />
                </div>
                <DeclaracionLoop
                  form={cierreForm}
                  onChange={(campo, valor) => setCierreForm(prev => ({ ...prev, [campo]: valor }))}
                  idPrefijo="cierre"
                  deshabilitado={guardandoCierre}
                />
              </>
            )}

            {errorAccion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorAccion}</div>
            )}

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarCierre(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoCierre} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardandoCierre ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
};

export default OportunidadFichaModal;
