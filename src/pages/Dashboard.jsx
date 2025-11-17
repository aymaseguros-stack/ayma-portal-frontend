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
          <p style={styles.role}>{user?.tipo_usuario}</p>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>
          🚪 Salir
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
          👤 Mis Datos
        </button>
        <button
          onClick={() => setActiveTab('polizas')}
          style={{
            ...styles.tab,
            ...(activeTab === 'polizas' ? styles.tabActive : {})
          }}
        >
          📄 Mis Pólizas
        </button>
        <button
          onClick={() => setActiveTab('vehiculos')}
          style={{
            ...styles.tab,
            ...(activeTab === 'vehiculos' ? styles.tabActive : {})
          }}
        >
          🚗 Mis Vehículos
        </button>
        <button
          onClick={() => setActiveTab('soporte')}
          style={{
            ...styles.tab,
            ...(activeTab === 'soporte' ? styles.tabActive : {})
          }}
        >
          💬 Soporte
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
            {activeTab === 'dashboard' && <DashboardView data={data} user={user} />}
            {activeTab === 'personal' && <PersonalView user={user} />}
            {activeTab === 'polizas' && <PolizasView data={data} />}
            {activeTab === 'vehiculos' && <VehiculosView data={data} />}
            {activeTab === 'soporte' && <SoporteView user={user} />}
          </>
        )}
      </div>
    </div>
  )
}

// Vista Dashboard
function DashboardView({ data, user }) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>Dashboard (Vista {user?.tipo_usuario})</h2>
      
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📄</div>
          <div>
            <div style={styles.statLabel}>Mis Pólizas</div>
            <div style={styles.statValue}>{data?.total_polizas || 7}</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🚗</div>
          <div>
            <div style={styles.statLabel}>Mis Vehículos</div>
            <div style={styles.statValue}>{data?.total_vehiculos || 7}</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🎫</div>
          <div>
            <div style={styles.statLabel}>Tickets Abiertos</div>
            <div style={styles.statValue}>0</div>
          </div>
        </div>
      </div>

      <div style={styles.infoBox}>
        <h3 style={styles.infoTitle}>ℹ️ Información de Sesión</h3>
        <div style={styles.infoGrid}>
          <div><strong>Rol:</strong> {user?.tipo_usuario}</div>
          <div><strong>Permisos:</strong> ✅ Acceso a tus datos y pólizas - Puedes ver tu información y crear tickets</div>
        </div>
      </div>
    </div>
  )
}

// Vista Datos Personales
function PersonalView({ user }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Mis Datos Personales</h2>
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
          <span style={styles.badge}>✅ Activo</span>
        </div>
      </div>
    </div>
  )
}

