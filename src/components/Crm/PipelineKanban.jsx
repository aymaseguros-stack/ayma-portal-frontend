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
import IdCorto from './IdCorto';
import { EtapaSaidaChip } from './EtapaSaida';
import { colaParaCotizar } from './riesgoApi';
import { fechaCorta } from '../../utils/fechas';

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
        {/* C-6m: el id corto en la tarjeta, copiable de un clic. Es lo que se
            pega en un WhatsApp o en el buscador de otra pantalla sin
            transcribirlo a mano. */}
        <IdCorto valor={o.id_corto} idCompleto={o.id} />
        <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium">{o.track}</span>
        {/* D-C23: gris, y a propósito. Una no colocable NO es una pérdida ni
            una baja: el mercado no la tomó. El gris la distingue sin gritar,
            y el título dice por qué no suma al total de la columna. */}
        {o.no_colocable_en && (
          <span
            className="px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs"
            title={`No colocable: ${o.no_colocable_motivo || 'sin motivo'}`}
          >
            no colocable
          </span>
        )}
        <EtapaSaidaChip valor={o.etapa_saida} />
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
  // C-17 / D-C25: la cola de lo mandado a cotizar que todavía no tiene número.
  // ES UN TOGGLE Y NO UNA PESTAÑA NUEVA: la navegación está congelada, y de
  // todos modos la pregunta ("¿qué está esperando número?") se hace mirando el
  // mismo tablero, no yéndose a otra pantalla.
  const [soloParaCotizar, setSoloParaCotizar] = useState(false);
  const [cola, setCola] = useState(null);
  // D-C23: las no colocables salen del pipeline por diseño. El toggle las trae
  // de vuelta a la vista SIN devolverlas a los totales.
  const [incluirNoColocables, setIncluirNoColocables] = useState(false);
  const [noColocables, setNoColocables] = useState([]);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [oportunidadAbierta, setOportunidadAbierta] = useState(null);
  // C-17: la ficha recién creada se abre en "Riesgo". Una oportunidad nueva no
  // tiene nada que mirar en Datos y sí una ficha vacía que hay que llenar para
  // poder cotizar; llevar hasta ahí es la diferencia entre que se cargue o no.
  const [tabFicha, setTabFicha] = useState('datos');
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

  // LAS NO COLOCABLES NO VIENEN DEL PIPELINE, y no es un olvido: el endpoint
  // `/crm/oportunidades/pipeline` no tiene parámetros y las filtra en SQL (es
  // lo que D-C23 quiso). Para verlas se pide el LISTADO con
  // `incluir_no_colocables=true` y se las inyecta en su columna. No suman al
  // total: el total de la columna es producción viva, y una que el mercado no
  // toma no lo es.
  const cargarNoColocables = async () => {
    try {
      const url = new URL(`${API_URL}/api/v1/crm/oportunidades`);
      url.searchParams.set('incluir_no_colocables', 'true');
      url.searchParams.set('limit', '500');
      const res = await fetch(url.toString(), { headers: authHeader(token) });
      if (!res.ok) throw new Error(await formatApiError(res));
      const data = await res.json();
      setNoColocables((data.items || []).filter((o) => o.no_colocable_en));
    } catch (err) {
      console.error('Error cargando no colocables:', err);
      setNoColocables([]);
    }
  };

  const cargarCola = async () => {
    setLoading(true);
    setError(null);
    try {
      setCola(await colaParaCotizar(token, { track: filtroTrack || undefined }));
    } catch (err) {
      setError(err.message);
      setCola({ total: 0, items: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarPipeline(); }, []);

  useEffect(() => {
    if (soloParaCotizar) cargarCola();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloParaCotizar, filtroTrack]);

  useEffect(() => {
    if (incluirNoColocables) cargarNoColocables(); else setNoColocables([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirNoColocables]);

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
      // El total se calcula ANTES de sumar las no colocables: lo que la
      // columna dice en pesos es producción viva.
      const suma = items.reduce((acc, o) => acc + Number(o.prima_estimada || 0), 0);
      let extra = noColocables.filter(o => o.estado_crm === estado);
      if (filtroTrack) extra = extra.filter(o => o.track === filtroTrack);
      if (filtroAgente) extra = extra.filter(o => o.agente_id === filtroAgente);
      if (soloVencidas) extra = extra.filter(o => estaVencida(o));
      resultado[estado] = {
        estado_crm: estado,
        cantidad: items.length,
        prima_estimada_total: suma,
        oportunidades: [...items, ...extra],
        no_colocables: extra.length,
      };
    }
    return resultado;
  }, [columnas, filtroTrack, filtroAgente, soloVencidas, noColocables]);

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
        <label
          className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
          title="Lo que se mandó a cotizar y todavía no tiene número, de lo más viejo a lo más nuevo"
        >
          <input
            type="checkbox"
            checked={soloParaCotizar}
            onChange={(e) => setSoloParaCotizar(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Solo para cotizar
        </label>
        <label
          className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
          title="Las que el mercado no tomó. Se ven en su columna pero NO suman al total: no son producción viva."
        >
          <input
            type="checkbox"
            checked={incluirNoColocables}
            onChange={(e) => setIncluirNoColocables(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Incluir no colocables
        </label>
      </div>

      {/* EL BUSCADOR NO FILTRA EL TABLERO: consulta `GET /crm/oportunidades`.
          El pipeline sólo trae lo que está en una columna visible, así que
          filtrar las tarjetas cargadas dejaría afuera justo a las cerradas -y
          "¿cuál era la oportunidad del HAC394?" se pregunta, casi siempre,
          sobre una que ya se cerró. */}
      <BuscadorOportunidades
        token={token}
        onAbrir={(id) => { setTabFicha('datos'); setOportunidadAbierta(id); }}
      />

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
      ) : soloParaCotizar ? (
        /* LA COLA DE COTIZACIÓN (D-C25). Un LISTADO y no seis columnas: lo que
           se pregunta acá no es en qué etapa está cada una, sino cuál se está
           durmiendo - y eso se lee en una sola lista ordenada por antigüedad,
           que es como la sirve el backend (de la más vieja a la más nueva). */
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">
            {cola?.total || 0} pedida(s) al mercado sin número todavía. Ordenadas de la que espera
            hace más tiempo a la más reciente.
          </p>
          {(cola?.items || []).length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              Nada esperando cotización. Se entra a esta cola con "Enviar a cotizar", en la pestaña
              Riesgo de la ficha.
            </p>
          ) : (
            <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg">
              {cola.items.map((o) => (
                <li key={o.oportunidad_id}>
                  <button
                    type="button"
                    onClick={() => { setTabFicha('riesgo'); setOportunidadAbierta(o.oportunidad_id); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 transition flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{o.nombre_vinculado || 'Sin vincular'}</span>
                    <IdCorto valor={o.id_corto} idCompleto={o.oportunidad_id} />
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{o.track}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${ESTADO_CRM_BADGE[o.estado_crm] || ''}`}>
                      {o.estado_crm}
                    </span>
                    {o.patente && <span className="font-mono text-xs text-slate-300">{o.patente}</span>}
                    <span className="text-xs text-slate-500">
                      enviada el {fechaCorta(o.enviada_a_cotizar_en)}
                    </span>
                    {/* "hace 9 días" es lo que hace que alguien la mire;
                        "pendiente" no dice nada. */}
                    <span
                      className={`ml-auto text-xs font-medium ${o.dias_esperando >= 7 ? 'text-amber-300' : 'text-slate-400'}`}
                    >
                      hace {o.dias_esperando}d
                    </span>
                    <span className="text-xs text-slate-400">{formatMoneda(o.prima_estimada)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
                  <p className="text-xs opacity-80 mt-0.5">
                    {formatMoneda(col.prima_estimada_total)}
                    {col.no_colocables > 0 && (
                      <span className="ml-1 opacity-70" title="No colocables: se muestran, no se cuentan ni suman">
                        + {col.no_colocables} no colocable(s)
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {col.oportunidades.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-6">Sin oportunidades</p>
                  ) : (
                    col.oportunidades.map((o) => (
                      <OportunidadCard key={o.id} token={token} o={o} onDragStart={onDragStart} onClick={(id) => { setTabFicha('datos'); setOportunidadAbierta(id); }} />
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
          onResuelto={(creada) => {
            setMostrarNueva(false);
            cargarPipeline();
            if (creada?.id) { setTabFicha('riesgo'); setOportunidadAbierta(creada.id); }
          }}
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
          tabInicial={tabFicha}
          onClose={() => { setOportunidadAbierta(null); setTabFicha('datos'); }}
          onChanged={() => {
            cargarPipeline();
            if (soloParaCotizar) cargarCola();
            if (incluirNoColocables) cargarNoColocables();
          }}
        />
      )}
    </div>
  );
};

export default PipelineKanban;
