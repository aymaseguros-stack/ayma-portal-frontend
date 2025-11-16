import axios from 'axios'

const API_URL = 'https://ayma-portal-backend.onrender.com'

const api = axios.create({
  baseURL: API_URL
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const dashboardService = {
  async getResumen() {
    const response = await api.get('/api/v1/dashboard/')
    return response.data
  },
  async getScoring() {
    const response = await api.get('/api/v1/dashboard/scoring')
    return response.data
  },
  async getActividades() {
    const response = await api.get('/api/v1/dashboard/actividades')
    return response.data
  }
}

export const polizasService = {
  async listar() {
    const response = await api.get('/api/v1/polizas/')
    return response.data
  },
  async obtener(id) {
    const response = await api.get('/api/v1/polizas/' + id)
    return response.data
  }
}

export const vehiculosService = {
  async listar() {
    const response = await api.get('/api/v1/vehiculos/')
    return response.data
  },
  async obtener(id) {
    const response = await api.get('/api/v1/vehiculos/' + id)
    return response.data
  }
}

export default api
