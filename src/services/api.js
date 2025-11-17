import axios from 'axios'

const API_URL = 'https://ayma-portal-backend.onrender.com/api/v1'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
}

export const dashboardService = {
  getResumen: async () => {
    const response = await axios.get(`${API_URL}/dashboard/`, getAuthHeaders())
    return response.data
  },
  getScoring: async () => {
    const response = await axios.get(`${API_URL}/dashboard/scoring`, getAuthHeaders())
    return response.data
  },
  getActividades: async () => {
    const response = await axios.get(`${API_URL}/dashboard/actividades`, getAuthHeaders())
    return response.data
  }
}

export const polizasService = {
  listar: async () => {
    const response = await axios.get(`${API_URL}/polizas/`, getAuthHeaders())
    return response.data
  },
  obtener: async (id) => {
    const response = await axios.get(`${API_URL}/polizas/${id}`, getAuthHeaders())
    return response.data
  },
  descargarPDF: async (id) => {
    const response = await axios.get(`${API_URL}/polizas/${id}/pdf`, {
      ...getAuthHeaders(),
      responseType: 'blob'
    })
    return response.data
  }
}

export const vehiculosService = {
  listar: async () => {
    const response = await axios.get(`${API_URL}/vehiculos/`, getAuthHeaders())
    return response.data
  },
  obtener: async (id) => {
    const response = await axios.get(`${API_URL}/vehiculos/${id}`, getAuthHeaders())
    return response.data
  }
}

export const adminService = {
  listarUsuarios: async () => {
    const response = await axios.get(`${API_URL}/admin/usuarios`, getAuthHeaders())
    return response.data
  },
  listarClientes: async () => {
    const response = await axios.get(`${API_URL}/admin/clientes`, getAuthHeaders())
    return response.data
  },
  listarPolizas: async () => {
    const response = await axios.get(`${API_URL}/admin/polizas`, getAuthHeaders())
    return response.data
  },
  listarVehiculos: async () => {
    const response = await axios.get(`${API_URL}/admin/vehiculos`, getAuthHeaders())
    return response.data
  },
  getDashboard: async () => {
    const response = await axios.get(`${API_URL}/admin/dashboard`, getAuthHeaders())
    return response.data
  }
}

// PDF
export const pdfService = {
  getPolizaPDF: async (polizaId) => {
    const response = await axios.get(`${API_URL}/pdf/poliza/${polizaId}`, getAuthHeaders())
    return response.data
  }
}
