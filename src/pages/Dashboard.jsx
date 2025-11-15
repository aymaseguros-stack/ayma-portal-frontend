import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'https://ayma-portal-backend.onrender.com'

function Dashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      let response
      switch(activeTab) {
        case 'dashboard':
          response = await axios.get(`${API_URL}/api/v1/dashboard/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          break
        case 'polizas':
          response = await axios.get(`${API_URL}/api/v1/polizas/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          break
        case 'vehiculos':
          response = await axios.get(`${API_URL}/api/v1/vehiculos/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          break
      }
      setData(response.data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Portal AYMA</h1>
          <p style={styles.subtitle}>{user?.email}</p>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>
          Cerrar Sesión
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            ...styles.tab,
            ...(activeTab === 'dashboard' ? styles.tabActive : {})
          }}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          style={{
            ...styles.tab,
            ...(activeTab === 'personal' ? styles.tabActive : {})
          }}
        >
          👤 Datos Personales
        </button>
        <button
          onClick={() => setActiveTab('polizas')}
          style={{
            ...styles.tab,
            ...(activeTab === 'polizas' ? styles.tabActive : {})
          }}
        >
          📄 Pólizas
        </button>
        <button
          onClick={() => setActiveTab('vehiculos')}
          style={{
            ...styles.tab,
            ...(activeTab === 'vehiculos' ? styles.tabActive : {})
          }}
        >
          🚗 Vehículos
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner}>⏳</div>
            <p>Cargando...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardView data={data} />}
            {activeTab === 'personal' && <PersonalView user={user} />}
            {activeTab === 'polizas' && <PolizasView data={data} />}
            {activeTab === 'vehiculos' && <VehiculosView data={data} />}
          </>
        )}
      </div>
    </div>
  )
}

// Vista Dashboard
function DashboardView({ data }) {
  return (
    <div style={styles.grid}>
      <div style={styles.card}>
        <div style={styles.cardIcon}>📄</div>
        <div>
          <h3>Pólizas Activas</h3>
          <p style={styles.bigNumber}>{data?.total_polizas || 0}</p>
        </div>
      </div>
      <div style={styles.card}>
        <div style={styles.cardIcon}>🚗</div>
        <div>
          <h3>Vehículos</h3>
          <p style={styles.bigNumber}>{data?.total_vehiculos || 0}</p>
        </div>
      </div>
      <div style={styles.card}>
        <div style={styles.cardIcon}>⭐</div>
        <div>
          <h3>Tu Scoring</h3>
          <p style={styles.bigNumber}>{data?.scoring || 0}</p>
        </div>
      </div>
      <div style={styles.card}>
        <div style={styles.cardIcon}>📅</div>
        <div>
          <h3>Próximo Vencimiento</h3>
          <p style={styles.smallText}>
            {data?.proximo_vencimiento || 'Sin vencimientos'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Vista Datos Personales
function PersonalView({ user }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Datos Personales</h2>
      <div style={styles.infoGrid}>
        <div style={styles.infoRow}>
          <strong>Email:</strong>
          <span>{user?.email || 'No disponible'}</span>
        </div>
        <div style={styles.infoRow}>
          <strong>Tipo de Usuario:</strong>
          <span>{user?.tipo_usuario || 'Cliente'}</span>
        </div>
        <div style={styles.infoRow}>
          <strong>Estado:</strong>
          <span style={styles.badge}>Activo</span>
        </div>
      </div>
    </div>
  )
}

// Vista Pólizas
function PolizasView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>📄 No tienes pólizas registradas</p>
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {data.map((poliza, index) => (
        <div key={index} style={styles.listItem}>
          <div style={styles.listIcon}>📄</div>
          <div style={styles.listContent}>
            <h3>{poliza.numero_poliza || `Póliza ${index + 1}`}</h3>
            <p>{poliza.tipo || 'Tipo no especificado'}</p>
            <p style={styles.smallText}>
              Vencimiento: {poliza.fecha_vencimiento || 'N/A'}
            </p>
          </div>
          <div style={styles.listBadge}>
            {poliza.estado || 'Activa'}
          </div>
        </div>
      ))}
    </div>
  )
}

// Vista Vehículos
function VehiculosView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>🚗 No tienes vehículos registrados</p>
      </div>
    )
  }

  return (
    <div style={styles.list}>
      {data.map((vehiculo, index) => (
        <div key={index} style={styles.listItem}>
          <div style={styles.listIcon}>🚗</div>
          <div style={styles.listContent}>
            <h3>{vehiculo.marca} {vehiculo.modelo}</h3>
            <p>Patente: {vehiculo.patente || 'N/A'}</p>
            <p style={styles.smallText}>
              Año: {vehiculo.anio || 'N/A'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  title: {
    fontSize: '28px',
    color: '#1f2937',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    margin: '5px 0 0 0'
  },
  logoutBtn: {
    padding: '12px 24px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    background: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#6b7280',
    transition: 'all 0.3s'
  },
  tabActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontWeight: '600'
  },
  content: {
    minHeight: '400px'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  spinner: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  cardIcon: {
    fontSize: '40px'
  },
  cardTitle: {
    fontSize: '20px',
    marginBottom: '20px',
    color: '#1f2937'
  },
  bigNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#667eea',
    margin: '10px 0 0 0'
  },
  smallText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '5px 0 0 0'
  },
  infoGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  badge: {
    padding: '4px 12px',
    background: '#22c55e',
    color: 'white',
    borderRadius: '12px',
    fontSize: '14px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  listItem: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  listIcon: {
    fontSize: '32px'
  },
  listContent: {
    flex: 1
  },
  listBadge: {
    padding: '8px 16px',
    background: '#22c55e',
    color: 'white',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    background: 'white',
    borderRadius: '12px',
    color: '#6b7280',
    fontSize: '18px'
  }
}

export default Dashboard
