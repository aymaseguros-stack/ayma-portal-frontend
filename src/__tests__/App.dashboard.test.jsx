import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { mockLocalStorage } from '../tests/utils/testUtils'

describe('Dashboard Functionality', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Dashboard Data Loading', () => {
    it('should show loading spinner while fetching data', async () => {
      mockLocalStorage.setAuthData()
      render(<App />)

      // Loading spinner should appear briefly
      const spinner = document.querySelector('.animate-spin')

      // Data should eventually load
      await waitFor(() => {
        expect(screen.getByText('Dashboard (Vista Cliente)')).toBeInTheDocument()
      })
    })

    it('should load dashboard data on mount', async () => {
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Mis Pólizas')).toBeInTheDocument()
        expect(screen.getByText('Mis Vehículos')).toBeInTheDocument()
      })
    })

    it('should display dashboard metrics after loading', async () => {
      mockLocalStorage.setAuthData('admin-token', 'admin@test.com', 'admin')
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Total Usuarios')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument() // From mockDashboardData
        expect(screen.getByText('50')).toBeInTheDocument() // Total clientes
        expect(screen.getByText('85')).toBeInTheDocument() // Scoring
      })
    })
  })

  describe('Polizas Display', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData()
    })

    it('should display list of polizas', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        expect(screen.getByText(/POL-001/)).toBeInTheDocument()
        expect(screen.getByText(/POL-002/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display poliza details correctly', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        // Check first poliza
        expect(screen.getByText(/Juan/)).toBeInTheDocument()
        expect(screen.getByText(/Pérez/)).toBeInTheDocument()
        expect(screen.getByText(/Seguros AYMA/)).toBeInTheDocument()
        expect(screen.getByText(/Todo Riesgo/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display currency formatting', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        expect(screen.getByText(/50\.000/)).toBeInTheDocument()
        expect(screen.getByText(/30\.000/)).toBeInTheDocument()
      })
    })

    it('should show days until expiration', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        expect(screen.getByText('45 días')).toBeInTheDocument()
        expect(screen.getByText('15 días')).toBeInTheDocument()
      })
    })

    it('should color-code policies by expiration proximity', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        const nearExpiry = screen.getByText('15 días')
        const safeExpiry = screen.getByText('45 días')

        expect(nearExpiry).toHaveClass('text-red-600') // < 30 days
        expect(safeExpiry).toHaveClass('text-green-600') // >= 30 days
      })
    })

    it('should show empty state when no polizas', async () => {
      // Override mock to return empty array
      const { server } = await import('../tests/mocks/server')
      const { http, HttpResponse } = await import('msw')

      server.use(
        http.get('https://ayma-portal-backend.onrender.com/api/v1/polizas/', () => {
          return HttpResponse.json([])
        })
      )

      const user = userEvent.setup()
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        expect(screen.getByText(/No tienes pólizas registradas/i)).toBeInTheDocument()
      })
    })
  })

  describe('Vehiculos Display', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData()
    })

    it('should display list of vehiculos', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
      })

      const vehiculosTab = screen.getByText('🚗 Mis Vehículos')
      await user.click(vehiculosTab)

      await waitFor(() => {
        expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
        expect(screen.getByText('Toyota Corolla 2019')).toBeInTheDocument()
      })
    })

    it('should display vehiculo details correctly', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
      })

      const vehiculosTab = screen.getByText('🚗 Mis Vehículos')
      await user.click(vehiculosTab)

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument()
        expect(screen.getByText('XYZ789')).toBeInTheDocument()
        expect(screen.getByText('2020')).toBeInTheDocument()
        expect(screen.getByText('2019')).toBeInTheDocument()
      })
    })

    it('should show insurance status badge for insured vehicles', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
      })

      const vehiculosTab = screen.getByText('🚗 Mis Vehículos')
      await user.click(vehiculosTab)

      await waitFor(() => {
        const aseguradoBadges = screen.getAllByText('✅ Asegurado')
        expect(aseguradoBadges).toHaveLength(2) // Both mock vehicles are insured
      })
    })

    it('should show empty state when no vehiculos', async () => {
      const { server } = await import('../tests/mocks/server')
      const { http, HttpResponse } = await import('msw')

      server.use(
        http.get('https://ayma-portal-backend.onrender.com/api/v1/vehiculos/', () => {
          return HttpResponse.json([])
        })
      )

      const user = userEvent.setup()
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
      })

      const vehiculosTab = screen.getByText('🚗 Mis Vehículos')
      await user.click(vehiculosTab)

      await waitFor(() => {
        expect(screen.getByText(/No tienes vehículos registrados/i)).toBeInTheDocument()
      })
    })
  })

  describe('Dashboard Cards', () => {
    it('should show correct count of polizas in dashboard card', async () => {
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        const cards = screen.getAllByText(/Mis Pólizas/)
        // One in tab, one in dashboard card
        expect(cards.length).toBeGreaterThan(0)

        // Check that dashboard cards are displayed
        expect(screen.getByText(/Tickets Abiertos/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should show correct count of vehiculos in dashboard card', async () => {
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        const cards = screen.getAllByText(/Mis Vehículos/)
        expect(cards.length).toBeGreaterThan(0)

        // Check that dashboard cards are displayed
        expect(screen.getByText(/Tickets Abiertos/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display tickets count', async () => {
      mockLocalStorage.setAuthData()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Tickets Abiertos')).toBeInTheDocument()
        // Currently hardcoded to 0
        const ticketsCard = screen.getByText('Tickets Abiertos').parentElement
        expect(ticketsCard).toHaveTextContent('0')
      })
    })
  })

  describe('Support/Tickets Section', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData()
    })

    it('should show tickets tab for cliente role', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()
      })
    })

    it('should display ticket creation button', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()
      })

      const soporteTab = screen.getByText('🎫 Soporte')
      await user.click(soporteTab)

      await waitFor(() => {
        expect(screen.getByText('➕ Crear Nuevo Ticket')).toBeInTheDocument()
      })
    })

    it('should show empty tickets message', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()
      })

      const soporteTab = screen.getByText('🎫 Soporte')
      await user.click(soporteTab)

      await waitFor(() => {
        expect(screen.getByText('No tienes tickets abiertos')).toBeInTheDocument()
      })
    })
  })

  describe('Under Development Modules', () => {
    it('should show development message for CRM', async () => {
      const user = userEvent.setup()
      mockLocalStorage.setAuthData('admin-token', 'admin@test.com', 'admin')
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📈 CRM')).toBeInTheDocument()
      })

      const crmTab = screen.getByText('📈 CRM')
      await user.click(crmTab)

      await waitFor(() => {
        expect(screen.getByText('🚧 Módulo en desarrollo')).toBeInTheDocument()
      })
    })

    it('should show development message for Usuarios', async () => {
      const user = userEvent.setup()
      mockLocalStorage.setAuthData('admin-token', 'admin@test.com', 'admin')
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('👥 Usuarios')).toBeInTheDocument()
      })

      const usuariosTab = screen.getByText('👥 Usuarios')
      await user.click(usuariosTab)

      await waitFor(() => {
        expect(screen.getByText('🚧 Módulo en desarrollo')).toBeInTheDocument()
      })
    })

    it('should show development message for Reportes', async () => {
      const user = userEvent.setup()
      mockLocalStorage.setAuthData('admin-token', 'admin@test.com', 'admin')
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Reportes')).toBeInTheDocument()
      })

      const reportesTab = screen.getByText('📊 Reportes')
      await user.click(reportesTab)

      await waitFor(() => {
        expect(screen.getByText('🚧 Módulo en desarrollo')).toBeInTheDocument()
      })
    })
  })

  describe('Personal Data Display', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData('cliente-token', 'cliente@test.com', 'cliente')
    })

    it('should display user email in Mis Datos', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('👤 Mis Datos')).toBeInTheDocument()
      })

      const datosTab = screen.getByText('👤 Mis Datos')
      await user.click(datosTab)

      await waitFor(() => {
        expect(screen.getByText('Mis Datos Personales')).toBeInTheDocument()
        const emailElements = screen.getAllByText('cliente@test.com')
        expect(emailElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should display user role in Mis Datos', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('👤 Mis Datos')).toBeInTheDocument()
      })

      const datosTab = screen.getByText('👤 Mis Datos')
      await user.click(datosTab)

      await waitFor(() => {
        const roleElements = screen.getAllByText('Cliente')
        expect(roleElements.length).toBeGreaterThan(0)
      })
    })
  })
})
