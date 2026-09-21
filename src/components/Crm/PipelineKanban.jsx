import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import { authHeader, formatApiError } from '../../utils/api';
import AltaEncadenada from './AltaEncadenada';
import OportunidadFichaModal from './OportunidadFichaModal';
import TransicionEstadoModal from './TransicionEstadoModal';
import { nombreDeEmpresa, etiquetaTitularConReferencia } from './empresasApi';
import {
  ESTADOS_CRM_ORDEN, ESTADO_CRM_LABEL, ESTADO_CRM_BADGE, TRACKS_VALIDOS,
  ESTADOS_EXPLICITOS, formatMoneda, diasDesde, estaVencida,
} from './oportunidadConstants';
import BuscadorOportunidades from './BuscadorOportunidades';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const columnaVacia = (estado_crm) => ({ estado_crm, cantidad: 0, prima_estimada_total: 0, oportunidades: [] });

// Con empresa titular Y persona de referencia la tarjeta muestra
// "Empresa · ref.: Persona". El backend manda `nombre_vinculado` = la persona
// cuando están los dos (su _nombre_vinculado prioriza persona), así que la
// razón social se resuelve acá, cacheada por id.
const OportunidadCard = ({ token, o, onDragStart, onClick }) => {
  const dias = diasDesde(o.updated_at);
  const vencida = estaVencida(o);
  const [nombreEmpresa, setNombreEmpresa] = useState(null);
  const conReferencia = Boolean(o.empresa_id && o.persona_id);

  useEffect(() => {
    if (!conReferencia) return undefined;
    let vigente = true;
    nombreDeEmpresa(token, o.empresa_id).then((n) => { if (vigente) setNombreEmpresa(n); });
    return () => { vigente = false; };
  }, [conReferencia, o.empresa_id, token]);

  const titulo = conReferencia
    ? (etiquetaTitularConReferencia(nombreEmpresa, o.nombre_vinculado) || o.nombre_vinculado)
    : o.nombre_vinculado;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, o)}
      onClick={() => onClick(o.id)}
      title="Abrir la ficha. Arrastrar sólo sirve para LOOP y RECUPERABLE: el resto del embudo se mueve registrando el acto."
      className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-blue-500/60 transition space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm truncate">{titulo || 'Sin vincular'}</span>
        {vencida && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" title="Fecha de cierre estimada vencida" />}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium">{o.track}</span>
        {o.etapa_saida && <span className="px-2 py-0.5 bg-slate-700/60 text-slate-400 rounded text-xs">{o.etapa_saida}</span>}
        {/* C-15: la patente en la tarjeta. Es como se reconoce de qué riesgo
            se trata sin abrir la ficha, que era la pregunta que había que ir
            a buscar a las notas. */}
        {o.patente && (
          <span className="px-2 py-0.5 bg-slate-900/60 text-slate-300 rounded text-xs font-mono">{o.patente}</span>
        )}
        {/* D-B8: el NO que dejó valor. Sin el badge, la columna LOOP muestra
            igual a la cuenta que defendimos hasta hacerle bajar la tarifa y a
            la que dijo "no me interesa". */}
        {o.resultado_loop === 'CON_EFECTO' && (
          <span
            className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium"
            title={
              o.ahorro_anual_generado
                ? `Ahorro anual generado: ${formatMoneda(o.ahorro_anual_generado)}`
                : 'La compañía actual bajó la tarifa por nuestra intervención'
            }
          >
            con efecto
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{formatMoneda(o.prima_estimada)}</span>
        {dias !== null && <span>hace {dias}d</span>}
      </div>
    </div>
  );
};

const PipelineKanban = ({ token }) => {
  const [columnas, setColumnas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtroTrack, setFiltroTrack] = useState('');
  const [filtroAgente, setFiltroAgente] = useState('');
  const [soloVencidas, setSoloVencidas] = useState(false);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [oportunidadAbierta, setOportunidadAbierta] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [transicion, setTransicion] = useState(null);
  const [aviso, setAviso] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const cargarPipeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/pipeline`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      const data = await res.json();
      const porEstado = {};
      for (const col of data.columnas || []) porEstado[col.estado_crm] = col;
      setColumnas(porEstado);
    } catch (err) {
      console.error('Error cargando pipeline:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarPipeline(); }, []);

  const agentesDisponibles = useMemo(() => {
    const ids = new Set();
    Object.values(columnas).forEach(col => col.oportunidades.forEach(o => { if (o.agente_id) ids.add(o.agente_id); }));
    return Array.from(ids);
  }, [columnas]);

  const columnasFiltradas = useMemo(() => {
    const resultado = {};
    for (const estado of ESTADOS_CRM_ORDEN) {
      const col = columnas[estado] || columnaVacia(estado);
      let items = col.oportunidades;
      if (filtroTrack) items = items.filter(o => o.track === filtroTrack);
      if (filtroAgente) items = items.filter(o => o.agente_id === filtroAgente);
      if (soloVencidas) items = items.filter(o => estaVencida(o));
      const suma = items.reduce((acc, o) => acc + Number(o.prima_estimada || 0), 0);
      resultado[estado] = { estado_crm: estado, cantidad: items.length, prima_estimada_total: suma, oportunidades: items };
    }
    return resultado;
  }, [columnas, filtroTrack, filtroAgente, soloVencidas]);

  const onDragStart = (e, oportunidad) => {
    setArrastrando(oportunidad);
    e.dataTransfer.effectAllowed = 'move';
  };

  // EL KANBAN YA NO ESCRIBE EL ESTADO DEL EMBUDO.
  //
  // Antes, soltar una tarjeta en otra columna hacía
  // `PATCH /crm/oportunidades/{id}/estado` con el estado de la columna: el
  // estado era literalmente lo que alguien arrastró. Desde el PR #176 del
  // backend ese PATCH pasa por la máquina de transiciones y contesta 409
  // diciendo que el estado se deriva del acto - así que arrastrar a PROSPECTO,
  // POTENCIAL o CLIENTE sólo podía producir un cartel de error.
  //
  // Se quedan las DOS salidas laterales, que sí son explícitas: soltar en LOOP
  // o RECUPERABLE abre el modal que pide sus campos obligatorios. No hay
  // optimistic update: el estado lo confirma el backend y después se recarga
  // el pipeline.
  const onDrop = (estadoDestino) => {
    const oportunidad = arrastrando;
    setArrastrando(null);
    if (!oportunidad || oportunidad.estado_crm === estadoDestino) return;

    if (!ESTADOS_EXPLICITOS.includes(estadoDestino)) {
      setAviso(
        `${ESTADO_CRM_LABEL[estadoDestino] || estadoDestino} no se asigna a mano: se deriva del acto. ` +
        'Abrí la ficha y registrá la cotización entregada o la emisión.'
      );
      return;
    }
    setAviso(null);
    setTransicion({ oportunidad, destino: estadoDestino });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Pipeline comercial</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarPipeline}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
          >
            <Icon name="arrow-path" />
            Actualizar
          </button>
          <button
            onClick={() => setMostrarNueva(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
          >
            <Icon name="plus" />
            Nueva oportunidad
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filtroTrack}
          onChange={(e) => setFiltroTrack(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todos los tracks</option>
          {TRACKS_VALIDOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filtroAgente}
          onChange={(e) => setFiltroAgente(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todos los agentes</option>
          {agentesDisponibles.map(a => <option key={a} value={a}>{a.slice(0, 8)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={soloVencidas} onChange={(e) => setSoloVencidas(e.target.checked)} className="w-4 h-4 rounded" />
          Solo vencidas
        </label>
      </div>

      {/* EL BUSCADOR NO FILTRA EL TABLERO: consulta `GET /crm/oportunidades`.
          El pipeline sólo trae lo que está en una columna visible, así que
          filtrar las tarjetas cargadas dejaría afuera justo a las cerradas -y
          "¿cuál era la oportunidad del HAC394?" se pregunta, casi siempre,
          sobre una que ya se cerró. */}
      <BuscadorOportunidades token={token} onAbrir={setOportunidadAbierta} />

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {aviso && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
          <Icon name="exclamation-triangle" className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando pipeline...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {ESTADOS_CRM_ORDEN.map((estado) => {
            const col = columnasFiltradas[estado] || columnaVacia(estado);
            return (
              <div
                key={estado}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(estado)}
                className="bg-slate-800/40 border border-slate-700 rounded-xl flex flex-col min-h-[200px]"
              >
                <div className={`px-3 py-2 rounded-t-xl border-b border-slate-700 ${ESTADO_CRM_BADGE[estado] || ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{ESTADO_CRM_LABEL[estado] || estado}</span>
                    <span className="text-xs bg-black/20 rounded-full px-2 py-0.5">{col.cantidad}</span>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">{formatMoneda(col.prima_estimada_total)}</p>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {col.oportunidades.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-6">Sin oportunidades</p>
                  ) : (
                    col.oportunidades.map((o) => (
                      <OportunidadCard key={o.id} token={token} o={o} onDragStart={onDragStart} onClick={setOportunidadAbierta} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarNueva && (
        <AltaEncadenada
          token={token}
          raiz={{ tipo: 'oportunidad', preset: null }}
          onCerrar={() => setMostrarNueva(false)}
          onResuelto={() => { setMostrarNueva(false); cargarPipeline(); }}
        />
      )}

      {transicion && (
        <TransicionEstadoModal
          token={token}
          oportunidad={transicion.oportunidad}
          destino={transicion.destino}
          onCerrar={() => setTransicion(null)}
          onAplicada={() => { setTransicion(null); cargarPipeline(); }}
        />
      )}

      {oportunidadAbierta && (
        <OportunidadFichaModal
          token={token}
          oportunidadId={oportunidadAbierta}
          onClose={() => setOportunidadAbierta(null)}
          onChanged={cargarPipeline}
        />
      )}
    </div>
  );
};

export default PipelineKanban;
