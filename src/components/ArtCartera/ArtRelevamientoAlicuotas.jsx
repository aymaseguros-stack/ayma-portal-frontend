import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerColaAlicuotas, registrarCargaRapidaAlicuotas } from './artCarteraApi';
import { suspendSessionExpiredHandling } from '../../utils/api';
import { numeroAr, decimalAr, dotacionConfianzaInfo } from './artCarteraConstants';

const LIMIT = 20;
const AUTOSAVE_EVERY = 5;
const URL_SRT = 'https://eservicios.srt.gob.ar/Consultas/Alicuotas/Default.aspx';

const parseAlicuota = (valor) => {
  const normalizado = (valor || '').trim().replace(',', '.');
  if (!normalizado) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

const formatDuracion = (segundos) => {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// El 401 llega como Error("Error 401: ...") desde formatApiError (utils/api.js)
// - no hay un campo .status separado, así que se detecta por el prefijo fijo
// que formatApiError siempre antepone.
const es401 = (err) => /^Error 401\b/.test(err?.message || '');

// Relee el token de localStorage en vez de confiar en la prop `token`: si la
// sesión venció a mitad de tanda, el usuario inicia sesión de nuevo en OTRA
// pestaña (mismo localStorage, es el mismo origin) y welcome vuelve acá a
// tocar "Reintentar" - en ese momento localStorage ya tiene el token fresco
// aunque la prop que recibió este componente al montarse siga siendo la vieja.
const tokenVigenteDe = (token) => {
  try {
    return localStorage.getItem('token') || token;
  } catch {
    return token;
  }
};

// Acumula los contadores de sucesivos POST /alicuotas/carga-rapida (uno por
// cada sub-lote autoguardado) para poder mostrar un resumen único de "Tanda
// enviada" al final, con los totales de las 20 empresas y no solo del último
// remanente.
const mergeResultados = (previo, nuevo) => {
  if (!previo) return nuevo;
  return {
    total: previo.total + nuevo.total,
    escritos: previo.escritos + nuevo.escritos,
    sin_dato: previo.sin_dato + nuevo.sin_dato,
    ya_registrados: previo.ya_registrados + nuevo.ya_registrados,
    errores: previo.errores + nuevo.errores,
    items: [...previo.items, ...nuevo.items],
  };
};

const BotonAbrirSRT = () => (
  <a
    href={URL_SRT}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
  >
    <Icon name="arrow-top-right-on-square" size={14} />
    Abrir SRT
  </a>
);

const FooterCompliance = () => (
  <footer className="text-center text-[11px] text-slate-600 border-t border-slate-800 pt-3">
    Alícuotas relevadas por vía telefónica, pendientes de verificación contra el padrón SRT — dato operativo interno,
    no vinculante para el cliente. AYMA Advisors, Productores Asesores de Seguros — Matrícula PAS N° 68323 (SSN). Uso
    interno y confidencial.
  </footer>
);

// Red de seguridad de PROBLEMA 4: panel plegable con TODO lo cargado en esta
// sesión (confirmado o no), más un botón que vuelca todo a texto plano para
// poder recuperarlo a mano si el autoguardado y el envío final fallan los dos.
const PanelCargadosSesion = ({ items, respuestas, confirmados, defaultAbierto = false }) => {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const [copiado, setCopiado] = useState(false);

  const cargados = items
    .filter((it) => respuestas[it.empresa_id])
    .map((it) => ({ it, respuesta: respuestas[it.empresa_id], confirmado: confirmados.has(it.empresa_id) }));

  if (cargados.length === 0) return null;

  const confirmadosCount = cargados.filter((c) => c.confirmado).length;

  const copiarComoTexto = async () => {
    if (!navigator.clipboard) return;
    const texto = cargados
      .map(({ it, respuesta, confirmado }) => {
        const valor = respuesta.sin_dato ? 'SIN DATO' : `${decimalAr(respuesta.alicuota_pct)}%`;
        const estado = confirmado ? 'CONFIRMADO' : 'PENDIENTE DE ENVÍO';
        return `${it.cuit_formateado || it.cuit}\t${it.razon_social}\t${valor}\t${estado}`;
      })
      .join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // portapapeles no disponible (permisos/navegador) - el panel sigue visible igual
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-700/40 transition"
      >
        <span className="text-sm font-semibold text-slate-300">
          Cargados en esta sesión
          <span className="ml-2 text-xs font-normal text-slate-500">
            {confirmadosCount}/{cargados.length} confirmados
          </span>
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className={`text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>
      {abierto && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          <button
            type="button"
            onClick={copiarComoTexto}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium transition"
          >
            <Icon name={copiado ? 'check' : 'clipboard'} size={13} className={copiado ? 'text-green-400' : ''} />
            {copiado ? 'Copiado' : 'Copiar como texto'}
          </button>
          <ol className="divide-y divide-slate-700/70 max-h-64 overflow-y-auto text-sm">
            {cargados.map(({ it, respuesta, confirmado }) => (
              <li key={it.empresa_id} className="flex items-center gap-3 py-2">
                <span className="font-mono text-slate-400 text-xs w-28 shrink-0">{it.cuit_formateado || it.cuit}</span>
                <span className="flex-1 truncate text-slate-300">{it.razon_social}</span>
                <span className="font-mono w-16 text-right shrink-0">
                  {respuesta.sin_dato ? '—' : `${decimalAr(respuesta.alicuota_pct)}%`}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                    confirmado ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {confirmado ? 'Confirmado' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

// "Modo Relevamiento" (BLOQUE 8) - pantalla de carga rápida de alícuotas por
// teléfono, optimizada para velocidad de tipeo: GET /art/cola-alicuotas trae
// una tanda de 20 empresas (ART confirmada por SRT, sin alícuota vigente) y
// POST /art/alicuotas/carga-rapida registra sub-lotes de 5 - ver
// app/services/art_alicuotas.py del backend. Nada se persiste en
// localStorage a propósito (pedido explícito): el buffer vive solo en estado
// de React, con autoguardado incremental cada 5 CUITs (para no depender de
// llegar a los 20), un aviso beforeunload como red de contención extra, un
// cartel bloqueante si el token vence a mitad de tanda (sin desmontar el
// componente ni perder el buffer) y un panel de evidencia exportable como
// última red de seguridad manual.
const ArtRelevamientoAlicuotas = ({ token }) => {
  const [items, setItems] = useState([]);
  const [totalPendientes, setTotalPendientes] = useState(0);
  const [loadingTanda, setLoadingTanda] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [index, setIndex] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(false);
  const [inputEnfocado, setInputEnfocado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // confirmados: empresa_id ya reconocido por el backend en algún sub-lote
  // (autoguardado, manual o el envío final). Es lo que distingue, en la lista
  // lateral y en el panel de evidencia, "confirmado" de "pendiente de envío".
  const [confirmados, setConfirmados] = useState(() => new Set());
  const [enviandoAutoguardado, setEnviandoAutoguardado] = useState(false);
  const [autoguardadoError, setAutoguardadoError] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const [sesionVencida, setSesionVencida] = useState(false);
  const [reintentando, setReintentando] = useState(false);

  const [inicioSesion] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const inputRef = useRef(null);
  const resultadoAcumuladoRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - inicioSesion) / 1000)), 1000);
    return () => clearInterval(t);
  }, [inicioSesion]);

  // Mientras esta pantalla está montada, un 401 propio NO debe disparar el
  // reset global de App.jsx (SESSION_EXPIRED_EVENT -> vuelve al login ->
  // desmonta este componente -> se pierde el buffer). El propio cartel de
  // abajo se encarga de avisar y de ofrecer "Reintentar" sin desmontar nada.
  useEffect(() => {
    const resume = suspendSessionExpiredHandling();
    return resume;
  }, []);

  const cargarTanda = useCallback(async () => {
    setLoadingTanda(true);
    setLoadError(null);
    setSendError(null);
    setResultado(null);
    setEnviando(false);
    setConfirmados(new Set());
    setEnviandoAutoguardado(false);
    setAutoguardadoError(null);
    setSesionVencida(false);
    resultadoAcumuladoRef.current = null;
    retryRef.current = null;
    try {
      const data = await obtenerColaAlicuotas(tokenVigenteDe(token), { limit: LIMIT });
      setItems(data.items || []);
      setTotalPendientes(data.total ?? (data.items || []).length);
      setIndex(0);
      setRespuestas({});
      setInputValue('');
      setInputError(false);
    } catch (err) {
      if (es401(err)) {
        setSesionVencida(true);
        retryRef.current = () => cargarTanda();
      } else {
        setLoadError(err.message);
        setItems([]);
      }
    } finally {
      setLoadingTanda(false);
    }
  }, [token]);

  useEffect(() => { cargarTanda(); }, [cargarTanda]);

  // Sin loteCompleto todavía enviado (ni resultado ni en curso): red de
  // contención para no perder la tanda parcial si se cierra el navegador -
  // a propósito NO se persiste en localStorage (pedido explícito), así que
  // esto sigue siendo necesario incluso con el autoguardado incremental (el
  // sub-lote en curso desde el último corte de 5 todavía no viajó al backend).
  useEffect(() => {
    const hayProgresoSinEnviar = items.length > 0 && !resultado && Object.keys(respuestas).length > 0;
    if (!hayProgresoSinEnviar) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [items, resultado, respuestas]);

  const loteCompleto = items.length > 0 && Object.keys(respuestas).length >= items.length;
  const pantallaActiva = !loteCompleto && !enviando && !resultado && !sesionVencida;

  // Re-enfoca el input de alícuota al volver a esta pestaña (el operador
  // alterna con la pestaña de SRT todo el tiempo) y también cuando cambia de
  // empresa dentro de la tanda. 'focus' de window cubre volver de OTRA
  // ventana/app; 'visibilitychange' cubre volver de OTRA pestaña del mismo
  // navegador (alt-tab entre pestañas no siempre dispara 'focus').
  useEffect(() => {
    if (!pantallaActiva) return undefined;
    const reenfocar = () => inputRef.current?.focus();
    reenfocar();
    const onVisibility = () => { if (document.visibilityState === 'visible') reenfocar(); };
    window.addEventListener('focus', reenfocar);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', reenfocar);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [index, pantallaActiva]);

  const valorPrefill = (idx, mapaRespuestas) => {
    const item = items[idx];
    const previa = item ? mapaRespuestas[item.empresa_id] : null;
    return previa && !previa.sin_dato && previa.alicuota_pct != null ? String(previa.alicuota_pct) : '';
  };

  // Núcleo del autoguardado incremental (PROBLEMA 1): manda solo las
  // respuestas todavía NO confirmadas (sea porque recién se completaron 5, o
  // porque un intento anterior falló y quedaron pendientes). El backend es
  // idempotente por (empresa_id, fecha_evento) - ver
  // app/api/v1/art_consultas.py::registrar_carga_rapida_alicuotas - así que
  // reintentar de más nunca duplica ni rompe nada.
  const enviarSubLote = async (mapaRespuestas, confirmadosActuales, { esFinal = false } = {}) => {
    const pendientes = items.filter(
      (it) => mapaRespuestas[it.empresa_id] && !confirmadosActuales.has(it.empresa_id),
    );
    if (pendientes.length === 0) {
      if (esFinal) setResultado(resultadoAcumuladoRef.current);
      return;
    }
    setEnviandoAutoguardado(true);
    setAutoguardadoError(null);
    if (esFinal) {
      setEnviando(true);
      setSendError(null);
    }
    try {
      const payload = pendientes.map((it) => {
        const r = mapaRespuestas[it.empresa_id];
        return {
          empresa_id: it.empresa_id,
          sin_dato: !!r?.sin_dato,
          ...(r && !r.sin_dato && r.alicuota_pct != null ? { alicuota_pct: r.alicuota_pct } : {}),
        };
      });
      const resp = await registrarCargaRapidaAlicuotas(tokenVigenteDe(token), payload);
      const idsEnviados = pendientes.map((it) => it.empresa_id);
      setConfirmados((prev) => {
        const next = new Set(prev);
        idsEnviados.forEach((id) => next.add(id));
        return next;
      });
      resultadoAcumuladoRef.current = mergeResultados(resultadoAcumuladoRef.current, resp);
      setSesionVencida(false);
      retryRef.current = null;
      if (esFinal) setResultado(resultadoAcumuladoRef.current);
    } catch (err) {
      if (es401(err)) {
        setSesionVencida(true);
        retryRef.current = () => enviarSubLote(mapaRespuestas, confirmadosActuales, { esFinal });
      } else if (esFinal) {
        // El lote completo no se pudo cerrar: se queda en la pantalla de
        // "Reintentar envío" de siempre, con TODAS las respuestas intactas.
        setSendError(err.message);
      } else {
        // Autoguardado fallido (no 401): no se pierde nada, queda en
        // `respuestas` y se reintenta solo en el próximo corte de 5 (o con
        // "Guardar ahora"), porque `confirmadosActuales` no cambió.
        setAutoguardadoError(err.message);
      }
    } finally {
      setEnviandoAutoguardado(false);
      if (esFinal) setEnviando(false);
    }
  };

  const avanzar = (nuevaRespuesta) => {
    const item = items[index];
    const nuevasRespuestas = { ...respuestas, [item.empresa_id]: nuevaRespuesta };
    setRespuestas(nuevasRespuestas);
    setInputError(false);
    const siguiente = index + 1;
    const esUltimo = siguiente >= items.length;
    if (!esUltimo) {
      setIndex(siguiente);
      setInputValue(valorPrefill(siguiente, nuevasRespuestas));
    }
    const completados = Object.keys(nuevasRespuestas).length;
    if (esUltimo) {
      enviarSubLote(nuevasRespuestas, confirmados, { esFinal: true });
    } else if (completados % AUTOSAVE_EVERY === 0) {
      enviarSubLote(nuevasRespuestas, confirmados);
    }
  };

  const confirmarAlicuota = () => {
    const numero = parseAlicuota(inputValue);
    if (numero === null) { setInputError(true); return; }
    avanzar({ alicuota_pct: numero, sin_dato: false });
  };

  const marcarSinDato = () => avanzar({ alicuota_pct: null, sin_dato: true });

  const volverAlAnterior = () => {
    if (index === 0) return;
    const anterior = index - 1;
    setIndex(anterior);
    setInputValue(valorPrefill(anterior, respuestas));
    setInputError(false);
  };

  // Botón manual "Guardar ahora" (PROBLEMA 1): corta en cualquier momento,
  // no solo en los cortes de 5, mandando lo que haya quedado sin confirmar.
  const guardarAhora = () => {
    const completos = Object.keys(respuestas).length;
    const esUltimo = items.length > 0 && completos >= items.length;
    enviarSubLote(respuestas, confirmados, { esFinal: esUltimo });
  };

  const reintentarEnvio = async () => {
    if (!retryRef.current) return;
    setReintentando(true);
    try {
      await retryRef.current();
    } finally {
      setReintentando(false);
    }
  };

  const onKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmarAlicuota();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      marcarSinDato();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      volverAlAnterior();
    }
  };

  const copiarCuit = async () => {
    const item = items[index];
    if (!item?.cuit || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(item.cuit);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // portapapeles no disponible (permisos/navegador) - no rompe el flujo de tipeo
    }
  };

  // --- Estados sin tanda activa (carga / error / cola vacía) ---

  if (loadingTanda) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center text-slate-500 animate-pulse">
          Cargando tanda de empresas...
        </div>
        <FooterCompliance />
      </div>
    );
  }

  // PROBLEMA 2: cartel bloqueante de sesión vencida. Tiene prioridad sobre
  // cualquier otro estado (error de carga, tanda en curso, envío final) para
  // que un 401 en cualquier llamada de esta pantalla termine siempre acá, sin
  // redirigir al login ni desmontar el componente - el buffer completo
  // (`respuestas`/`confirmados`) sigue intacto en estado de React.
  if (sesionVencida) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-red-500/15 border-2 border-red-500/60 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Icon name="lock-closed" size={26} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-100">Sesión vencida</h3>
              <p className="text-red-200 text-sm mt-1">
                Volvé a iniciar sesión en otra pestaña y tocá &quot;Reintentar&quot;. Tu trabajo cargado hasta ahora
                ({Object.keys(respuestas).length} de {items.length}) está intacto y no se pierde.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reintentarEnvio}
            disabled={reintentando}
            className="px-6 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-semibold transition"
          >
            {reintentando ? 'Reintentando...' : 'Reintentar envío'}
          </button>
        </div>
        <PanelCargadosSesion items={items} respuestas={respuestas} confirmados={confirmados} defaultAbierto />
        <FooterCompliance />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-200 text-sm">No se pudo cargar la tanda de empresas. {loadError}</p>
            <button
              type="button"
              onClick={cargarTanda}
              className="mt-3 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-sm font-semibold transition"
            >
              Reintentar
            </button>
          </div>
        </div>
        <FooterCompliance />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center text-slate-500">
          No hay empresas pendientes de relevamiento en este momento. No es un error: la cola está vacía.
          <div>
            <button
              type="button"
              onClick={cargarTanda}
              className="mt-4 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
            >
              Actualizar
            </button>
          </div>
        </div>
        <FooterCompliance />
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Icon name="check-badge" className="text-green-400" size={28} />
            <h3 className="text-lg font-semibold">Tanda enviada</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{resultado.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-400">{resultado.escritos}</p>
              <p className="text-xs text-slate-400 mt-1">Escritos</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-400">{resultado.sin_dato}</p>
              <p className="text-xs text-slate-400 mt-1">Sin dato</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400">{resultado.ya_registrados}</p>
              <p className="text-xs text-slate-400 mt-1">Ya registrados</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-400">{resultado.errores}</p>
              <p className="text-xs text-slate-400 mt-1">Errores</p>
            </div>
          </div>
          {resultado.errores > 0 && (
            <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 space-y-1">
              {resultado.items.filter((r) => r.error).map((r) => {
                const empresa = items.find((it) => it.empresa_id === r.empresa_id);
                return (
                  <p key={r.empresa_id} className="text-red-200 text-sm">
                    {empresa?.razon_social || r.empresa_id}: {r.error}
                  </p>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={cargarTanda}
            className="w-full py-3 rounded-xl bg-blue-800 hover:bg-blue-700 font-semibold transition"
          >
            Traer otra tanda
          </button>
        </div>
        <PanelCargadosSesion items={items} respuestas={respuestas} confirmados={confirmados} />
        <FooterCompliance />
      </div>
    );
  }

  if (loteCompleto || enviando || sendError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <BotonAbrirSRT />
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center space-y-4">
          {sendError ? (
            <>
              <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3 text-left">
                <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">No se pudo enviar la tanda. {sendError}</p>
              </div>
              <button
                type="button"
                onClick={() => enviarSubLote(respuestas, confirmados, { esFinal: true })}
                className="px-6 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 font-semibold transition"
              >
                Reintentar envío
              </button>
            </>
          ) : (
            <p className="text-slate-400 animate-pulse">Enviando lote ({items.length}/{items.length})...</p>
          )}
        </div>
        <PanelCargadosSesion items={items} respuestas={respuestas} confirmados={confirmados} />
        <FooterCompliance />
      </div>
    );
  }

  // --- Tanda en curso ---

  const actual = items[index];
  const confianza = dotacionConfianzaInfo(actual.dotacion_confianza);
  const confirmadosCount = items.filter((it) => confirmados.has(it.empresa_id)).length;
  const hayPendientesSinConfirmar = items.some(
    (it) => respuestas[it.empresa_id] && !confirmados.has(it.empresa_id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Relevamiento</h2>
          <span className="text-slate-400 text-sm font-mono">{index + 1} / {items.length}</span>
          <span className="inline-flex items-center gap-1.5 text-slate-400 text-sm font-mono">
            <Icon name="clock" size={14} />
            {formatDuracion(elapsedSec)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalPendientes > items.length && (
            <span className="text-slate-500 text-xs">{totalPendientes} en cola total</span>
          )}
          <BotonAbrirSRT />
        </div>
      </div>

      {/* Barra de autoguardado (PROBLEMA 1): estado de confirmación + botón manual siempre disponible */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-800/50 rounded-xl border border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Icon name="check-badge" size={16} className="text-green-400" />
          <span className="text-slate-300">{confirmadosCount}/{items.length} confirmados</span>
          {enviandoAutoguardado && <span className="text-slate-500 animate-pulse ml-2">Guardando...</span>}
        </div>
        <button
          type="button"
          onClick={guardarAhora}
          disabled={enviandoAutoguardado || !hayPendientesSinConfirmar}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition"
        >
          <Icon name="check-badge" size={14} />
          Guardar ahora
        </button>
      </div>

      {autoguardadoError && (
        <div className="bg-amber-500/15 border border-amber-500/50 rounded-lg p-3 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <p className="text-amber-200 text-sm">
            No se pudo autoguardar el último sub-lote ({autoguardadoError}). Los datos siguen acá: se reintenta solo
            en el próximo corte de 5, o tocá &quot;Guardar ahora&quot;.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Card grande con los datos de la empresa actual */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="font-mono text-3xl md:text-4xl font-bold tracking-wide">
                {actual.cuit_formateado || actual.cuit}
              </span>
              <button
                type="button"
                onClick={copiarCuit}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
              >
                <Icon name={copiado ? 'check' : 'clipboard'} size={14} className={copiado ? 'text-green-400' : ''} />
                {copiado ? 'Copiado' : 'Copiar CUIT'}
              </button>
            </div>

            <p className="text-xl font-semibold">{actual.razon_social}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-700">
              <div>
                <p className="text-slate-500 text-xs">ART actual</p>
                <p className="text-sm mt-1">{actual.art_actual || 'Sin dato'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">CIIU</p>
                <p className="text-sm mt-1">{actual.ciiu || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Dotación</p>
                <p className="text-sm mt-1 flex items-center gap-2">
                  {actual.dotacion != null ? numeroAr(actual.dotacion) : 'Sin dato'}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${confianza.badge}`}>
                    {confianza.label}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Última alícuota conocida</p>
                <p className="text-sm mt-1">
                  {actual.ultima_alicuota_conocida != null ? `${decimalAr(actual.ultima_alicuota_conocida)}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Input único, siempre enfocado */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setInputError(false); }}
                onKeyDown={onKeyDownInput}
                onFocus={() => setInputEnfocado(true)}
                onBlur={() => setInputEnfocado(false)}
                placeholder="Alícuota %"
                className={`w-full px-6 py-5 rounded-xl bg-slate-900 border-2 text-center text-4xl font-mono font-bold text-white placeholder-slate-600 focus:outline-none transition ${
                  inputError
                    ? 'border-red-500'
                    : inputEnfocado
                      ? 'border-blue-400 ring-4 ring-blue-400/30'
                      : 'border-blue-500'
                }`}
              />
              <span
                className={`absolute top-2 right-3 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${
                  inputEnfocado ? 'text-blue-300' : 'text-slate-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${inputEnfocado ? 'bg-blue-400' : 'bg-slate-600'}`} />
                {inputEnfocado ? 'Listo para tipear' : 'Sin foco'}
              </span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-slate-500 text-xs">
                Enter avanza · Esc o &quot;Sin dato&quot; marca sin dato · ↑ vuelve al anterior para corregir
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={volverAlAnterior}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition"
                >
                  <Icon name="arrow-left" size={14} />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={marcarSinDato}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
                >
                  Sin dato
                </button>
              </div>
            </div>
          </div>

          <PanelCargadosSesion items={items} respuestas={respuestas} confirmados={confirmados} />
        </div>

        {/* Lista numerada 1..20 de la tanda */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Tanda</h3>
          </div>
          <ol className="divide-y divide-slate-700 max-h-[440px] overflow-y-auto">
            {items.map((it, i) => {
              const respuesta = respuestas[it.empresa_id];
              const confirmado = confirmados.has(it.empresa_id);
              const esActual = i === index;
              return (
                <li
                  key={it.empresa_id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm border-l-4 ${
                    esActual ? 'bg-blue-900/40 border-blue-500' : 'border-transparent'
                  }`}
                >
                  <span className={`w-6 text-right font-mono ${esActual ? 'text-blue-300 font-bold' : 'text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className={`flex-1 truncate ${esActual ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {it.razon_social}
                  </span>
                  <span className="w-4 flex justify-center shrink-0" title={respuesta ? (confirmado ? 'Confirmado' : 'Pendiente de envío') : undefined}>
                    {respuesta && confirmado && respuesta.sin_dato && (
                      <Icon name="x-mark" size={14} className="text-slate-500" />
                    )}
                    {respuesta && confirmado && !respuesta.sin_dato && (
                      <Icon name="check" size={14} className="text-green-400" />
                    )}
                    {respuesta && !confirmado && (
                      <Icon name="clock" size={12} className="text-amber-400" />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <FooterCompliance />
    </div>
  );
};

export default ArtRelevamientoAlicuotas;
