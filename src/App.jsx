import { useState, useEffect } from 'react';

const API_URL = 'https://ayma-portal-backend.onrender.com';

// Estado inicial
const initialState = {
  currentPage: 'login',
  user: null,
  token: null,
  polizas: [],
  vehiculos: [],
  clientes: [],
  leads: [],
  dashboardData: null,
  loading: false,
  error: null,
  siniestroForm: {
    tipo: '',
    fecha: '',
    descripcion: '',
    polizaId: ''
  },
  ticketForm: {
    asunto: '',
    mensaje: '',
    prioridad: 'media'
  }
};

export default function App() {
  const [state, setState] = useState(initialState);

  // Restaurar sesión al cargar
  useEffect(() => {
    console.log('🚀 App iniciada - verificando localStorage...');
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      console.log('🔑 Token encontrado, restaurando sesión...');
      try {
        const user = JSON.parse(savedUser);
        setState(prev => ({
          ...prev,
          token: savedToken,
          user: user,
          currentPage: 'dashboard'
        }));
        cargarDatosConToken(savedToken, user);
      } catch (e) {
        console.log('❌ Error parseando usuario:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      console.log('⚠️ No hay sesión guardada');
    }
  }, []);

  // Función para hacer fetch con manejo de 401
  const fetchAPI = async (endpoint, authToken, options = {}) => {
    try {
      const response = await fetch(API_URL + endpoint, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authToken,
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      
      if (response.status === 401) {
        console.log('⚠️ Token expirado (401), limpiando sesión...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setState(initialState);
        return null;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('❌ Error en fetchAPI:', error);
      throw error;
    }
  };

  // Cargar datos después del login
  const cargarDatosConToken = async (authToken, userData) => {
    console.log('🔄 Cargando datos para:', userData.email);
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      // Dashboard
      console.log('📊 Llamando a /api/v1/dashboard/');
      const dashboardRes = await fetchAPI('/api/v1/dashboard/', authToken);
      if (!dashboardRes) return; // Token expirado
      console.log('✅ Dashboard recibido:', dashboardRes);
      
      // Pólizas
      console.log('📄 Llamando a /api/v1/polizas/');
      const polizasRes = await fetchAPI('/api/v1/polizas/', authToken);
      if (!polizasRes) return;
      console.log('✅ Pólizas recibidas:', polizasRes.length || 0);
      
      // Vehículos
      console.log('🚗 Llamando a /api/v1/vehiculos/');
      const vehiculosRes = await fetchAPI('/api/v1/vehiculos/', authToken);
      if (!vehiculosRes) return;
      console.log('✅ Vehículos recibidos:', vehiculosRes.length || 0);
      
      // Si es admin, cargar clientes
      let clientesData = [];
      const tipoUsuario = userData.tipo_usuario?.toUpperCase();
      if (tipoUsuario === 'ADMIN' || tipoUsuario === 'ADMINISTRADOR') {
        console.log('👥 Usuario admin - cargando clientes...');
        try {
          const clientesRes = await fetchAPI('/api/v1/admin/clientes', authToken);
          if (clientesRes) {
            clientesData = clientesRes;
            console.log('✅ Clientes recibidos:', clientesData.length);
          }
        } catch (e) {
          console.log('⚠️ Error cargando clientes:', e.message);
        }
      }
      
      setState(prev => ({
        ...prev,
        dashboardData: dashboardRes,
        polizas: Array.isArray(polizasRes) ? polizasRes : [],
        vehiculos: Array.isArray(vehiculosRes) ? vehiculosRes : [],
        clientes: clientesData,
        loading: false,
        error: null
      }));
      
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message 
      }));
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    console.log('🔐 Intentando login con:', email);
    
    try {
      const response = await fetch(API_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Error en el login');
      }
      
      console.log('✅ Login exitoso:', data);
      
      const userData = {
        email: data.email || email,
        tipo_usuario: data.tipo_usuario || 'cliente',
        nombre: data.nombre || email.split('@')[0]
      };
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setState(prev => ({
        ...prev,
        token: data.access_token,
        user: userData,
        currentPage: 'dashboard',
        loading: false
      }));
      
      cargarDatosConToken(data.access_token, userData);
      
    } catch (error) {
      console.error('❌ Error login:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message 
      }));
    }
  };

  // Logout
  const handleLogout = () => {
    console.log('👋 Cerrando sesión...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState(initialState);
  };

  // Verificar si es admin
  const isAdmin = () => {
    const tipo = state.user?.tipo_usuario?.toUpperCase();
    return tipo === 'ADMIN' || tipo === 'ADMINISTRADOR';
  };

  // Renderizar página actual
  const renderPage = () => {
    switch (state.currentPage) {
      case 'login':
        return <LoginPage onLogin={handleLogin} loading={state.loading} error={state.error} />;
      case 'dashboard':
        return <DashboardPage state={state} isAdmin={isAdmin()} />;
      case 'datos':
        return <DatosPage user={state.user} dashboardData={state.dashboardData} />;
      case 'polizas':
        return <PolizasPage polizas={state.polizas} />;
      case 'vehiculos':
        return <VehiculosPage vehiculos={state.vehiculos} />;
      case 'siniestro':
        return <SiniestroPage state={state} setState={setState} />;
      case 'soporte':
        return <SoportePage state={state} setState={setState} />;
      case 'leads':
        return <LeadsPage leads={state.leads} />;
      case 'clientes':
        return <ClientesPage clientes={state.clientes} dashboardData={state.dashboardData} />;
      default:
        return <DashboardPage state={state} isAdmin={isAdmin()} />;
    }
  };

  // Si no está logueado, mostrar login
  if (!state.token) {
    return <LoginPage onLogin={handleLogin} loading={state.loading} error={state.error} />;
  }

  // Layout principal
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Portal AYMA</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{state.user?.email}</span>
            <span className="bg-blue-600 px-3 py-1 rounded-full text-sm font-medium">
              {state.user?.tipo_usuario?.toUpperCase()}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      {/* Navegación */}
      <nav className="bg-gray-800/50 px-6 py-3 border-b border-gray-700">
        <div className="flex gap-2 flex-wrap">
          <NavButton 
            active={state.currentPage === 'dashboard'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'dashboard' }))}
            icon="📊"
            label="Dashboard"
          />
          <NavButton 
            active={state.currentPage === 'datos'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'datos' }))}
            icon="👤"
            label="Mis Datos"
          />
          <NavButton 
            active={state.currentPage === 'polizas'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'polizas' }))}
            icon="📄"
            label="Mis Pólizas"
          />
          <NavButton 
            active={state.currentPage === 'vehiculos'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'vehiculos' }))}
            icon="🚗"
            label="Mis Vehículos"
          />
          <NavButton 
            active={state.currentPage === 'siniestro'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'siniestro' }))}
            icon="🚨"
            label="Denunciar Siniestro"
          />
          <NavButton 
            active={state.currentPage === 'soporte'} 
            onClick={() => setState(prev => ({ ...prev, currentPage: 'soporte' }))}
            icon="💬"
            label="Soporte"
          />
          
          {/* Links solo para Admin */}
          {isAdmin() && (
            <>
              <div className="w-px bg-gray-600 mx-2"></div>
              <NavButton 
                active={state.currentPage === 'leads'} 
                onClick={() => setState(prev => ({ ...prev, currentPage: 'leads' }))}
                icon="🎯"
                label="Leads"
                adminOnly
              />
              <NavButton 
                active={state.currentPage === 'clientes'} 
                onClick={() => setState(prev => ({ ...prev, currentPage: 'clientes' }))}
                icon="👥"
                label="Clientes"
                adminOnly
              />
            </>
          )}
        </div>
      </nav>

      {/* Contenido */}
      <main className="p-6">
        {state.loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl">⏳ Cargando...</div>
          </div>
        ) : (
          renderPage()
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-8 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-2">AYMA Advisors</h3>
            <p className="text-gray-400 text-sm">Gestores de Riesgos desde 2008</p>
            <p className="text-gray-400 text-sm mt-2">
              Asesores integrales en seguros para personas y empresas.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Contacto</h3>
            <p className="text-gray-400 text-sm">📞 341 695-2259</p>
            <p className="text-gray-400 text-sm">📞 11 5302-2929</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Oficinas</h3>
            <p className="text-gray-400 text-sm">📍 Rosario: Mariano Moreno 37, Piso 9 A</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Componente NavButton
function NavButton({ active, onClick, icon, label, adminOnly }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : adminOnly 
            ? 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      }`}
    >
      {icon} {label}
    </button>
  );
}

// Página de Login
function LoginPage({ onLogin, loading, error }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Portal AYMA</h1>
          <p className="text-gray-400">Gestores de Riesgos desde 2008</p>
        </div>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            ❌ {error}
          </div>
        )}
        
        <form onSubmit={onLogin} className="space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="tu@email.com"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? '⏳ Ingresando...' : '🔐 Ingresar'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>¿Problemas para ingresar?</p>
          <a href="https://wa.me/5493416952259" className="text-blue-400 hover:underline">
            Contactanos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

// Dashboard
function DashboardPage({ state, isAdmin }) {
  const totalPrimas = state.polizas.reduce((sum, p) => sum + (parseFloat(p.premio_total) || 0), 0);
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      
      {/* Tarjetas - 5 columnas para admin, 4 para cliente */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        
        {/* Pólizas */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-200 text-sm">Mis Pólizas</p>
              <p className="text-4xl font-bold mt-2">
                {state.dashboardData?.totalPolizas || state.polizas.length}
              </p>
              <p className="text-blue-200 text-sm mt-1">Pólizas vigentes</p>
            </div>
            <span className="text-4xl">📄</span>
          </div>
        </div>
        
        {/* Vehículos */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-200 text-sm">Mis Vehículos</p>
              <p className="text-4xl font-bold mt-2">
                {state.dashboardData?.totalVehiculos || state.vehiculos.length}
              </p>
              <p className="text-green-200 text-sm mt-1">Vehículos asegurados</p>
            </div>
            <span className="text-4xl">🚗</span>
          </div>
        </div>
        
        {/* Clientes - SOLO ADMIN */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-cyan-200 text-sm">Clientes</p>
                <p className="text-4xl font-bold mt-2">
                  {state.dashboardData?.totalClientes || state.clientes.length || 0}
                </p>
                <p className="text-cyan-200 text-sm mt-1">Clientes activos</p>
              </div>
              <span className="text-4xl">👥</span>
            </div>
          </div>
        )}
        
        {/* Tickets */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-200 text-sm">Tickets Abiertos</p>
              <p className="text-4xl font-bold mt-2">
                {state.dashboardData?.ticketsAbiertos || 0}
              </p>
              <p className="text-purple-200 text-sm mt-1">En seguimiento</p>
            </div>
            <span className="text-4xl">📬</span>
          </div>
        </div>
        
        {/* Total Primas */}
        <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-orange-200 text-sm">Total Primas</p>
              <p className="text-3xl font-bold mt-2">
                ${totalPrimas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-orange-200 text-sm mt-1">Prima total anual</p>
            </div>
            <span className="text-4xl">💰</span>
          </div>
        </div>
      </div>
      
      {/* Alertas para Admin */}
      {isAdmin && state.dashboardData?.polizasPorVencer > 0 && (
        <div className="mt-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ <strong>{state.dashboardData.polizasPorVencer}</strong> póliza(s) por vencer en los próximos 30 días
          </p>
        </div>
      )}
      
      {/* Top Clientes para Admin */}
      {isAdmin && state.dashboardData?.topClientes?.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">🏆 Top Clientes por Scoring</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {state.dashboardData.topClientes.map((cliente, idx) => (
              <div key={idx} className="bg-gray-700 rounded-lg p-4 text-center">
                <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                <p className="font-medium mt-2">{cliente.nombre}</p>
                <p className="text-sm text-gray-400">{cliente.scoring || 0} pts</p>
                <p className="text-xs text-gray-500">{cliente.cantidad_polizas || 0} póliza(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Página Mis Datos
function DatosPage({ user, dashboardData }) {
  const cliente = dashboardData?.cliente || {};
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">👤 Mis Datos</h2>
      <div className="bg-gray-800 rounded-xl p-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-gray-400 text-sm">Nombre</label>
            <p className="text-lg">{cliente.nombre || user?.nombre || '-'}</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Email</label>
            <p className="text-lg">{cliente.email || user?.email || '-'}</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Código de Cliente</label>
            <p className="text-lg">{cliente.codigo_cliente || '-'}</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Scoring Comercial</label>
            <p className="text-lg text-green-400 font-bold">{cliente.scoring || 0} puntos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Página Pólizas
function PolizasPage({ polizas }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📄 Mis Pólizas</h2>
      
      {polizas.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">No tienes pólizas registradas</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {polizas.map((poliza, idx) => (
            <div key={idx} className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold">{poliza.compania}</h3>
                  <p className="text-gray-400">Póliza: {poliza.numero_poliza}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {poliza.tipo_cobertura} - {poliza.ramo}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    poliza.estado === 'vigente' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {poliza.estado}
                  </span>
                  <p className="text-2xl font-bold text-green-400 mt-2">
                    ${parseFloat(poliza.premio_total || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-sm text-gray-500">Vence: {poliza.fecha_vencimiento}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Página Vehículos
function VehiculosPage({ vehiculos }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🚗 Mis Vehículos</h2>
      
      {vehiculos.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">No tienes vehículos registrados</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehiculos.map((vehiculo, idx) => (
            <div key={idx} className="bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <span className="text-4xl">🚗</span>
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  {vehiculo.dominio}
                </span>
              </div>
              <h3 className="text-lg font-bold">{vehiculo.marca} {vehiculo.modelo}</h3>
              <p className="text-gray-400">Año: {vehiculo.anio}</p>
              <p className="text-sm text-gray-500 mt-2">Uso: {vehiculo.uso}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Página Siniestro
function SiniestroPage({ state, setState }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('✅ Denuncia de siniestro enviada. Nos contactaremos pronto.');
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🚨 Denunciar Siniestro</h2>
      <div className="bg-gray-800 rounded-xl p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">Tipo de Siniestro</label>
            <select 
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              required
            >
              <option value="">Seleccionar...</option>
              <option value="accidente">Accidente</option>
              <option value="robo">Robo</option>
              <option value="incendio">Incendio</option>
              <option value="granizo">Granizo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">Fecha del Siniestro</label>
            <input 
              type="date" 
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">Descripción</label>
            <textarea 
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white h-32"
              placeholder="Describe lo ocurrido..."
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg"
          >
            📤 Enviar Denuncia
          </button>
        </form>
      </div>
    </div>
  );
}

// Página Soporte
function SoportePage({ state, setState }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('✅ Ticket enviado. Te responderemos pronto.');
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">💬 Soporte</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Crear Ticket</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Asunto</label>
              <input 
                type="text" 
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                placeholder="¿En qué podemos ayudarte?"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 mb-2">Mensaje</label>
              <textarea 
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white h-32"
                placeholder="Describe tu consulta..."
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
            >
              📤 Enviar Ticket
            </button>
          </form>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Contacto Directo</h3>
          <div className="space-y-4">
            <a 
              href="https://wa.me/5493416952259"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg"
            >
              <span className="text-2xl">📱</span>
              <span>WhatsApp Rosario</span>
            </a>
            
            <a 
              href="https://wa.me/5491153022929"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg"
            >
              <span className="text-2xl">📱</span>
              <span>WhatsApp CABA</span>
            </a>
            
            <a 
              href="mailto:aymaseguros@hotmail.com"
              className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg"
            >
              <span className="text-2xl">📧</span>
              <span>aymaseguros@hotmail.com</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Página Leads (Admin)
function LeadsPage({ leads }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🎯 Leads</h2>
      <div className="bg-gray-800 rounded-xl p-6">
        {leads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No hay leads registrados</p>
            <p className="text-sm text-gray-500 mt-2">Los leads del chatbot aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Nombre</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Teléfono</th>
                  <th className="pb-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50">
                    <td className="py-3">{lead.fecha}</td>
                    <td className="py-3">{lead.nombre}</td>
                    <td className="py-3">{lead.email}</td>
                    <td className="py-3">{lead.telefono}</td>
                    <td className="py-3">
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-sm">
                        {lead.estado || 'Nuevo'}
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
  );
}

// Página Clientes (Admin)
function ClientesPage({ clientes, dashboardData }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">👥 Clientes</h2>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">{dashboardData?.totalClientes || clientes.length}</p>
          <p className="text-sm text-gray-400">Total Clientes</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{dashboardData?.totalPolizas || 0}</p>
          <p className="text-sm text-gray-400">Pólizas Vigentes</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{dashboardData?.totalVehiculos || 0}</p>
          <p className="text-sm text-gray-400">Vehículos</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{dashboardData?.polizasPorVencer || 0}</p>
          <p className="text-sm text-gray-400">Por Vencer (30d)</p>
        </div>
      </div>
      
      {/* Lista de Clientes */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Lista de Clientes</h3>
        
        {clientes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Cargando clientes...</p>
            {dashboardData?.topClientes?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-4">Top 5 Clientes (del Dashboard):</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="pb-3">#</th>
                        <th className="pb-3">Nombre</th>
                        <th className="pb-3">Pólizas</th>
                        <th className="pb-3">Scoring</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.topClientes.map((cliente, idx) => (
                        <tr key={idx} className="border-b border-gray-700/50">
                          <td className="py-3">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
                          <td className="py-3 font-medium">{cliente.nombre}</td>
                          <td className="py-3">{cliente.cantidad_polizas || 0}</td>
                          <td className="py-3 text-green-400">{cliente.scoring || 0} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3">Nombre</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Documento</th>
                  <th className="pb-3">Teléfono</th>
                  <th className="pb-3">Scoring</th>
                  <th className="pb-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 font-medium">{cliente.nombre} {cliente.apellido}</td>
                    <td className="py-3 text-gray-400">{cliente.email}</td>
                    <td className="py-3 text-gray-400">{cliente.documento}</td>
                    <td className="py-3 text-gray-400">{cliente.telefono || '-'}</td>
                    <td className="py-3">
                      <span className="text-green-400 font-bold">{cliente.scoring || 0}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        cliente.activo !== false 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {cliente.activo !== false ? 'Activo' : 'Inactivo'}
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
  );
}
