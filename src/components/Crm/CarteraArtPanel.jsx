import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import { normalizeList, formatApiError, authHeader } from '../../utils/api';
import { ESTRATEGIA_ART_INFO, ESTRATEGIA_ART_ORDEN, estrategiaArtInfo, estrategiaArtBadgeClass } from './artEstrategia';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const CARD_COLOR_CLASSES = {
  blue: 'border-blue-500/40 hover:border-blue-400 text-blue-300',
  green: 'border-green-500/40 hover:border-green-400 text-green-300',
  orange: 'border-orange-500/40 hover:border-orange-400 text-orange-300',
  gray: 'border-slate-600 hover:border-slate-400 text-slate-300',
};

const CARD_COLOR_ACTIVE = {
  blue: 'bg-blue-500/10 border-blue-400',
  green: 'bg-green-500/10 border-green-400',
  orange: 'bg-orange-500/10 border-orange-400',
  gray: 'bg-slate-500/10 border-slate-400',
};

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

const AVISO_SIN_COBERTURA = 'Sin cobertura no es lead limpio. Si la baja fue por falta de pago (Ley '
  + '24.557 art. 27 ap. 6), la empresa figura en el Registro de Contratos '
  + 'Extinguidos hasta un año aniversario y la deuda con la aseguradora anterior '
  + 'subsiste aunque contrate con otra ART. Verificar el estado de deuda antes '
  + 'de cotizar.';

