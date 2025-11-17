import { useState, useEffect } from 'react'
import axios from 'axios'
import { dashboardService, polizasService, vehiculosService } from './services/api'
import './App.css'

const API_URL = 'https://ayma-portal-backend.onrender.com'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  
  // Estados para datos del dashboard
  const [dashboardData, setDashboardData] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [polizas, setPolizas] = useState([])
  const [vehiculos, setVehiculos] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedEmail = localStorage.getItem('email')
    const savedRole = localStorage.getItem('role')
    if (token && savedEmail) {
      setIsLoggedIn(true)
      setUserEmail(savedEmail)
      setUserRole(savedRole || 'cliente')
      // Cargar datos al iniciar sesión
      loadDashboardData()
    }
  }, [])

  // Cargar datos del dashboard
  const loadDashboardData = async () => {
    setLoadingDashboard(true)
    try {
      const [resumen, scoring] = await Promise.all([
        dashboardService.getResumen(),
        dashboardService.getScoring()
      ])
      setDashboardData({ ...resumen, scoring })
      
      // Cargar pólizas y vehículos
      const [polizasData, vehiculosData] = await Promise.all([
        polizasService.listar(),
        vehiculosService.listar()
      ])
      setPolizas(polizasData)
      setVehiculos(vehiculosData)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoadingDashboard(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
        email,
        password
      })

      const { access_token, email: userEmail, tipo_usuario } = response.data
      
      localStorage.setItem('token', access_token)
      localStorage.setItem('email', userEmail)
      localStorage.setItem('role', tipo_usuario)
      
      setIsLoggedIn(true)
      setUserEmail(userEmail)
      setUserRole(tipo_usuario)
      setError('')
      
      // Cargar datos después del login
      await loadDashboardData()
    } catch (err) {
      console.error('Error de login:', err)
      setError('⚠️ Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('role')
    setIsLoggedIn(false)
    setUserEmail('')
    setUserRole('')
    setActiveTab('dashboard')
    setDashboardData(null)
    setPolizas([])
    setVehiculos([])
  }

  const getRoleName = () => {
    const roles = {
      'admin': 'Administrador',
      'empleado': 'Empleado',
      'cliente': 'Cliente'
    }
    return roles[userRole] || 'Usuario'
  }

  const getRoleColor = () => {
    const colors = {
      'admin': 'text-red-600',
      'empleado': 'text-blue-600',
      'cliente': 'text-green-600'
    }
    return colors[userRole] || 'text-gray-600'
  }

  const getTabs = () => {
    const baseTabs = [
      { id: 'dashboard', label: '📊 Dashboard', roles: ['admin', 'empleado', 'cliente'] }
    ]

    if (userRole === 'admin') {
      return [
        ...baseTabs,
        { id: 'usuarios', label: '👥 Usuarios', roles: ['admin'] },
        { id: 'crm', label: '📈 CRM', roles: ['admin'] },
        { id: 'clientes', label: '👤 Clientes', roles: ['admin'] },
        { id: 'polizas', label: '📄 Pólizas', roles: ['admin'] },
        { id: 'vehiculos', label: '🚗 Vehículos', roles: ['admin'] },
        { id: 'reportes', label: '📊 Reportes', roles: ['admin'] }
      ]
    }

    if (userRole === 'empleado') {
      return [
        ...baseTabs,
        { id: 'crm', label: '📈 CRM', roles: ['empleado'] },
        { id: 'clientes', label: '👤 Clientes', roles: ['empleado'] },
        { id: 'polizas', label: '📄 Pólizas', roles: ['empleado'] },
        { id: 'vehiculos', label: '🚗 Vehículos', roles: ['empleado'] }
      ]
    }

    return [
      ...baseTabs,
      { id: 'datos', label: '👤 Mis Datos', roles: ['cliente'] },
      { id: 'polizas', label: '📄 Mis Pólizas', roles: ['cliente'] },
      { id: 'vehiculos', label: '🚗 Mis Vehículos', roles: ['cliente'] },
      { id: 'tickets', label: '🎫 Soporte', roles: ['cliente'] }
    ]
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Portal AYMA</h1>
            <p className="text-gray-600">Bienvenido al sistema de gestión</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '🔄 Ingresando...' : '🔐 Ingresar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const tabs = getTabs()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Portal AYMA</h1>
              <p className="text-sm text-gray-600">{userEmail}</p>
              <p className={`text-xs font-semibold ${getRoleColor()}`}>
                {getRoleName()}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingDashboard && activeTab === 'dashboard' && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && !loadingDashboard && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Dashboard {userRole === 'admin' && '(Vista Administrador)'}
              {userRole === 'empleado' && '(Vista Empleado)'}
              {userRole === 'cliente' && '(Vista Cliente)'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {userRole === 'admin' && dashboardData && (
                <>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Usuarios</p>
                    <p className="text-3xl font-bold text-red-600">
                      {dashboardData.total_usuarios || 3}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Clientes</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {dashboardData.total_clientes || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Scoring Promedio</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {dashboardData.scoring?.scoring_total || 0}
                    </p>
                  </div>
                </>
              )}
              
              {userRole === 'empleado' && dashboardData && (
                <>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Mis Actividades</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {dashboardData.total_actividades || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Mi Scoring</p>
                    <p className="text-3xl font-bold text-green-600">
                      {dashboardData.scoring?.scoring_total || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Tareas Pendientes</p>
                    <p className="text-3xl font-bold text-orange-600">0</p>
                  </div>
                </>
              )}
              
              {userRole === 'cliente' && (
                <>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Mis Pólizas</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {polizas.length}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Mis Vehículos</p>
                    <p className="text-3xl font-bold text-green-600">
                      {vehiculos.length}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Tickets Abiertos</p>
                    <p className="text-3xl font-bold text-orange-600">0</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                ℹ️ Información de Sesión
              </h3>
              <p className="text-blue-800">
                Rol: <span className={`font-bold ${getRoleColor()}`}>{getRoleName()}</span>
              </p>
              <p className="text-sm text-blue-600 mt-2">
                {userRole === 'admin' && '✅ Acceso completo al sistema - Puede gestionar usuarios, ver CRM y reportes'}
                {userRole === 'empleado' && '✅ Acceso a gestión y CRM - Puede gestionar clientes y pólizas'}
                {userRole === 'cliente' && '✅ Acceso a tus datos y pólizas - Puedes ver tu información y crear tickets'}
              </p>
            </div>
          </div>
        )}

        {/* Resto de pestañas sin cambios... */}
        {activeTab === 'usuarios' && userRole === 'admin' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Usuarios</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">🚧 Módulo en desarrollo</p>
            </div>
          </div>
        )}

        {activeTab === 'crm' && (userRole === 'admin' || userRole === 'empleado') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">CRM - Gestión Comercial</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">🚧 Módulo en desarrollo</p>
            </div>
          </div>
        )}

        {activeTab === 'clientes' && (userRole === 'admin' || userRole === 'empleado') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Clientes</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">🚧 Módulo en desarrollo</p>
            </div>
          </div>
        )}

        {activeTab === 'datos' && userRole === 'cliente' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Mis Datos Personales</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-lg text-gray-800">{userEmail}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Rol</label>
                <p className={`text-lg font-semibold ${getRoleColor()}`}>{getRoleName()}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'polizas' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {userRole === 'cliente' ? 'Mis Pólizas' : 'Gestión de Pólizas'}
            </h2>
            {polizas.length === 0 ? (
              <p className="text-gray-500">
                {userRole === 'cliente' ? 'No tienes pólizas registradas' : 'No hay pólizas en el sistema'}
              </p>
            ) : (
              <div className="space-y-4">
                {polizas.map(poliza => (
                  <div key={poliza.id} className="border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold">{poliza.numero_poliza}</p>
                    <p className="text-sm text-gray-600">{poliza.tipo_seguro}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'vehiculos' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {userRole === 'cliente' ? 'Mis Vehículos' : 'Gestión de Vehículos'}
            </h2>
            {vehiculos.length === 0 ? (
              <p className="text-gray-500">
                {userRole === 'cliente' ? 'No tienes vehículos registrados' : 'No hay vehículos en el sistema'}
              </p>
            ) : (
              <div className="space-y-4">
                {vehiculos.map(vehiculo => (
                  <div key={vehiculo.id} className="border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold">{vehiculo.marca} {vehiculo.modelo}</p>
                    <p className="text-sm text-gray-600">Patente: {vehiculo.patente}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && userRole === 'cliente' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Soporte - Mis Tickets</h2>
            <div className="space-y-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
                ➕ Crear Nuevo Ticket
              </button>
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <p className="text-gray-500">No tienes tickets abiertos</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reportes' && userRole === 'admin' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Reportes y Analytics</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">🚧 Módulo en desarrollo</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
