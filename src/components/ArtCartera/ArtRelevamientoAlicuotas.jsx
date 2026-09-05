import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerColaAlicuotas, registrarCargaRapidaAlicuotas } from './artCarteraApi';
import { numeroAr, decimalAr, dotacionConfianzaInfo } from './artCarteraConstants';

const LIMIT = 20;
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

// "Modo Relevamiento" (BLOQUE 8) - pantalla de carga rápida de alícuotas por
// teléfono, optimizada para velocidad de tipeo: GET /art/cola-alicuotas trae
// una tanda de 20 empresas (ART confirmada por SRT, sin alícuota vigente) y
// POST /art/alicuotas/carga-rapida registra el lote completo al terminar -
// ver app/services/art_alicuotas.py del backend. Nada se persiste en
// localStorage a propósito (pedido explícito): el lote parcial vive solo en
// estado de React, con un aviso beforeunload como única red de contención
// si se cierra el navegador a mitad de una tanda.
const ArtRelevamientoAlicuotas = ({ token }) => {
  const [items, setItems] = useState([]);
  const [totalPendientes, setTotalPendientes] = useState(0);
  const [loadingTanda, setLoadingTanda] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [index, setIndex] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const [inicioSesion] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const inputRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - inicioSesion) / 1000)), 1000);
    return () => clearInterval(t);
  }, [inicioSesion]);

  const cargarTanda = useCallback(async () => {
    setLoadingTanda(true);
    setLoadError(null);
    setSendError(null);
    setResultado(null);
    setEnviando(false);
    try {
      const data = await obtenerColaAlicuotas(token, { limit: LIMIT });
      setItems(data.items || []);
      setTotalPendientes(data.total ?? (data.items || []).length);
      setIndex(0);
      setRespuestas({});
      setInputValue('');
      setInputError(false);
    } catch (err) {
      setLoadError(err.message);
      setItems([]);
    } finally {
      setLoadingTanda(false);
    }
  }, [token]);

  useEffect(() => { cargarTanda(); }, [cargarTanda]);

  // Sin loteCompleto todavía enviado (ni resultado ni en curso): red de
  // contención para no perder la tanda parcial si se cierra el navegador -
  // a propósito NO se persiste en localStorage (pedido explícito), así que
  // esto es lo único que protege el trabajo ya tipeado.
  useEffect(() => {
    const hayProgresoSinEnviar = items.length > 0 && !resultado && Object.keys(respuestas).length > 0;
    if (!hayProgresoSinEnviar) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [items, resultado, respuestas]);

  const loteCompleto = items.length > 0 && Object.keys(respuestas).length >= items.length;

  useEffect(() => {
    if (!loteCompleto && !enviando && !resultado) {
      inputRef.current?.focus();
    }
  }, [index, items, loteCompleto, enviando, resultado]);

  const valorPrefill = (idx, mapaRespuestas) => {
    const item = items[idx];
    const previa = item ? mapaRespuestas[item.empresa_id] : null;
    return previa && !previa.sin_dato && previa.alicuota_pct != null ? String(previa.alicuota_pct) : '';
  };

  const submitLote = async (mapaRespuestas) => {
    setEnviando(true);
    setSendError(null);
    try {
      const payload = items.map((it) => {
        const r = mapaRespuestas[it.empresa_id];
        return {
          empresa_id: it.empresa_id,
          sin_dato: !!r?.sin_dato,
          ...(r && !r.sin_dato && r.alicuota_pct != null ? { alicuota_pct: r.alicuota_pct } : {}),
        };
      });
      setResultado(await registrarCargaRapidaAlicuotas(token, payload));
    } catch (err) {
      setSendError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const avanzar = (nuevaRespuesta) => {
    const item = items[index];
    const nuevasRespuestas = { ...respuestas, [item.empresa_id]: nuevaRespuesta };
    setRespuestas(nuevasRespuestas);
    setInputError(false);
    const siguiente = index + 1;
    if (siguiente < items.length) {
      setIndex(siguiente);
      setInputValue(valorPrefill(siguiente, nuevasRespuestas));
    } else {
      submitLote(nuevasRespuestas);
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
                onClick={() => submitLote(respuestas)}
                className="px-6 py-3 rounded-xl bg-blue-800 hover:bg-blue-700 font-semibold transition"
              >
                Reintentar envío
              </button>
            </>
          ) : (
            <p className="text-slate-400 animate-pulse">Enviando lote ({items.length}/{items.length})...</p>
          )}
        </div>
        <FooterCompliance />
      </div>
    );
  }

  // --- Tanda en curso ---

  const actual = items[index];
  const confianza = dotacionConfianzaInfo(actual.dotacion_confianza);

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
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setInputError(false); }}
              onKeyDown={onKeyDownInput}
              placeholder="Alícuota %"
              className={`w-full px-6 py-5 rounded-xl bg-slate-900 border-2 text-center text-4xl font-mono font-bold text-white placeholder-slate-600 focus:outline-none transition ${
                inputError ? 'border-red-500' : 'border-blue-500 focus:border-blue-400'
              }`}
            />
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
        </div>

        {/* Lista numerada 1..20 de la tanda */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Tanda</h3>
          </div>
          <ol className="divide-y divide-slate-700 max-h-[440px] overflow-y-auto">
            {items.map((it, i) => {
              const respuesta = respuestas[it.empresa_id];
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
                  <span className="w-4 flex justify-center shrink-0">
                    {respuesta?.sin_dato && <Icon name="x-mark" size={14} className="text-slate-500" />}
                    {respuesta && !respuesta.sin_dato && <Icon name="check" size={14} className="text-green-400" />}
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