const CarteraArtPanel = ({ token, onAbrirFicha, encabezado }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [srtEstado, setSrtEstado] = useState(null);

  const [filtroEstrategia, setFiltroEstrategia] = useState(null);
  const [filtroArt, setFiltroArt] = useState('');
  const [empleadosMin, setEmpleadosMin] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const headers = authHeader(token);

  useEffect(() => {
    cargarEmpresas();
    cargarSrtEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarEmpresas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/empresas?limit=500`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      setEmpresas(normalizeList(await res.json()).items);
    } catch (err) {
      console.error('Error cargando cartera ART:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarSrtEstado = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/srt/estado`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      setSrtEstado(await res.json());
    } catch (err) {
      console.error('Error cargando estado SRT:', err);
      setSrtEstado(null);
    }
  };

  const conteos = useMemo(() => {
    const base = { ATACAR_DESDE_BERKLEY: 0, ATACAR_A_BERKLEY: 0, SIN_COBERTURA_DEUDA: 0, SIN_DATO: 0 };
    for (const emp of empresas) {
      const key = ESTRATEGIA_ART_INFO[emp.estrategia_art] ? emp.estrategia_art : 'SIN_DATO';
      base[key] += 1;
    }
    return base;
  }, [empresas]);

  const artOpciones = useMemo(() => {
    const set = new Set();
    for (const emp of empresas) {
      if (emp.art_vigente) set.add(emp.art_vigente);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [empresas]);

  const verificadas = srtEstado?.verificadas ?? empresas.filter(e => e.estrategia_art && e.estrategia_art !== 'SIN_DATO').length;
  const pendientes = srtEstado?.pendientes ?? (empresas.length - verificadas);
  // El denominador SIEMPRE sale de /srt/estado (COUNT reales), nunca del
  // limit=500 de /crm/empresas. Hoy el backend devuelve solo
  // {verificadas, pendientes}; cuando sume total_cola (COUNT real de la
  // cola SRT) se usa directo, mientras tanto se estima como
  // verificadas + pendientes para no mostrar un tope artificial (ej. "68/500").
  const totalSrt = srtEstado
    ? (typeof srtEstado.total_cola === 'number' ? srtEstado.total_cola : verificadas + pendientes)
    : empresas.length;
  const pctVerificadas = totalSrt > 0 ? Math.round((verificadas / totalSrt) * 100) : 0;
  const porPrioridad = srtEstado?.por_prioridad || null;

  const empresasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const min = empleadosMin === '' ? null : Number(empleadosMin);
    return empresas
      .filter((emp) => {
        const key = ESTRATEGIA_ART_INFO[emp.estrategia_art] ? emp.estrategia_art : 'SIN_DATO';
        if (filtroEstrategia && key !== filtroEstrategia) return false;
        if (filtroArt && emp.art_vigente !== filtroArt) return false;
        if (min !== null && !Number.isNaN(min) && (emp.cantidad_empleados ?? 0) < min) return false;
        if (q) {
          const enRazonSocial = emp.razon_social?.toLowerCase().includes(q);
          const enCuit = emp.cuit?.toLowerCase().includes(q);
          if (!enRazonSocial && !enCuit) return false;
        }
        return true;
      })
      .sort((a, b) => (b.cantidad_empleados ?? 0) - (a.cantidad_empleados ?? 0));
  }, [empresas, filtroEstrategia, filtroArt, empleadosMin, busqueda]);

  const toggleFiltroEstrategia = (key) => {
    setFiltroEstrategia((actual) => (actual === key ? null : key));
  };

  const mostrarMotivoBaja = filtroEstrategia === 'SIN_COBERTURA_DEUDA';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        {encabezado}

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 min-w-[240px]">
          <p className="text-sm text-slate-300">
            Verificadas <span className="font-semibold text-white">{verificadas}</span> / {totalSrt}
            {' · '}Pendientes <span className="font-semibold text-white">{pendientes}</span>
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${pctVerificadas}%` }} />
          </div>
          {porPrioridad && (
            <div className="mt-2 flex gap-3 text-xs text-slate-400">
              <span>P1 <span className="text-white font-medium">{porPrioridad.P1 ?? 0}</span></span>
              <span>P2 <span className="text-white font-medium">{porPrioridad.P2 ?? 0}</span></span>
              <span>P3 <span className="text-white font-medium">{porPrioridad.P3 ?? 0}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ESTRATEGIA_ART_ORDEN.map((key) => {
          const info = estrategiaArtInfo(key);
          const activo = filtroEstrategia === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleFiltroEstrategia(key)}
              className={`text-left rounded-xl border p-4 transition ${
                activo ? CARD_COLOR_ACTIVE[info.color] : `bg-slate-800/50 ${CARD_COLOR_CLASSES[info.color]}`
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{info.descripcion}</p>
              <p className="text-2xl font-bold mt-1">{conteos[key] ?? 0}</p>
              <p className="text-sm font-medium mt-0.5">{info.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Estrategia</label>
          <select
            value={filtroEstrategia || ''}
            onChange={(e) => setFiltroEstrategia(e.target.value || null)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Todas</option>
            {ESTRATEGIA_ART_ORDEN.map((key) => (
              <option key={key} value={key}>{estrategiaArtInfo(key).label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">ART actual</label>
          <select
            value={filtroArt}
            onChange={(e) => setFiltroArt(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Todas</option>
            {artOpciones.map((art) => (
              <option key={art} value={art}>{art}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Empleados mín.</label>
          <input
            type="number"
            min="0"
            value={empleadosMin}
            onChange={(e) => setEmpleadosMin(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-slate-400 text-xs mb-1">Buscar</label>
          <div className="relative">
            <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Razón social o CUIT..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm"
            />
          </div>
        </div>
        {(filtroEstrategia || filtroArt || empleadosMin || busqueda) && (
          <button
            type="button"
            onClick={() => { setFiltroEstrategia(null); setFiltroArt(''); setEmpleadosMin(''); setBusqueda(''); }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white transition"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {mostrarMotivoBaja && (
        <div className="bg-orange-500/15 border border-orange-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-orange-400 shrink-0 mt-0.5" />
          <p className="text-orange-200 text-sm">{AVISO_SIN_COBERTURA}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Razón social</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CUIT</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Empleados</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">ART vigente</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estrategia</th>
                {mostrarMotivoBaja && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Motivo de baja</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Vencimiento</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Última verificación</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CIIU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Localidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
              ) : empresasFiltradas.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay empresas para estos filtros</td></tr>
              ) : (
                empresasFiltradas.map((emp) => {
                  const info = estrategiaArtInfo(emp.estrategia_art);
                  const vigente = emp.art_vigencia_hasta ? fechaCorta(emp.art_vigencia_hasta)
                    : emp.art_vigente ? 'Vigente' : null;
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => onAbrirFicha?.(emp.id)}
                      className="hover:bg-slate-700/30 transition cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium">{emp.razon_social}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.cuit || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">{emp.cantidad_empleados ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.art_vigente || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${estrategiaArtBadgeClass(emp.estrategia_art)}`}>
                          {info.label}
                        </span>
                      </td>
                      {mostrarMotivoBaja && (
                        <td className="px-4 py-3 text-sm">
                          {emp.sin_cobertura_motivo ? (
                            <span className={emp.sin_cobertura_motivo === 'FALTA_DE_PAGO' ? 'text-red-400 font-medium' : 'text-slate-400'}>
                              {emp.sin_cobertura_motivo}
                            </span>
                          ) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        {emp.art_vigencia_hasta ? (
                          <span className="text-slate-400">{vigente}</span>
                        ) : emp.art_vigente ? (
                          <span className="text-green-400 font-medium">Vigente</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fechaCorta(emp.art_ultima_verificacion) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.ciiu_codigo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.domicilio_fiscal_localidad || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CarteraArtPanel;
