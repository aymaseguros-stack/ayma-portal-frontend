import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Calendar, RefreshCw } from 'lucide-react';

const GraficosHistoricos = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(30);

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/tendencias?dias=${periodo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Combinar datos para gráfico principal
  const prepararDatosCombinadosLeads = () => {
    if (!data) return [];
    
    const mapa = new Map();
    
    // Inicializar con todos los días del periodo
    for (let i = periodo; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const key = fecha.toISOString().split('T')[0];
      mapa.set(key, { fecha: key, leads: 0, conversiones: 0 });
    }
    
    data.leads.forEach(item => {
      if (mapa.has(item.fecha)) {
        mapa.get(item.fecha).leads = item.valor;
      }
    });
    
    data.conversiones.forEach(item => {
      if (mapa.has(item.fecha)) {
        mapa.get(item.fecha).conversiones = item.valor;
      }
    });
    
    return Array.from(mapa.values()).map(item => ({
      ...item,
      fechaCorta: new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    }));
  };

  const prepararDatosScoring = () => {
    if (!data) return [];
    
    const mapa = new Map();
    const objetivo = 130; // Objetivo diario
    
    for (let i = periodo; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const key = fecha.toISOString().split('T')[0];
      mapa.set(key, { fecha: key, puntos: 0, objetivo });
    }
    
    data.scoring.forEach(item => {
      if (mapa.has(item.fecha)) {
        mapa.get(item.fecha).puntos = item.valor;
      }
    });
    
    return Array.from(mapa.values()).map(item => ({
      ...item,
      fechaCorta: new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      cumplimiento: Math.round((item.puntos / objetivo) * 100)
    }));
  };

  const prepararDatosPolizas = () => {
    if (!data) return [];
    
    return data.polizas.map(item => ({
      ...item,
      fechaCorta: new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      primasK: Math.round(item.primas / 1000)
    }));
  };

  // Calcular totales del período
  const calcularTotales = () => {
    if (!data) return { leads: 0, conversiones: 0, scoring: 0, polizas: 0, primas: 0 };
    
    return {
      leads: data.leads.reduce((sum, i) => sum + i.valor, 0),
      conversiones: data.conversiones.reduce((sum, i) => sum + i.valor, 0),
      scoring: data.scoring.reduce((sum, i) => sum + i.valor, 0),
      polizas: data.polizas.reduce((sum, i) => sum + i.cantidad, 0),
      primas: data.polizas.reduce((sum, i) => sum + i.primas, 0)
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const datosLeads = prepararDatosCombinadosLeads();
  const datosScoring = prepararDatosScoring();
  const datosPolizas = prepararDatosPolizas();
  const totales = calcularTotales();

  return (
    <div className="space-y-6">
      {/* Header con selector de período */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Tendencias Históricas</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setPeriodo(d)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                  periodo === d ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={cargarDatos}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Resumen del período */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{totales.leads}</div>
          <div className="text-sm text-purple-700">Leads</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totales.conversiones}</div>
          <div className="text-sm text-green-700">Conversiones</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totales.scoring.toLocaleString()}</div>
          <div className="text-sm text-blue-700">Puntos</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-teal-600">{totales.polizas}</div>
          <div className="text-sm text-teal-700">Pólizas</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">${(totales.primas/1000).toFixed(0)}K</div>
          <div className="text-sm text-amber-700">Primas</div>
        </div>
      </div>

      {/* Gráfico Leads y Conversiones */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads y Conversiones</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={datosLeads}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fechaCorta" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              formatter={(value, name) => [value, name === 'leads' ? 'Leads' : 'Conversiones']}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="leads" 
              stackId="1"
              stroke="#8b5cf6" 
              fill="#c4b5fd" 
              name="Leads"
            />
            <Area 
              type="monotone" 
              dataKey="conversiones" 
              stackId="2"
              stroke="#10b981" 
              fill="#6ee7b7" 
              name="Conversiones"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scoring Diario */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scoring Diario vs Objetivo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={datosScoring}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fechaCorta" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value, name) => [value, name === 'puntos' ? 'Puntos' : 'Objetivo']}
              />
              <Legend />
              <Bar dataKey="puntos" fill="#3b82f6" name="Puntos" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="objetivo" stroke="#ef4444" strokeWidth={2} dot={false} name="Objetivo" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pólizas y Primas */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pólizas Emitidas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={datosPolizas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fechaCorta" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value, name) => [
                  name === 'cantidad' ? value : `$${value}K`,
                  name === 'cantidad' ? 'Pólizas' : 'Primas (K)'
                ]}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cantidad" stroke="#14b8a6" strokeWidth={2} name="Pólizas" />
              <Line yAxisId="right" type="monotone" dataKey="primasK" stroke="#f59e0b" strokeWidth={2} name="Primas (K)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tasa de Conversión */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasa de Conversión del Período</h3>
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600">
              {totales.leads > 0 ? Math.round((totales.conversiones / totales.leads) * 100) : 0}%
            </div>
            <div className="text-gray-500 mt-2">Conversión General</div>
          </div>
          <div className="h-24 w-px bg-gray-200"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {totales.leads > 0 ? (totales.leads / periodo).toFixed(1) : 0}
            </div>
            <div className="text-gray-500 mt-2">Leads/Día Promedio</div>
          </div>
          <div className="h-24 w-px bg-gray-200"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {periodo > 0 ? Math.round(totales.scoring / periodo) : 0}
            </div>
            <div className="text-gray-500 mt-2">Puntos/Día Promedio</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraficosHistoricos;
