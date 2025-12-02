import { render } from '@testing-library/react'
import { vi } from 'vitest'

// Custom render function with common providers
export function renderWithProviders(ui, options = {}) {
  return render(ui, { ...options })
}

// Mock localStorage helpers
export const mockLocalStorage = {
  setAuthData: (token = 'test-token', email = 'test@example.com', role = 'cliente') => {
    localStorage.setItem('token', token)
    localStorage.setItem('email', email)
    localStorage.setItem('role', role)
  },
  clear: () => {
    localStorage.clear()
  }
}

// Wait for async updates
export const waitForLoadingToFinish = async () => {
  const { waitFor } = await import('@testing-library/react')
  await waitFor(() => {
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  }, { timeout: 3000 })
}

// Common test data
export const mockUsers = {
  admin: {
    email: 'admin@ayma.com',
    password: 'admin123',
    tipo_usuario: 'admin',
    access_token: 'admin-token-123'
  },
  empleado: {
    email: 'empleado@ayma.com',
    password: 'emp123',
    tipo_usuario: 'empleado',
    access_token: 'empleado-token-456'
  },
  cliente: {
    email: 'cliente@ayma.com',
    password: 'cliente123',
    tipo_usuario: 'cliente',
    access_token: 'cliente-token-789'
  }
}

export const mockDashboardData = {
  total_usuarios: 10,
  total_clientes: 50,
  total_actividades: 25
}

export const mockScoringData = {
  scoring_total: 85
}

export const mockPolizas = [
  {
    id: 1,
    numero_poliza: 'POL-001',
    titular_nombre: 'Juan',
    titular_apellido: 'Pérez',
    compania: 'Seguros AYMA',
    tipo_cobertura: 'Todo Riesgo',
    premio_total: 50000,
    fecha_vencimiento: '2025-12-31',
    dias_para_vencimiento: 45,
    estado: 'vigente',
    vehiculo_descripcion: 'Ford Focus 2020',
    vehiculo_dominio: 'ABC123'
  },
  {
    id: 2,
    numero_poliza: 'POL-002',
    titular_nombre: 'María',
    titular_apellido: 'González',
    compania: 'La Caja',
    tipo_cobertura: 'Terceros Completo',
    premio_total: 30000,
    fecha_vencimiento: '2025-11-15',
    dias_para_vencimiento: 15,
    estado: 'vigente',
    vehiculo_descripcion: 'Toyota Corolla 2019',
    vehiculo_dominio: 'XYZ789'
  }
]

export const mockVehiculos = [
  {
    id: 1,
    descripcion_completa: 'Ford Focus 2020',
    dominio: 'ABC123',
    anio: 2020,
    estado: 'activo',
    tiene_poliza_vigente: true
  },
  {
    id: 2,
    descripcion_completa: 'Toyota Corolla 2019',
    dominio: 'XYZ789',
    anio: 2019,
    estado: 'activo',
    tiene_poliza_vigente: true
  }
]

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
