import { useState, useEffect } from 'react'
import axios from 'axios'
import { dashboardService, polizasService, vehiculosService, adminService, pdfService } from "./services/api"
import AdminDashboard from "./components/Admin/AdminDashboard"
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
  
  const [dashboardData, setDashboardData] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [polizas, setPolizas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedEmail = localStorage.getItem('email')
    const savedRole = localStorage.getItem('role')
    if (token && savedEmail) {
      setIsLoggedIn(true)
      setUserEmail(savedEmail)
      setUserRole(savedRole || 'cliente')
      loadDashboardData(savedRole)
    }
  }, [])

  const loadDashboardData = async (role = userRole) => {
    setLoadingDashboard(true)
    try {
      const isAdmin = role === 'admin' || role === 'administrador'
      
      if (isAdmin) {
        // ADMIN: Cargar datos de todo el sistema
        const [adminDash, adminUsuarios, adminClientes, adminPolizas, adminVehiculos] = await Promise.all([
          adminService.getDashboard(),
          adminService.listarUsuarios(),
          adminService.listarClientes(),
          adminService.listarPolizas(),
          adminService.listarVehiculos()
        ])
        
        setDashboardData(adminDash)
        setUsuarios(adminUsuarios)
        setClientes(adminClientes)
        setPolizas(adminPolizas)
        setVehiculos(adminVehiculos)
      } else {
        // CLIENTE/EMPLEADO: Cargar solo sus datos
        const [resumen, scoring] = await Promise.all([
          dashboardService.getResumen(),
          dashboardService.getScoring()
        ])
        setDashboardData({ ...resumen, scoring })
        
        const [polizasData, vehiculosData] = await Promise.all([
          polizasService.listar(),
          vehiculosService.listar()
        ])
        setPolizas(polizasData)
        setVehiculos(vehiculosData)
      }
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
      localStorage.setItem('role', tipo_usuario.toLowerCase())
      
      setIsLoggedIn(true)
      setUserEmail(userEmail)
      setUserRole(tipo_usuario.toLowerCase())
      setError('')
      
      await loadDashboardData(tipo_usuario.toLowerCase())
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
    setUsuarios([])
    setClientes([])
  }

  const getRoleName = () => {
    const roles = {
      'admin': 'Administrador',
      'administrador': 'Administrador',
      'empleado': 'Empleado',
      'cliente': 'Cliente'
    }
    return roles[userRole] || 'Usuario'
  }

  const getRoleColor = () => {
    const colors = {
      'admin': 'text-red-600',
      'administrador': 'text-red-600',
      'empleado': 'text-blue-600',
      'cliente': 'text-green-600'
    }
    return colors[userRole] || 'text-gray-600'
  }

  const calculateDaysToExpiry = (fechaVencimiento) => {
    if (!fechaVencimiento) return '-'
    const today = new Date()
    const expiry = new Date(fechaVencimiento)
    const diffTime = expiry - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleDownloadPDF = async (polizaId) => {
    try {
      const result = await pdfService.getPolizaPDF(polizaId)
      if (result.pdf && result.pdf.download_url) {
        window.open(result.pdf.download_url, "_blank")
      } else {
        alert("PDF no disponible para esta póliza")
      }
    } catch (error) {
      console.error("Error descargando PDF:", error)
      alert("Error al obtener el PDF")
    }
  }

  const handleDownloadPDFByVehiculo = async (vehiculoId) => {
    try {
      // Encontrar el vehículo por ID
      const vehiculo = vehiculos.find(v => v.id === vehiculoId)
      
      if (!vehiculo) {
        alert("Vehículo no encontrado")
        return
      }
      
      // Buscar póliza por dominio del vehículo
      const polizaAsociada = polizas.find(p => p.vehiculo?.dominio === vehiculo.dominio)
      
      if (!polizaAsociada) {
        alert("Este vehículo no tiene una póliza asociada")
        return
      }
      
      await handleDownloadPDF(polizaAsociada.id)
    } catch (error) {
      console.error("Error descargando PDF:", error)
      alert("Error al obtener el PDF")
    }
  }
  const getTabs = () => {
    const baseTabs = [
      { id: 'dashboard', label: '📊 Dashboard', roles: ['admin', 'administrador', 'empleado', 'cliente'] }
    ]

    if (userRole === 'admin' || userRole === 'administrador') {
      return [
        ...baseTabs,
        { id: 'usuarios', label: '👥 Usuarios', roles: ['admin'] },
        { id: 'administracion', label: '⚙️ Administración', roles: ['admin'] },
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
              Dashboard {userRole === 'admin' || userRole === 'administrador' ? '(Vista Administrador)' : ''}
              {userRole === 'empleado' && '(Vista Empleado)'}
              {userRole === 'cliente' && '(Vista Cliente)'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(userRole === 'admin' || userRole === 'administrador') && dashboardData && (
                <>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Usuarios</p>
                    <p className="text-3xl font-bold text-red-600">
                      {dashboardData.total_usuarios || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Clientes</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {dashboardData.total_clientes || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Pólizas</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {dashboardData.total_polizas || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Total Vehículos</p>
                    <p className="text-3xl font-bold text-green-600">
                      {dashboardData.total_vehiculos || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Pólizas Vigentes</p>
                    <p className="text-3xl font-bold text-green-600">
                      {dashboardData.polizas_vigentes || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <p className="text-gray-600 text-sm">Pólizas Vencidas</p>
                    <p className="text-3xl font-bold text-red-600">
                      {dashboardData.polizas_vencidas || 0}
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
                {(userRole === 'admin' || userRole === 'administrador') && '✅ Acceso completo al sistema - Visualizando datos de TODOS los usuarios'}
                {userRole === 'empleado' && '✅ Acceso a gestión y CRM - Puede gestionar clientes y pólizas'}
                {userRole === 'cliente' && '✅ Acceso a tus datos y pólizas - Puedes ver tu información y crear tickets'}
              </p>
            </div>
          </div>
        )}

        {/* USUARIOS - TABLA CON DATOS REALES */}

        {/* ADMINISTRACIÓN - PANEL COMPLETO */}
        {activeTab === 'administracion' && (userRole === 'admin' || userRole === 'administrador') && (
          <AdminDashboard />
        )}

        {activeTab === 'usuarios' && (userRole === 'admin' || userRole === 'administrador') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Usuarios ({usuarios.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">👤</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Rol</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fecha Registro</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Última Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr className="border-b border-gray-200">
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        👥 No hay usuarios registrados
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => (
                      <tr key={usuario.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">👤</td>
                        <td className="px-4 py-3 font-semibold text-blue-600">{usuario.email}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${
                            usuario.tipo_usuario === 'admin' || usuario.tipo_usuario === 'administrador' ? 'text-red-600' :
                            usuario.tipo_usuario === 'empleado' ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {usuario.tipo_usuario}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            usuario.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {usuario.activo ? '✅ Activo' : '❌ Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('es-AR') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {usuario.updated_at ? new Date(usuario.updated_at).toLocaleDateString('es-AR') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CRM - TABLA HORIZONTAL */}
        {activeTab === 'crm' && (userRole === 'admin' || userRole === 'administrador' || userRole === 'empleado') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">CRM - Gestión Comercial</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">📊</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Última Actividad</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scoring</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Próxima Acción</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      📈 Módulo en desarrollo - Sistema de seguimiento comercial próximamente
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTES - TABLA CON DATOS REALES */}
        {activeTab === 'clientes' && (userRole === 'admin' || userRole === 'administrador' || userRole === 'empleado') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Clientes ({clientes.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">👤</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Nombre Completo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Documento</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Teléfono</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scoring</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.length === 0 ? (
                    <tr className="border-b border-gray-200">
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        👥 No hay clientes registrados
                      </td>
                    </tr>
                  ) : (
                    clientes.map((cliente) => (
                      <tr key={cliente.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">👤</td>
                        <td className="px-4 py-3 font-semibold">{cliente.nombre} {cliente.apellido}</td>
                        <td className="px-4 py-3 text-blue-600">{cliente.email}</td>
                        <td className="px-4 py-3">
                          {cliente.tipo_documento} {cliente.numero_documento}
                        </td>
                        <td className="px-4 py-3">{cliente.telefono || '-'}</td>
                        <td className="px-4 py-3 font-bold text-purple-600">{cliente.scoring_comercial}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            cliente.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {cliente.activo ? '✅ Activo' : '❌ Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MIS DATOS - TABLA HORIZONTAL */}
        {activeTab === 'datos' && userRole === 'cliente' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Mis Datos Personales</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Rol</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Pólizas Activas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{userEmail}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${getRoleColor()}`}>{getRoleName()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Activo
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-600 text-lg">{polizas.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PÓLIZAS - TABLA HORIZONTAL */}
        {activeTab === 'polizas' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {userRole === 'cliente' ? 'Mis Pólizas' : `Gestión de Pólizas (${polizas.length})`}
            </h2>
            {polizas.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {userRole === 'cliente' ? '📄 No tienes pólizas registradas' : '📄 No hay pólizas en el sistema'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-4 py-3 text-left text-sm font-semibold">📄</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Póliza</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Titular</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Compañía</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Cobertura</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Premio Total</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Vencimiento</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Días Restantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polizas.map((poliza, index) => {
                      const diasRestantes = calculateDaysToExpiry(poliza.fecha_vencimiento)
                      const nombreTitular = poliza.titular_nombre 
                        ? `${poliza.titular_nombre} ${poliza.titular_apellido || ''}`.trim()
                        : (poliza.cliente_nombre ? `${poliza.cliente_nombre} ${poliza.cliente_apellido || ''}`.trim() : 'Titular')
                      
                      return (
                        <tr key={poliza.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">📄</td>
                          <td className="px-4 py-3 font-semibold text-blue-600">{poliza.numero_poliza}</td>
                          <td className="px-4 py-3">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold uppercase">
                              {poliza.estado || 'vigente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{nombreTitular}</td>
                          <td className="px-4 py-3">{poliza.compania || 'N/A'}</td>
                          <td className="px-4 py-3">{poliza.tipo_cobertura || '-'}</td>
                          <td className="px-4 py-3 font-bold text-green-600">
                            ${poliza.premio_total ? Number(poliza.premio_total).toLocaleString('es-AR', {minimumFractionDigits: 2}) : '0,00'}
                          </td>
                          <td className="px-4 py-3">
                            {poliza.fecha_vencimiento ? new Date(poliza.fecha_vencimiento).toLocaleDateString('es-AR') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${diasRestantes < 30 ? 'text-red-600' : diasRestantes < 60 ? 'text-orange-600' : 'text-green-600'}`}>
                              {diasRestantes !== '-' ? `${diasRestantes} días` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => handleDownloadPDF(poliza.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold"
                            >
                              📥 PDF
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VEHÍCULOS - TABLA HORIZONTAL */}
        {activeTab === 'vehiculos' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {userRole === 'cliente' ? 'Mis Vehículos' : `Gestión de Vehículos (${vehiculos.length})`}
            </h2>
            {vehiculos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {userRole === 'cliente' ? '🚗 No tienes vehículos registrados' : '🚗 No hay vehículos en el sistema'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-4 py-3 text-left text-sm font-semibold">🚗</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Dominio/Patente</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Año</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Marca</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Modelo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Uso</th>
                      {(userRole === 'admin' || userRole === 'administrador') && (
                        <th className="px-4 py-3 text-left text-sm font-semibold">Propietario</th>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-semibold">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiculos.map((vehiculo, index) => (
                      <tr key={vehiculo.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">🚗</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                            {vehiculo.estado || 'activo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-600 text-lg">{vehiculo.dominio || '-'}</td>
                        <td className="px-4 py-3 font-semibold">{vehiculo.anio || '-'}</td>
                        <td className="px-4 py-3">{vehiculo.marca || '-'}</td>
                        <td className="px-4 py-3">{vehiculo.modelo || '-'}</td>
                        <td className="px-4 py-3">{vehiculo.tipo_vehiculo || '-'}</td>
                        <td className="px-4 py-3">{vehiculo.uso || '-'}</td>
                        {(userRole === 'admin' || userRole === 'administrador') && (
                          <td className="px-4 py-3 font-medium">
                            {vehiculo.cliente_nombre && `${vehiculo.cliente_nombre} ${vehiculo.cliente_apellido || ''}`.trim()}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => handleDownloadPDFByVehiculo(vehiculo.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold"
                          >
                            📥 PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SOPORTE/TICKETS - TABLA HORIZONTAL */}
        {activeTab === 'tickets' && userRole === 'cliente' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Soporte - Mis Tickets</h2>
            <div className="mb-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
                ➕ Crear Nuevo Ticket
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold">🎫</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ticket #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Asunto</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Prioridad</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fecha Creación</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Última Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      🎫 No tienes tickets abiertos - Crea uno si necesitas asistencia
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTES */}
        {activeTab === 'reportes' && (userRole === 'admin' || userRole === 'administrador') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Reportes y Analytics</h2>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800">📊 Módulo en desarrollo - Dashboards y reportes avanzados próximamente</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