// Vista Pólizas - TABLA HORIZONTAL
function PolizasView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>📄 No tienes pólizas registradas</p>
      </div>
    )
  }

  return (
    <div style={styles.tableContainer}>
      <h2 style={styles.sectionTitle}>Mis Pólizas</h2>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>📄</th>
              <th style={styles.th}>Póliza</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Titular</th>
              <th style={styles.th}>Compañía</th>
              <th style={styles.th}>Cobertura</th>
              <th style={styles.th}>Premio Total</th>
              <th style={styles.th}>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {data.map((poliza, index) => (
              <tr key={index} style={styles.tableRow}>
                <td style={styles.td}>📄</td>
                <td style={styles.td}>{poliza.numero_poliza || '-'}</td>
                <td style={styles.td}>
                  <span style={poliza.estado === 'vigente' ? styles.badgeGreen : styles.badgeGray}>
                    {poliza.estado || 'vigente'}
                  </span>
                </td>
                <td style={styles.td}>{poliza.titular || 'Titular'}</td>
                <td style={styles.td}>{poliza.compania || 'NACION SEGUROS'}</td>
                <td style={styles.td}>{poliza.tipo_cobertura || '-'}</td>
                <td style={styles.td}>
                  ${poliza.premio_total ? Number(poliza.premio_total).toLocaleString('es-AR', {minimumFractionDigits: 2}) : '0,00'}
                </td>
                <td style={styles.td}>{poliza.fecha_vencimiento || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Vista Vehículos - TABLA HORIZONTAL
function VehiculosView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>🚗 No tienes vehículos registrados</p>
      </div>
    )
  }

  return (
    <div style={styles.tableContainer}>
      <h2 style={styles.sectionTitle}>Mis Vehículos</h2>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>🚗</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Dominio/Patente</th>
              <th style={styles.th}>Año de Fabricación</th>
              <th style={styles.th}>Marca</th>
              <th style={styles.th}>Modelo</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Uso</th>
            </tr>
          </thead>
          <tbody>
            {data.map((vehiculo, index) => (
              <tr key={index} style={styles.tableRow}>
                <td style={styles.td}>🚗</td>
                <td style={styles.td}>
                  <span style={styles.badgeGreen}>
                    {vehiculo.estado || 'activo'}
                  </span>
                </td>
                <td style={styles.td}><strong>{vehiculo.dominio || '-'}</strong></td>
                <td style={styles.td}>{vehiculo.anio || '-'}</td>
                <td style={styles.td}>{vehiculo.marca || '-'}</td>
                <td style={styles.td}>{vehiculo.modelo || '-'}</td>
                <td style={styles.td}>{vehiculo.tipo_vehiculo || '-'}</td>
                <td style={styles.td}>{vehiculo.uso || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Vista Soporte
function SoporteView({ user }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>💬 Soporte</h2>
      <p style={styles.text}>Contacta con AYMA Advisors</p>
      <div style={styles.infoGrid}>
        <div style={styles.infoRow}>
          <strong>Email:</strong>
          <span>aymaseguros@hotmail.com</span>
        </div>
        <div style={styles.infoRow}>
          <strong>WhatsApp:</strong>
          <span>+54 9 341 XXX XXXX</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#1f2937',
    padding: '20px',
    color: '#fff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#374151',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  title: {
    fontSize: '32px',
    margin: 0,
    color: '#fff'
  },
  subtitle: {
    color: '#9ca3af',
    margin: '5px 0 0 0'
  },
  role: {
    color: '#60a5fa',
    margin: '5px 0 0 0',
    fontWeight: '600'
  },
  logoutBtn: {
    padding: '12px 24px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    background: '#374151',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#9ca3af',
    transition: 'all 0.3s'
  },
  tabActive: {
    background: '#4f46e5',
    borderColor: '#6366f1',
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
    color: '#9ca3af'
  },
  spinner: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#fff'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: '#374151',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  statIcon: {
    fontSize: '48px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#60a5fa'
  },
  card: {
    background: '#374151',
    borderRadius: '12px',
    padding: '24px'
  },
  infoBox: {
    background: '#374151',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '20px'
  },
  infoTitle: {
    fontSize: '18px',
    marginBottom: '15px',
    color: '#fff'
  },
  infoGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #4b5563'
  },
  text: {
    color: '#9ca3af',
    marginBottom: '20px'
  },
  badge: {
    padding: '4px 12px',
    background: '#22c55e',
    color: 'white',
    borderRadius: '12px',
    fontSize: '14px'
  },
  badgeGreen: {
    display: 'inline-block',
    padding: '6px 12px',
    background: '#22c55e',
    color: 'white',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600'
  },
  badgeGray: {
    display: 'inline-block',
    padding: '6px 12px',
    background: '#6b7280',
    color: 'white',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600'
  },
  tableContainer: {
    background: '#374151',
    borderRadius: '12px',
    padding: '24px'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#1f2937',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  tableHeader: {
    background: '#4f46e5'
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '14px',
    color: '#fff',
    borderBottom: '2px solid #6366f1'
  },
  tableRow: {
    borderBottom: '1px solid #374151',
    transition: 'background 0.2s'
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#e5e7eb'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    background: '#374151',
    borderRadius: '12px',
    color: '#9ca3af',
    fontSize: '18px'
  }
}

export default Dashboard
