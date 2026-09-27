// C-9d - los dos datos que el <ProximaAccionForm> necesita leer del backend:
// el catálogo (vocabulario y topes) y, sólo cuando hace falta, el track.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  catalogoProximaAccion, trackDeOportunidad, FORM_PROXIMA_ACCION_VACIO, TIPO_LOOP,
  validarProximaAccion, payloadProximaAccion,
} from './proximaAccion';

/** El catálogo, con estado de carga y reintento. */
export const useCatalogoProximaAccion = (token) => {
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    catalogoProximaAccion(token)
      .then((c) => { if (vivo) setCatalogo(c); })
      .catch((err) => { if (vivo) setError(err.message); });
    return () => { vivo = false; };
  }, [token, intento]);

  const reintentar = useCallback(() => { setError(null); setIntento((n) => n + 1); }, []);
  return { catalogo, error, reintentar };
};

/**
 * El track de la oportunidad, para decidir si se muestran las alícuotas.
 *
 * Si el llamador ya lo conoce (`trackConocido`), no se pide nada. Si no, se
 * pide `GET /crm/oportunidades/{id}` UNA sola vez por modal y sólo cuando se
 * elige "Sin próxima acción → LOOP" (`asegurar`): el resto de las acciones no
 * lo necesita. Si falla, `estado='error'` y el LOOP se puede declarar igual
 * salvo CON_EFECTO (lo decide `validarProximaAccion`).
 */
export const useTrackOportunidad = (token, oportunidadId, trackConocido) => {
  const [estado, setEstado] = useState('inactivo');
  const [track, setTrack] = useState(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const pedir = useCallback(() => {
    setEstado('cargando');
    trackDeOportunidad(token, oportunidadId)
      .then((t) => { if (montado.current) { setTrack(t); setEstado('ok'); } })
      .catch(() => { if (montado.current) setEstado('error'); });
  }, [token, oportunidadId]);

  // Se llama al elegir LOOP. Una sola vez por modal: sólo desde 'inactivo'.
  // Un error no se reintenta solo; lo reintenta la persona (`reintentar`).
  const asegurar = useCallback(() => {
    if (trackConocido || !oportunidadId || estado !== 'inactivo') return;
    pedir();
  }, [trackConocido, oportunidadId, estado, pedir]);

  if (trackConocido) return { track: trackConocido, estado: 'ok', asegurar, reintentar: () => {} };
  return { track, estado, asegurar, reintentar: pedir };
};

/**
 * Todo lo que un modal necesita para dibujar el <ProximaAccionForm> y mandar
 * su cuerpo: el estado del formulario, el catálogo, el track y la
 * validación. Los dos modales (toque y tarea) lo usan igual.
 */
export const useProximaAccionForm = ({ token, oportunidadId, trackConocido = null }) => {
  const [form, setForm] = useState(FORM_PROXIMA_ACCION_VACIO);
  const cat = useCatalogoProximaAccion(token);
  const trk = useTrackOportunidad(token, oportunidadId, trackConocido);
  const { asegurar } = trk;

  const set = useCallback((campo, valor) => {
    if (campo === 'tipo' && valor === TIPO_LOOP) asegurar();
    setForm((f) => ({ ...f, [campo]: valor }));
  }, [asegurar]);
  const contexto = {
    plazoAccion: cat.catalogo?.plazo_max_accion_dias,
    plazoRecontacto: cat.catalogo?.plazo_max_recontacto_dias,
    track: trk.track,
    trackEstado: trk.estado,
  };

  return {
    form,
    set,
    catalogo: cat.catalogo,
    catalogoError: cat.error,
    reintentarCatalogo: cat.reintentar,
    track: trk.track,
    trackEstado: trk.estado,
    reintentarTrack: trk.reintentar,
    validar: () => (cat.catalogo
      ? validarProximaAccion(form, contexto)
      : 'Todavía no se cargaron las opciones de próxima acción.'),
    payload: () => payloadProximaAccion(form, { track: trk.track }),
  };
};
