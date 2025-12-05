import React, { useState, useEffect } from 'react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Generador de Token único para tickets/siniestros
const generarToken = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AYMA-${timestamp}-${random}`;
};

// Estado inicial
const initialState = {
  user: null,
  token: null,
  activeTab: 'dashboard',
  polizas: [],
  vehiculos: [],
  clientes: [],
  leads: [],
  dashboardData: null,
  loading: false,
  error: null
};

function App() {
  const [state, setState] = useState(initialState);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // Estado para formulario de siniestro
  const [siniestroForm, setSiniestroForm] = useState({
    poliza_id: '',
    tipo_siniestro: '',
    fecha_siniestro: '',
    hora_siniestro: '',
    lugar: '',
    descripcion: '',
    hay_terceros: false,
    hay_lesionados: false,
    datos_tercero: '',
    fotos_descripcion: ''
  });
  const [siniestroEnviado, setSiniestroEnviado] = useState(null);
  
  // Estado para ticket de soporte
  const [soporteForm, setSoporteForm] = useState({
    asunto: '',
    mensaje: '',
    prioridad: 'media'
  });
  const [ticketEnviado, setTicketEnviado] = useState(null);

  // Verificar token al cargar
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setState(prev => ({ ...prev, token: savedToken, user: JSON.parse(savedUser) }));
      cargarDatosConToken(savedToken);
    }
  }, []);

  // Función para hacer peticiones autenticadas
  const fetchAPI = async (endpoint, authToken) => {
    const response = await fetch(API_URL + endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      }
    });
    if (!response.ok) {
      throw new Error('Error: ' + response.status);
    }
    return response.json();
  };

  // Cargar datos con token explícito
  const cargarDatosConToken = async (authToken) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const dashboardRes = await fetchAPI('/api/v1/dashboard/', authToken);
      const polizasRes = await fetchAPI('/api/v1/polizas/', authToken);
      const vehiculosRes = await fetchAPI('/api/v1/vehiculos/', authToken);
      
      // Cargar clientes si es admin
      let clientesRes = [];
      let leadsRes = [];
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const tipoUsuario = savedUser.tipo_usuario?.toUpperCase();
      if (tipoUsuario === 'ADMIN' || tipoUsuario === 'ADMINISTRADOR') {
        try {
          clientesRes = await fetchAPI('/api/v1/admin/clientes', authToken);
          leadsRes = await fetchAPI('/api/v1/leads/', authToken);
        } catch (e) {
          console.log('No se pudieron cargar clientes/leads:', e.message);
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        dashboardData: dashboardRes,
        polizas: polizasRes || [],
        vehiculos: vehiculosRes || [],
        clientes: clientesRes || [],
        leads: leadsRes || [],
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
    if (tab !== 'siniestro') {
      setSiniestroEnviado(null);
    }
  };

  // Verificar si es admin
  const isAdmin = () => {
    const tipo = state.user?.tipo_usuario?.toUpperCase();
    return tipo === 'ADMIN' || tipo === 'ADMINISTRADOR';
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(API_URL + '/api/v1/auth/login', {
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
      
      // Cargar datos inmediatamente después del login
      cargarDatosConToken(data.access_token);
      
    } catch (err) {
      setState(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  // Enviar denuncia de siniestro
  const handleEnviarSiniestro = async (e) => {
    e.preventDefault();
    
    const token = generarToken();
    const fechaRegistro = new Date().toISOString();
    
    const siniestroData = {
      ...siniestroForm,
      token: token,
      fecha_registro: fechaRegistro,
      estado: 'PENDIENTE',
      cliente_email: state.user?.email,
      cliente_nombre: state.dashboardData?.cliente?.nombre
    };
    
    console.log('Siniestro registrado:', siniestroData);
    
    setSiniestroEnviado({
      token: token,
      fecha: fechaRegistro,
      poliza: state.polizas.find(p => p.id === siniestroForm.poliza_id)
    });
    
    setSiniestroForm({
      poliza_id: '',
      tipo_siniestro: '',
      fecha_siniestro: '',
      hora_siniestro: '',
      lugar: '',
      descripcion: '',
      hay_terceros: false,
      hay_lesionados: false,
      datos_tercero: '',
      fotos_descripcion: ''
    });
  };

  // Enviar ticket de soporte
  const handleEnviarTicket = async (e) => {
    e.preventDefault();
    
    const token = generarToken();
    const fechaRegistro = new Date().toISOString();
    
    const ticketData = {
      ...soporteForm,
      token: token,
      fecha_registro: fechaRegistro,
      estado: 'ABIERTO',
      cliente_email: state.user?.email,
      cliente_nombre: state.dashboardData?.cliente?.nombre
    };
    
    console.log('Ticket registrado:', ticketData);
    
    setTicketEnviado({
      token: token,
      fecha: fechaRegistro,
      asunto: soporteForm.asunto
    });
    
    setSoporteForm({
      asunto: '',
      mensaje: '',
      prioridad: 'media'
    });
  };

  // =============================================
  // RENDERIZADO
  // =============================================

  // Login Form
  if (!state.token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
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
          
          <p className="text-center text-slate-400 text-xs mt-6">
            © 2025 AYMA Advisors • PAS N° 68323
          </p>
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
              <span className="text-slate-300 hidden md:inline">{state.user?.email}</span>
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
              { id: 'siniestro', icon: '🚨', label: 'Denunciar Siniestro' },
              { id: 'soporte', icon: '💬', label: 'Soporte' },
              ...(isAdmin() ? [
                { id: 'leads', icon: '🎯', label: 'Leads', admin: true },
                { id: 'clientes', icon: '👥', label: 'Clientes', admin: true }
              ] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 rounded-lg font-medium transition whitespace-nowrap text-sm ${
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

              {/* Tarjeta Clientes - Solo Admin */}
              {isAdmin() && (
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-cyan-200 text-sm">Clientes</p>
                      <p className="text-4xl font-bold mt-2">{state.dashboardData?.totalClientes || state.clientes.length || 0}</p>
                    </div>
                    <span className="text-4xl">👥</span>
                  </div>
                  <p className="text-cyan-200 text-sm mt-4">Clientes activos</p>
                </div>
              )}

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

        {/* DENUNCIAR SINIESTRO */}
        {state.activeTab === 'siniestro' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">🚨 Denunciar Siniestro</h2>
            
            {siniestroEnviado ? (
              <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-8 text-center">
                <span className="text-6xl">✅</span>
                <h3 className="text-2xl font-bold text-green-400 mt-4">Denuncia Registrada</h3>
                <p className="text-slate-300 mt-2">Tu denuncia ha sido registrada exitosamente</p>
                
                <div className="bg-slate-800/80 rounded-xl p-6 mt-6 max-w-md mx-auto">
                  <p className="text-slate-500 text-sm">Número de Ticket</p>
                  <p className="text-3xl font-mono font-bold text-blue-400 mt-2">{siniestroEnviado.token}</p>
                  <p className="text-slate-400 text-sm mt-4">
                    Guardá este número para seguimiento. Te contactaremos a la brevedad.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                  <a 
                    href={`https://wa.me/5493416952259?text=Hola, acabo de registrar un siniestro con el ticket ${siniestroEnviado.token}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition inline-flex items-center justify-center gap-2"
                  >
                    💬 Contactar por WhatsApp
                  </a>
                  <button 
                    onClick={() => setSiniestroEnviado(null)}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
                  >
                    Nueva Denuncia
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario de Denuncia */}
                <div className="lg:col-span-2 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">📋 Formulario de Denuncia</h3>
                  
                  <form onSubmit={handleEnviarSiniestro} className="space-y-6">
                    {/* Selección de Póliza */}
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Póliza Afectada *</label>
                      <select
                        value={siniestroForm.poliza_id}
                        onChange={(e) => setSiniestroForm({...siniestroForm, poliza_id: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Seleccionar póliza...</option>
                        {state.polizas.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.numero_poliza} - {p.vehiculo?.marca} {p.vehiculo?.modelo} ({p.vehiculo?.dominio})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo de Siniestro */}
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Tipo de Siniestro *</label>
                      <select
                        value={siniestroForm.tipo_siniestro}
                        onChange={(e) => setSiniestroForm({...siniestroForm, tipo_siniestro: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Seleccionar tipo...</option>
                        <option value="colision">Colisión / Choque</option>
                        <option value="robo_total">Robo Total</option>
                        <option value="robo_parcial">Robo Parcial / Ruedas</option>
                        <option value="incendio">Incendio</option>
                        <option value="granizo">Granizo</option>
                        <option value="inundacion">Inundación</option>
                        <option value="cristales">Rotura de Cristales</option>
                        <option value="vandalismo">Vandalismo</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    {/* Fecha y Hora */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">Fecha del Hecho *</label>
                        <input
                          type="date"
                          value={siniestroForm.fecha_siniestro}
                          onChange={(e) => setSiniestroForm({...siniestroForm, fecha_siniestro: e.target.value})}
                          className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">Hora Aproximada</label>
                        <input
                          type="time"
                          value={siniestroForm.hora_siniestro}
                          onChange={(e) => setSiniestroForm({...siniestroForm, hora_siniestro: e.target.value})}
                          className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Lugar */}
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Lugar del Hecho *</label>
                      <input
                        type="text"
                        value={siniestroForm.lugar}
                        onChange={(e) => setSiniestroForm({...siniestroForm, lugar: e.target.value})}
                        placeholder="Ej: Av. Pellegrini y Corrientes, Rosario"
                        className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
                        <input
                          type="checkbox"
                          checked={siniestroForm.hay_terceros}
                          onChange={(e) => setSiniestroForm({...siniestroForm, hay_terceros: e.target.checked})}
                          className="w-5 h-5 rounded"
                        />
                        <span>¿Hubo terceros involucrados?</span>
                      </label>
                      <label className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
                        <input
                          type="checkbox"
                          checked={siniestroForm.hay_lesionados}
                          onChange={(e) => setSiniestroForm({...siniestroForm, hay_lesionados: e.target.checked})}
                          className="w-5 h-5 rounded"
                        />
                        <span>¿Hubo lesionados?</span>
                      </label>
                    </div>

                    {/* Datos del tercero si aplica */}
                    {siniestroForm.hay_terceros && (
                      <div>
                        <label className="block text-slate-400 text-sm mb-2">Datos del Tercero</label>
                        <textarea
                          value={siniestroForm.datos_tercero}
                          onChange={(e) => setSiniestroForm({...siniestroForm, datos_tercero: e.target.value})}
                          placeholder="Nombre, patente, teléfono, aseguradora del tercero..."
                          rows={3}
                          className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Descripción */}
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Descripción de los Hechos *</label>
                      <textarea
                        value={siniestroForm.descripcion}
                        onChange={(e) => setSiniestroForm({...siniestroForm, descripcion: e.target.value})}
                        placeholder="Contanos qué pasó con el mayor detalle posible..."
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Fotos */}
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">📷 Fotos / Documentación</label>
                      <div className="bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-xl p-6 text-center">
                        <p className="text-slate-400 mb-2">Las fotos podés enviarlas por WhatsApp</p>
                        <p className="text-slate-500 text-sm">Tomá fotos de: daños, patentes, lugar, documentos del tercero</p>
                      </div>
                    </div>

                    {/* Botón Enviar */}
                    <button
                      type="submit"
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition text-lg"
                    >
                      🚨 Enviar Denuncia de Siniestro
                    </button>
                  </form>
                </div>

                {/* Panel lateral - Contacto */}
                <div className="space-y-6">
                  {/* Contacto de Emergencia */}
                  <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-red-400 mb-4">🆘 Emergencia 24hs</h3>
                    <a 
                      href="https://wa.me/5493416952259?text=URGENTE: Necesito reportar un siniestro"
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-green-600/20 hover:bg-green-600/30 rounded-xl transition"
                    >
                      <span className="text-3xl">💬</span>
                      <div>
                        <p className="font-semibold text-green-400">WhatsApp Directo</p>
                        <p className="text-slate-400 text-sm">+54 9 341 695-2259</p>
                      </div>
                    </a>
                    <p className="text-slate-400 text-sm mt-4">
                      Para siniestros graves o urgentes, contactanos directamente.
                    </p>
                  </div>

                  {/* Otros canales */}
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4">📞 Otros Canales</h3>
                    <div className="space-y-3">
                      <a 
                        href="tel:+5493416952259"
                        className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition"
                      >
                        <span className="text-xl">📱</span>
                        <div>
                          <p className="font-medium">Teléfono</p>
                          <p className="text-slate-400 text-sm">+54 9 341 695-2259</p>
                        </div>
                      </a>
                      <a 
                        href="mailto:aymaseguros@hotmail.com"
                        className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition"
                      >
                        <span className="text-xl">✉️</span>
                        <div>
                          <p className="font-medium">Email</p>
                          <p className="text-slate-400 text-sm">aymaseguros@hotmail.com</p>
                        </div>
                      </a>
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-400 mb-4">💡 Importante</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li>• No muevas el vehículo si hubo lesionados</li>
                      <li>• Tomá fotos antes de mover nada</li>
                      <li>• Anotá datos del tercero y testigos</li>
                      <li>• Hacé la denuncia policial si corresponde</li>
                      <li>• Contactanos dentro de las 72hs</li>
                    </ul>
                  </div>
                </div>
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

            {/* Formulario de Ticket */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">🎫 Crear Ticket de Soporte</h3>
              
              {ticketEnviado ? (
                <div className="bg-green-900/30 border border-green-500 rounded-xl p-6 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-green-400 mb-2">¡Ticket Enviado!</h3>
                  <div className="bg-slate-800 rounded-lg p-4 my-4 inline-block">
                    <p className="text-slate-400 text-sm">Tu número de ticket:</p>
                    <p className="text-2xl font-mono font-bold text-white">{ticketEnviado.token}</p>
                  </div>
                  <p className="text-slate-300 mb-4">
                    Guardá este código para dar seguimiento a tu consulta.
                  </p>
                  <p className="text-slate-400 text-sm">
                    Te responderemos a la brevedad por email o WhatsApp.
                  </p>
                  <button
                    onClick={() => setTicketEnviado(null)}
                    className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                  >
                    Crear otro ticket
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnviarTicket} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Asunto *</label>
                    <input
                      type="text"
                      required
                      value={soporteForm.asunto}
                      onChange={(e) => setSoporteForm({...soporteForm, asunto: e.target.value})}
                      placeholder="Ej: Consulta sobre cobertura"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Prioridad</label>
                    <select
                      value={soporteForm.prioridad}
                      onChange={(e) => setSoporteForm({...soporteForm, prioridad: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none"
                    >
                      <option value="baja">Baja - Consulta general</option>
                      <option value="media">Media - Requiere atención</option>
                      <option value="alta">Alta - Urgente</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Mensaje *</label>
                    <textarea
                      required
                      rows={4}
                      value={soporteForm.mensaje}
                      onChange={(e) => setSoporteForm({...soporteForm, mensaje: e.target.value})}
                      placeholder="Describí tu consulta o problema..."
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition text-lg"
                  >
                    📤 Enviar Ticket
                  </button>
                </form>
              )}
            </div>

            {/* FAQ */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">❓ Preguntas Frecuentes</h3>
              <div className="space-y-4">
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg font-medium">
                    ¿Cómo denuncio un siniestro?
                  </summary>
                  <p className="px-4 pb-4 text-slate-400">
                    Podés usar la sección "Denunciar Siniestro" de este portal o contactarnos por WhatsApp. 
                    Te guiamos en todo el proceso y gestionamos con la compañía aseguradora.
                  </p>
                </details>
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg font-medium">
                    ¿Cómo pago mi póliza?
                  </summary>
                  <p className="px-4 pb-4 text-slate-400">
                    Podés pagar con tarjeta de crédito (débito automático), transferencia bancaria 
                    o en efectivo en Rapipago/Pago Fácil.
                  </p>
                </details>
                <details className="bg-slate-700/30 rounded-lg">
                  <summary className="p-4 cursor-pointer hover:bg-slate-700/50 rounded-lg font-medium">
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

        {/* LEADS - Solo Admin */}
        {state.activeTab === 'leads' && isAdmin() && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">🎯 Leads</h2>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-blue-400">{state.leads.length}</p>
                <p className="text-slate-400 text-sm">Total Leads</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-green-400">{state.leads.filter(l => l.estado === 'nuevo' || l.estado === 'dato').length}</p>
                <p className="text-slate-400 text-sm">Nuevos</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-yellow-400">{state.leads.filter(l => l.estado === 'contactado').length}</p>
                <p className="text-slate-400 text-sm">Contactados</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-purple-400">{state.leads.filter(l => l.estado === 'cotizado').length}</p>
                <p className="text-slate-400 text-sm">Cotizados</p>
              </div>
            </div>

            {/* Tabla de Leads */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold">Lista de Leads</h3>
                <span className="text-sm text-slate-400">{state.leads.length} registros</span>
              </div>
              {state.leads.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400">No hay leads registrados</p>
                  <p className="text-slate-500 text-sm mt-2">Los leads del chatbot aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Teléfono</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Origen</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {state.leads.map((lead, idx) => (
                        <tr key={lead.id || idx} className="hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {new Date(lead.created_at).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{lead.nombre}</td>
                          <td className="px-4 py-3 text-sm">
                            <a href={`https://wa.me/54${lead.telefono}`} target="_blank" rel="noopener noreferrer" 
                               className="text-green-400 hover:text-green-300">
                              📱 {lead.telefono}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">{lead.tipo_seguro || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              lead.origen === 'chatbot' ? 'bg-blue-500/20 text-blue-400' :
                              lead.origen === 'landing' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {lead.origen}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              lead.estado === 'nuevo' || lead.estado === 'dato' ? 'bg-green-500/20 text-green-400' :
                              lead.estado === 'contactado' ? 'bg-yellow-500/20 text-yellow-400' :
                              lead.estado === 'cotizado' ? 'bg-blue-500/20 text-blue-400' :
                              lead.estado === 'cliente' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {lead.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLIENTES - Solo Admin */}
        {state.activeTab === 'clientes' && isAdmin() && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">👥 Clientes</h2>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-cyan-400">{state.clientes.length}</p>
                <p className="text-slate-400 text-sm">Total Clientes</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-blue-400">{state.polizas.length}</p>
                <p className="text-slate-400 text-sm">Pólizas Vigentes</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-green-400">{state.vehiculos.length}</p>
                <p className="text-slate-400 text-sm">Vehículos</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-3xl font-bold text-yellow-400">{state.dashboardData?.porVencer30d || 0}</p>
                <p className="text-slate-400 text-sm">Por Vencer (30d)</p>
              </div>
            </div>

            {/* Lista de Clientes */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold">Lista de Clientes</h3>
              </div>
              {state.clientes.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400">Cargando clientes...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Documento</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Teléfono</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Scoring</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {state.clientes.map((cliente, idx) => (
                        <tr key={cliente.id || idx} className="hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-sm">{cliente.nombre} {cliente.apellido}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{cliente.email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{cliente.documento}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{cliente.telefono || '-'}</td>
                          <td className="px-4 py-3 text-sm text-green-400">{cliente.scoring || 0} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Footer con Compliance */}
      <footer className="bg-slate-800/30 border-t border-slate-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          
          {/* Grid superior */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Logo + descripción */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 80 96" fill="none">
                    <path d="M40 0L80 16V48C80 72 60 88 40 96C20 88 0 72 0 48V16L40 0Z" stroke="currentColor" strokeWidth="4" fill="none"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg">AYMA Advisors</h3>
                  <p className="text-xs text-slate-500">Gestores de Riesgos desde 2008</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 max-w-md">
                Asesores integrales en seguros para personas y empresas. 
                Comparamos las mejores opciones del mercado para proteger lo que más te importa.
              </p>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="font-semibold mb-4 text-slate-300">Contacto</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="tel:+5493416952259" className="hover:text-white transition">
                    📞 341 695-2259
                  </a>
                </li>
                <li>
                  <a href="tel:+5491153022929" className="hover:text-white transition">
                    📞 11 5302-2929
                  </a>
                </li>
                <li>
                  <a href="mailto:aymaseguros@hotmail.com" className="hover:text-white transition">
                    📧 aymaseguros@hotmail.com
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/5493416952259" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    💬 WhatsApp
                  </a>
                </li>
              </ul>
            </div>

            {/* Oficinas */}
            <div>
              <h4 className="font-semibold mb-4 text-slate-300">Oficinas</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>📍 Rosario: Mariano Moreno 37, Piso 9 A</li>
                <li>📍 CABA: Manzoni 112</li>
              </ul>
            </div>
          </div>

          {/* Disclaimers legales */}
          <div className="border-t border-slate-700 pt-6">
            <div className="text-xs text-slate-500 space-y-2">
              <p>
                <strong>AYMA Advisors</strong> — Matrícula PAS N° 68323 inscripta ante la 
                Superintendencia de Seguros de la Nación (SSN). Asesoramiento de seguros 
                sujeto a Condiciones Particulares y Normativa SSN vigente.
              </p>
              <p>
                *El ahorro promedio del 35% está basado en clientes con dos o más pólizas 
                y perfil de riesgo bajo durante 2024. Los resultados individuales pueden 
                variar según compañía aseguradora, tipo de cobertura y antecedentes.
              </p>
              <p>
                Protección de datos personales conforme Ley 25.326 (AAIP). 
                <a href="/privacidad" className="underline hover:text-slate-300 ml-1">Política de Privacidad</a>
                {' | '}
                <a href="/terminos" className="underline hover:text-slate-300">Términos y Condiciones</a>
              </p>
            </div>
            
            <p className="text-center text-slate-600 text-xs mt-6">
              © {new Date().getFullYear()} AYMA Advisors. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
