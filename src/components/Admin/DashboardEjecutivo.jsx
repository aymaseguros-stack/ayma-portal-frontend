import React, { useState, useEffect } from 'react';
import GraficosHistoricos from './GraficosHistoricos';
import { TrendingUp, Users, FileText, DollarSign, AlertTriangle, Target, Phone, Calendar, ArrowUp, ArrowDown, MessageCircle, CheckCircle, XCircle } from 'lucide-react';

const DashboardEjecutivo = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarGraficos, setMostrarGraficos] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
    // Refresh cada 60 segundos
    const interval = setInterval(cargarDatos, 60000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/dashboard-ejecutivo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        setError('Error cargando datos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  const { kpis, funnel, origenes, tipos_seguro, scoring, vencimientos, financiero, top_clientes, leads_recientes } = data;

  // Calcular máximo para el funnel
  const maxFunnel = Math.max(...Object.values(funnel), 1);

  // Colores para estados
  const coloresFunnel = {
    dato: { bg: 'bg-gray-100', bar: 'bg-gray-400', text: 'text-gray-700' },
    prospecto: { bg: 'bg-yellow-100', bar: 'bg-yellow-500', text: 'text-yellow-700' },
    potencial: { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-700' },
    cliente: { bg: 'bg-green-100', bar: 'bg-green-500', text: 'text-green-700' },
    perdido: { bg: 'bg-red-100', bar: 'bg-red-400', text: 'text-red-700' }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-gray-500 text-sm">Actualizado: {new Date().toLocaleString('es-AR')}</p>
        </div>
        <button 
          onClick={cargarDatos}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <TrendingUp size={18} />
          Actualizar
        </button>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard 
          titulo="Clientes" 
          valor={kpis.total_clientes} 
          icono={<Users className="text-blue-600" />}
          color="blue"
        />
        <KpiCard 
          titulo="Leads Total" 
          valor={kpis.total_leads} 
          icono={<Phone className="text-purple-600" />}
          color="purple"
        />
        <KpiCard 
          titulo="Leads Hoy" 
          valor={kpis.leads_hoy} 
          icono={<ArrowUp className="text-green-600" />}
          color="green"
          destacado
        />
        <KpiCard 
          titulo="Leads Semana" 
          valor={kpis.leads_semana} 
          icono={<Calendar className="text-indigo-600" />}
          color="indigo"
        />
        <KpiCard 
          titulo="Pólizas Vigentes" 
          valor={kpis.polizas_vigentes} 
          icono={<FileText className="text-teal-600" />}
          color="teal"
        />
        <KpiCard 
          titulo="Conversión" 
          valor={`${kpis.tasa_conversion}%`} 
          icono={<Target className="text-orange-600" />}
          color="orange"
        />
      </div>

      {/* Fila Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel de Conversión */}
        <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Funnel de Conversión</h2>
          <div className="space-y-3">
            {['dato', 'prospecto', 'potencial', 'cliente', 'perdido'].map((estado) => (
              <div key={estado} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium text-gray-600 capitalize">{estado}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                  <div 
                    className={`h-full ${coloresFunnel[estado].bar} transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{ width: `${(funnel[estado] / maxFunnel) * 100}%`, minWidth: funnel[estado] > 0 ? '40px' : '0' }}
                  >
                    <span className="text-white text-sm font-bold">{funnel[estado]}</span>
                  </div>
                </div>
                <div className="w-16 text-right text-sm text-gray-500">
                  {kpis.total_leads > 0 ? Math.round((funnel[estado] / kpis.total_leads) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scoring Comercial</h2>
          
          {/* Objetivo Diario */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Hoy</span>
              <span className="font-medium">{scoring.hoy} / {scoring.objetivo_diario} pts</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all ${
                  scoring.cumplimiento_diario >= 100 ? 'bg-green-500' : 
                  scoring.cumplimiento_diario >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(scoring.cumplimiento_diario, 100)}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-500 mt-1">
              {scoring.cumplimiento_diario}% cumplido
            </div>
          </div>

          {/* Objetivo Semanal */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Semana</span>
              <span className="font-medium">{scoring.semana} / {scoring.objetivo_semanal} pts</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all ${
                  scoring.cumplimiento_semanal >= 100 ? 'bg-green-500' : 
                  scoring.cumplimiento_semanal >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(scoring.cumplimiento_semanal, 100)}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-500 mt-1">
              {scoring.cumplimiento_semanal}% cumplido
            </div>
          </div>

          {/* Total acumulado */}
          <div className="mt-6 pt-4 border-t">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{scoring.total.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Puntos totales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fila Secundaria */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Vencimientos */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={20} />
            Vencimientos
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Urgente (7 días)</span>
              <span className={`px-2 py-1 rounded text-sm font-bold ${
                vencimientos.urgente_7 > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {vencimientos.urgente_7}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Próximo (15 días)</span>
              <span className={`px-2 py-1 rounded text-sm font-bold ${
                vencimientos.proximo_15 > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {vencimientos.proximo_15}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Este mes (30 días)</span>
              <span className="px-2 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700">
                {vencimientos.mes_30}
              </span>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total a gestionar</span>
                <span className="text-xl font-bold text-gray-900">{vencimientos.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financiero */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="text-green-500" size={20} />
            Financiero
          </h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Primas Administradas</div>
              <div className="text-2xl font-bold text-gray-900">
                ${financiero.primas_totales.toLocaleString('es-AR')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Comisión Estimada (15%)</div>
              <div className="text-xl font-bold text-green-600">
                ${financiero.comision_estimada.toLocaleString('es-AR')}
              </div>
            </div>
            <div className="pt-3 border-t">
              <div className="text-sm text-gray-500">Ticket Promedio</div>
              <div className="text-lg font-semibold text-gray-700">
                ${financiero.ticket_promedio.toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        </div>

        {/* Orígenes */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orígenes de Leads</h2>
          <div className="space-y-2">
            {Object.entries(origenes).sort((a, b) => b[1] - a[1]).map(([origen, cantidad]) => (
              <div key={origen} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">{origen}</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                  {cantidad}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de Seguro */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipos de Seguro</h2>
          <div className="space-y-2">
            {Object.entries(tipos_seguro).sort((a, b) => b[1] - a[1]).map(([tipo, cantidad]) => (
              <div key={tipo} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">{tipo}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                  {cantidad}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fila Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Clientes por Scoring</h2>
          <div className="space-y-3">
            {top_clientes.map((cliente, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-gray-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="font-medium text-gray-900">{cliente.nombre}</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{cliente.scoring} pts</span>
              </div>
            ))}
            {top_clientes.length === 0 && (
              <p className="text-gray-500 text-sm">Sin datos de clientes</p>
            )}
          </div>
        </div>

        {/* Leads Recientes con Acciones */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads Recientes - Acciones Rápidas</h2>
          <div className="space-y-3">
            {leads_recientes.map((lead) => (
              <LeadAccionesRapidas 
                key={lead.id} 
                lead={lead} 
                onEstadoCambiado={cargarDatos}
                API_URL={API_URL}
              />
            ))}
            {leads_recientes.length === 0 && (
              <p className="text-gray-500 text-sm">Sin leads recientes</p>
            )}
          </div>
        </div>
      </div>
      {/* Toggle Gráficos */}
      <div className="flex justify-center">
        <button
          onClick={() => setMostrarGraficos(!mostrarGraficos)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-2 shadow-lg"
        >
          <TrendingUp size={20} />
          {mostrarGraficos ? 'Ocultar Gráficos' : 'Ver Tendencias Históricas'}
        </button>
      </div>

      {/* Gráficos Históricos */}
      {mostrarGraficos && (
        <div className="mt-6">
          <GraficosHistoricos />
        </div>
      )}
    </div>
  );
};

// Componente KPI Card
const KpiCard = ({ titulo, valor, icono, color, destacado }) => (
  <div className={`bg-white rounded-xl shadow-sm border p-4 ${destacado ? 'ring-2 ring-green-400' : ''}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-500 text-sm">{titulo}</span>
      {icono}
    </div>
    <div className={`text-2xl font-bold text-gray-900`}>
      {typeof valor === 'number' ? valor.toLocaleString() : valor}
    </div>
  </div>
);

// Componente Lead con Acciones Rápidas
const LeadAccionesRapidas = ({ lead, onEstadoCambiado, API_URL }) => {
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const estados = [
    { value: 'dato', label: 'Dato', color: 'bg-gray-100 text-gray-700' },
    { value: 'prospecto', label: 'Prospecto', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'potencial', label: 'Potencial', color: 'bg-blue-100 text-blue-700' },
    { value: 'cliente', label: 'Cliente', color: 'bg-green-100 text-green-700' },
    { value: 'perdido', label: 'Perdido', color: 'bg-red-100 text-red-700' }
  ];

  const estadoActual = estados.find(e => e.value === lead.estado) || estados[0];

  const cambiarEstado = async (nuevoEstado) => {
    setCambiandoEstado(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.ok) {
        onEstadoCambiado();
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCambiandoEstado(false);
      setMenuAbierto(false);
    }
  };

  const abrirWhatsApp = () => {
    const telefono = lead.telefono?.replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola ${lead.nombre}! Soy de AYMA Advisors. Vi tu consulta sobre seguro de ${lead.tipo_seguro}. ¿Tenés un momento para conversar?`
    );
    window.open(`https://wa.me/54${telefono}?text=${mensaje}`, '_blank');
  };

  const llamar = () => {
    const telefono = lead.telefono?.replace(/\D/g, '');
    window.open(`tel:+54${telefono}`, '_self');
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 border rounded-lg hover:bg-gray-50 transition">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{lead.nombre}</div>
        <div className="text-sm text-gray-500 capitalize">{lead.tipo_seguro} • {lead.telefono}</div>
      </div>
      
      {/* Acciones Rápidas */}
      <div className="flex items-center gap-2">
        {/* WhatsApp */}
        <button
          onClick={abrirWhatsApp}
          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
          title="Enviar WhatsApp"
        >
          <MessageCircle size={18} />
        </button>
        
        {/* Llamar */}
        <button
          onClick={llamar}
          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
          title="Llamar"
        >
          <Phone size={18} />
        </button>
        
        {/* Cambiar Estado */}
        <div className="relative">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            disabled={cambiandoEstado}
            className={`px-3 py-1 rounded text-xs font-medium ${estadoActual.color} hover:opacity-80 transition`}
          >
            {cambiandoEstado ? '...' : estadoActual.label}
          </button>
          
          {menuAbierto && (
            <div className="absolute right-0 top-8 z-10 bg-white border rounded-lg shadow-lg py-1 min-w-32">
              {estados.map(estado => (
                <button
                  key={estado.value}
                  onClick={() => cambiarEstado(estado.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                    estado.value === lead.estado ? 'font-bold' : ''
                  }`}
                >
                  {estado.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Acciones rápidas de estado */}
        {lead.estado !== 'cliente' && lead.estado !== 'perdido' && (
          <>
            <button
              onClick={() => cambiarEstado('cliente')}
              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
              title="Marcar como Cliente"
            >
              <CheckCircle size={18} />
            </button>
            <button
              onClick={() => cambiarEstado('perdido')}
              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
              title="Marcar como Perdido"
            >
              <XCircle size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardEjecutivo;
