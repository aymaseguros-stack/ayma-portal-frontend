import React, { useState, useEffect } from 'react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Estado inicial
const initialState = {
  user: null,
  token: null,
  activeTab: 'dashboard',
  polizas: [],
  vehiculos: [],
  dashboardData: null,
  loading: false,
  error: null
};

function App() {
  const [state, setState] = useState(initialState);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Verificar token al cargar
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setState(prev => ({ ...prev, token, user: JSON.parse(user) }));
    }
  }, []);

  // Cargar datos cuando hay token
  useEffect(() => {
    if (state.token) {
      cargarDatos();
    }
  }, [state.token]);

  // Función para hacer peticiones autenticadas
  const fetchAPI = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    return response.json();
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      if (!response.ok) throw new Error('Credenciales inválidas');
      
      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify({ 
        email: data.email, 
        tipo_usuario: data.tipo_usuario 
      }));
      
      setState(prev => ({ 
        ...prev, 
        token: data.access_token, 
        user: { email: data.email, tipo_usuario: data.tipo_usuario },
        loading: false 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  // Cargar todos los datos
  const cargarDatos = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const [dashboard, polizas, vehiculos] = await Promise.all([
        fetchAPI('/api/v1/dashboard/'),
        fetchAPI('/api/v1/polizas/'),
        fetchAPI('/api/v1/vehiculos/')
      ]);
      
      setState(prev => ({ 
        ...prev, 
        dashboardData: dashboard,
        polizas: polizas || [],
        vehiculos: vehiculos || [],
        loading: false 
      }));
    } catch (err) {
      console.error('Error cargando datos:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState(initialState);
    setLoginForm({ email: '', password: '' });
  };

  // Cambiar pestaña
  const setActiveTab = (tab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  // =============================================
  // COMPONENTES DE RENDERIZADO
  // =============================================

  // Login Form
  if (!state.token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Portal AYMA</h1>
            <p className="text-blue-200">Gestión de Seguros</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Contraseña"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            
            {state.error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {state.error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={state.loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {state.loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard Principal
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Portal AYMA</h1>
            <div className="flex items-center gap-4">
              <span className="text-slate-300">{state.user?.email}</span>
              <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm capitalize">
                {state.user?.tipo_usuario}
              </span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition"
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navegación */}
      <nav className="bg-slate-800/30 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {[
              { id: 'dashboard', icon: '📊', label: 'Dashboard' },
              { id: 'datos', icon: '👤', label: 'Mis Datos' },
              { id: 'polizas', icon: '📄', label: 'Mis Pólizas' },
              { id: 'vehiculos', icon: '🚗', label: 'Mis Vehículos' },
              { id: 'soporte', icon: '💬', label: 'Soporte' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
                  state.activeTab === tab.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* DASHBOARD */}
        {state.activeTab === 'dashboard' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            
            {/* Tarjetas de Resumen - GRID HORIZONTAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-blue-200 text-sm">Mis Pólizas</p>
                    <p className="text-4xl font-bold mt-2">{state.dashboardData?.misPolizas || state.polizas.length}</p>
                  </div>
                  <span className="text-4xl">📄</span>
                </div>
                <p className="text-blue-200 text-sm mt-4">Pólizas vigentes</p>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-200 text-sm">Mis Vehículos</p>
                    <p className="text-4xl font-bold mt-2">{state.dashboardData?.misVehiculos || state.vehiculos.length}</p>
                  </div>
                  <span className="text-4xl">🚗</span>
                </div>
                <p className="text-green-200 text-sm mt-4">Vehículos asegurados</p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-purple-200 text-sm">Tickets Abiertos</p>
                    <p className="text-4xl font-bold mt-2">{state.dashboardData?.ticketsAbiertos || 0}</p>
                  </div>
                  <span className="text-4xl">📩</span>
                </div>
                <p className="text-purple-200 text-sm mt-4">En seguimiento</p>
              </div>

              <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-orange-200 text-sm">Total Primas</p>
                    <p className="text-3xl font-bold mt-2">
                      ${state.polizas.reduce((sum, p) => sum + (p.premio_total || 0), 0).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <span className="text-4xl">💰</span>
                </div>
                <p className="text-orange-200 text-sm mt-4">Prima total anual</p>
              </div>
            </div>

            {/* Info de Sesión */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">ℹ️ Información de Sesión</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
                <div>
                  <span className="text-slate-500">Email:</span>
                  <span className="ml-2">{state.user?.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Rol:</span>
                  <span className="ml-2 capitalize">{state.user?.tipo_usuario}</span>
                </div>
                <div>
                  <span className="text-slate-500">Cliente:</span>
                  <span className="ml-2">{state.dashboardData?.cliente?.nombre || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MIS DATOS */}
        {state.activeTab === 'datos' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Mis Datos</h2>
            
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-slate-500 text-sm">Nombre Completo</p>
                  <p className="text-xl font-semibold">{state.dashboardData?.cliente?.nombre || state.user?.email}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Email</p>
                  <p className="text-xl">{state.dashboardData?.cliente?.email || state.user?.email}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Rol</p>
                  <p className="text-xl capitalize">{state.user?.tipo_usuario}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Estado</p>
                  <span className="inline-block px-3 py-1 bg-green-600/30 text-green-300 rounded-full">
                    Activo
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MIS PÓLIZAS - GRID HORIZONTAL */}
        {state.activeTab === 'polizas' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestión de Pólizas</h2>
              <span className="text-slate-400">{state.polizas.length} póliza(s)</span>
            </div>
            
            {state.polizas.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                <span className="text-6xl">📄</span>
                <p className="text-slate-400 mt-4">No tienes pólizas registradas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {state.polizas.map(poliza => (
                  <div key={poliza.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-blue-500/50 transition">
                    {/* Header de la tarjeta */}
                    <div className="bg-slate-700/50 px-6 py-4 flex justify-between items-center">
                      <div>
                        <p className="text-blue-400 font-bold">Póliza {poliza.numero_poliza}</p>
                        <p className="text-slate-400 text-sm">{poliza.compania}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        poliza.estado === 'vigente' 
                          ? 'bg-green-600/30 text-green-300' 
                          : 'bg-red-600/30 text-red-300'
                      }`}>
                        {poliza.estado}
                      </span>
                    </div>
                    
                    {/* Cuerpo */}
                    <div className="p-6 space-y-4">
                      {/* Vehículo */}
                      {poliza.vehiculo && (
                        <div className="flex items-center gap-3 bg-slate-700/30 rounded-lg p-3">
                          <span className="text-2xl">🚗</span>
                          <div>
                            <p className="font-semibold">{poliza.vehiculo.marca} {poliza.vehiculo.modelo}</p>
                            <p className="text-slate-400 text-sm">{poliza.vehiculo.dominio} • {poliza.vehiculo.anio}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Detalles en grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Cobertura</p>
                          <p className="font-medium">{poliza.tipo_cobertura}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Suma Asegurada</p>
                          <p className="font-medium">${poliza.suma_asegurada?.toLocaleString('es-AR')}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Premio Total</p>
                          <p className="font-bold text-green-400">${poliza.premio_total?.toLocaleString('es-AR')}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Vencimiento</p>
                          <p className="font-medium">{new Date(poliza.fecha_vencimiento).toLocaleDateString('es-AR')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-slate-700/30 flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        Vigencia: {new Date(poliza.fecha_inicio).toLocaleDateString('es-AR')} - {new Date(poliza.fecha_vencimiento).toLocaleDateString('es-AR')}
                      </span>
                      <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Ver PDF →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MIS VEHÍCULOS - GRID HORIZONTAL */}
        {state.activeTab === 'vehiculos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestión de Vehículos</h2>
              <span className="text-slate-400">{state.vehiculos.length} vehículo(s)</span>
            </div>
            
            {state.vehiculos.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                <span className="text-6xl">🚗</span>
                <p className="text-slate-400 mt-4">No tienes vehículos registrados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {state.vehiculos.map(vehiculo => (
                  <div key={vehiculo.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-green-500/50 transition">
                    {/* Header */}
                    <div className="bg-slate-700/50 px-6 py-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🚗</span>
                        <div>
                          <p className="font-bold">{vehiculo.marca} {vehiculo.modelo}</p>
                          <p className="text-slate-400 text-sm">{vehiculo.tipo_vehiculo}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        vehiculo.estado === 'activo' 
                          ? 'bg-green-600/30 text-green-300' 
                          : 'bg-slate-600/30 text-slate-300'
                      }`}>
                        {vehiculo.estado}
                      </span>
                    </div>
                    
                    {/* Cuerpo */}
                    <div className="p-6">
                      {/* Dominio destacado */}
                      <div className="bg-slate-700/50 rounded-xl p-4 text-center mb-4">
                        <p className="text-slate-500 text-xs mb-1">Dominio/Patente</p>
                        <p className="text-3xl font-black text-blue-400 tracking-wider">{vehiculo.dominio}</p>
                      </div>
                      
                      {/* Detalles en grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Año</p>
                          <p className="font-bold text-2xl">{vehiculo.anio}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Uso</p>
                          <p className="font-medium capitalize">{vehiculo.uso || 'Particular'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SOPORTE */}
        {state.activeTab === 'soporte' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Soporte</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contacto Directo */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4">📞 Contacto Directo</h3>
                <div className="space-y-4">
                  <a 
                    href="https://wa.me/5493416952259" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-green-600/20 hover:bg-green-600/30 rounded-xl transition"
                  >
                    <span className="text-3xl">💬</span>
                    <div>
                      <p className="font-semibold">WhatsApp</p>
                      <p className="text-slate-400 text-sm">+54 9 341 695-2259</p>
                    </div>
                  </a>
                  
                  <a 
                    href="tel:+5493416952259"
                    className="flex items-center gap-4 p-4 bg-blue-600/20 hover:bg-blue-600/30 rounded-xl transition"
                  >
                    <span className="text-3xl">📱</span>
                    <div>
                      <p className="font-semibold">Teléfono</p>
                      <p className="text-slate-400 text-sm">+54 9 341 695-2259</p>
                    </div>
                  </a>
                  
                  <a 
                    href="mailto:aymaseguros@hotmail.com"
                    className="flex items-center gap-4 p-4 bg-purple-600/20 hover:bg-purple-600/30 rounded-xl transition"
                  >
                    <span className="text-3xl">✉️</span>
                    <div>
                      <p className="font-semibold">Email</p>
                      <p className="text-slate-400 text-sm">aymaseguros@hotmail.com</p>
                    </div>
                  </a>
                </div>
              </div>
              
              {/* Horarios */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4">🕐 Horarios de Atención</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Lunes a Viernes</span>
                    <span className="font-medium">9:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Sábados</span>
                    <span className="font-medium">9:00 - 13:00</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Emergencias 24hs</span>
                    <span className="text-green-400 font-medium">WhatsApp</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-600/20 rounded-xl">
                  <p className="text-sm text-blue-200">
                    <strong>💡 Tip:</strong> Para siniestros o emergencias fuera de horario, 
                    envianos un WhatsApp y te respondemos a la brevedad.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">❓ Preguntas Frecuentes</h3>
              <div className="space-y-4">
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg">
                    ¿Cómo denuncio un siniestro?
                  </summary>
                  <p className="px-4 pb-4 text-slate-400">
                    Contactanos por WhatsApp o teléfono lo antes posible. Te guiaremos en el proceso 
                    y gestionamos todo con la compañía aseguradora.
                  </p>
                </details>
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg">
                    ¿Cómo pago mi póliza?
                  </summary>
                  <p className="px-4 pb-4 text-slate-400">
                    Podés pagar con tarjeta de crédito (débito automático), transferencia bancaria 
                    o en efectivo en Rapipago/Pago Fácil.
                  </p>
                </details>
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg">
                    ¿Cómo solicito una cotización?
                  </summary>
                  <p className="px-4 pb-4 text-slate-400">
                    Escribinos por WhatsApp con los datos del vehículo (marca, modelo, año, patente) 
                    y te enviamos opciones de cobertura en minutos.
                  </p>
                </details>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          <p>© 2025 AYMA Advisors - Productores Asesores de Seguros</p>
          <p className="mt-1">Matrícula PAS N° 68323 • Rosario, Santa Fe</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
