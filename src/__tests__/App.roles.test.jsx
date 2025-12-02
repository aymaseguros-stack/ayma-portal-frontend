import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { mockLocalStorage } from '../tests/utils/testUtils'

describe('Role-Based Access Control', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Admin Role', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData('admin-token', 'admin@ayma.com', 'admin')
    })

    it('should display admin role badge', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Administrador')).toBeInTheDocument()
      })
    })

    it('should show all admin tabs', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
        expect(screen.getByText('👥 Usuarios')).toBeInTheDocument()
        expect(screen.getByText('📈 CRM')).toBeInTheDocument()
        expect(screen.getByText('👤 Clientes')).toBeInTheDocument()
        expect(screen.getByText('📄 Pólizas')).toBeInTheDocument()
        expect(screen.getByText('🚗 Vehículos')).toBeInTheDocument()
        expect(screen.getByText('📊 Reportes')).toBeInTheDocument()
      })
    })

    it('should display admin dashboard view', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard (Vista Administrador)')).toBeInTheDocument()
      })
    })

    it('should show admin metrics', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Total Usuarios')).toBeInTheDocument()
        expect(screen.getByText('Total Clientes')).toBeInTheDocument()
        expect(screen.getByText('Scoring Promedio')).toBeInTheDocument()
      })
    })

    it('should be able to access Usuarios tab', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('👥 Usuarios')).toBeInTheDocument()
      })

      const usuariosTab = screen.getByText('👥 Usuarios')
      await user.click(usuariosTab)

      await waitFor(() => {
        expect(screen.getByText('Gestión de Usuarios')).toBeInTheDocument()
      })
    })

    it('should be able to access Reportes tab', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Reportes')).toBeInTheDocument()
      })

      const reportesTab = screen.getByText('📊 Reportes')
      await user.click(reportesTab)

      await waitFor(() => {
        expect(screen.getByText('Reportes y Analytics')).toBeInTheDocument()
      })
    })

    it('should show complete system access message', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText(/Acceso completo al sistema/i)).toBeInTheDocument()
      })
    })
  })

  describe('Empleado Role', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData('empleado-token', 'empleado@ayma.com', 'empleado')
    })

    it('should display empleado role badge', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Empleado')).toBeInTheDocument()
      })
    })

    it('should show empleado tabs', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
        expect(screen.getByText('📈 CRM')).toBeInTheDocument()
        expect(screen.getByText('👤 Clientes')).toBeInTheDocument()
        expect(screen.getByText('📄 Pólizas')).toBeInTheDocument()
        expect(screen.getByText('🚗 Vehículos')).toBeInTheDocument()
      })
    })

    it('should NOT show admin-only tabs', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
      })

      expect(screen.queryByText('👥 Usuarios')).not.toBeInTheDocument()
      expect(screen.queryByText('📊 Reportes')).not.toBeInTheDocument()
    })

    it('should display empleado dashboard view', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard (Vista Empleado)')).toBeInTheDocument()
      })
    })

    it('should show empleado metrics', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Mis Actividades')).toBeInTheDocument()
        expect(screen.getByText('Mi Scoring')).toBeInTheDocument()
        expect(screen.getByText('Tareas Pendientes')).toBeInTheDocument()
      })
    })

    it('should be able to access CRM', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📈 CRM')).toBeInTheDocument()
      })

      const crmTab = screen.getByText('📈 CRM')
      await user.click(crmTab)

      await waitFor(() => {
        expect(screen.getByText('CRM - Gestión Comercial')).toBeInTheDocument()
      })
    })

    it('should show management access message', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText(/Acceso a gestión y CRM/i)).toBeInTheDocument()
      })
    })
  })

  describe('Cliente Role', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData('cliente-token', 'cliente@ayma.com', 'cliente')
    })

    it('should display cliente role badge', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Cliente')).toBeInTheDocument()
      })
    })

    it('should show cliente tabs', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
        expect(screen.getByText('👤 Mis Datos')).toBeInTheDocument()
        expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
        expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
        expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()
      })
    })

    it('should NOT show admin or empleado tabs', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
      })

      expect(screen.queryByText('👥 Usuarios')).not.toBeInTheDocument()
      expect(screen.queryByText('📈 CRM')).not.toBeInTheDocument()
      expect(screen.queryByText('👤 Clientes')).not.toBeInTheDocument()
      expect(screen.queryByText('📊 Reportes')).not.toBeInTheDocument()
    })

    it('should display cliente dashboard view', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard (Vista Cliente)')).toBeInTheDocument()
      })
    })

    it('should show cliente metrics', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Mis Pólizas')).toBeInTheDocument()
        expect(screen.getByText('Mis Vehículos')).toBeInTheDocument()
        expect(screen.getByText('Tickets Abiertos')).toBeInTheDocument()
      })
    })

    it('should be able to access Mis Datos tab', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('👤 Mis Datos')).toBeInTheDocument()
      })

      const datosTab = screen.getByText('👤 Mis Datos')
      await user.click(datosTab)

      await waitFor(() => {
        expect(screen.getByText('Mis Datos Personales')).toBeInTheDocument()
      })
    })

    it('should be able to access Soporte tab', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()
      })

      const soporteTab = screen.getByText('🎫 Soporte')
      await user.click(soporteTab)

      await waitFor(() => {
        expect(screen.getByText('Soporte - Mis Tickets')).toBeInTheDocument()
      })
    })

    it('should show client access message', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText(/Acceso a tus datos y pólizas/i)).toBeInTheDocument()
      })
    })
  })

  describe('Tab Navigation', () => {
    beforeEach(() => {
      mockLocalStorage.setAuthData()
    })

    it('should highlight active tab', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
      })

      const dashboardTab = screen.getByText('📊 Dashboard')
      expect(dashboardTab).toHaveClass('border-blue-500', 'text-blue-600')

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        expect(polizasTab).toHaveClass('border-blue-500', 'text-blue-600')
      })
    })

    it('should switch content when clicking tabs', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard (Vista Cliente)')).toBeInTheDocument()
      })

      const datosTab = screen.getByText('👤 Mis Datos')
      await user.click(datosTab)

      await waitFor(() => {
        expect(screen.getByText('Mis Datos Personales')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should maintain tab state across interactions', async () => {
      const user = userEvent.setup()
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument()
      })

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      await user.click(polizasTab)

      await waitFor(() => {
        // Check that we're no longer on the dashboard
        expect(screen.queryByText('Dashboard (Vista Cliente)')).not.toBeInTheDocument()
      }, { timeout: 3000 })

      // Tab should remain active
      expect(polizasTab).toHaveClass('border-blue-500')
    })
  })

  describe('Role Color Coding', () => {
    it('should apply red color to admin role', async () => {
      mockLocalStorage.setAuthData('token', 'admin@test.com', 'admin')
      render(<App />)

      const adminBadge = await screen.findByText('Administrador')
      expect(adminBadge).toHaveClass('text-red-600')
    })

    it('should apply blue color to empleado role', async () => {
      mockLocalStorage.setAuthData('token', 'empleado@test.com', 'empleado')
      render(<App />)

      const empleadoBadge = await screen.findByText('Empleado')
      expect(empleadoBadge).toHaveClass('text-blue-600')
    })

    it('should apply green color to cliente role', async () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      const clienteBadge = await screen.findByText('Cliente')
      expect(clienteBadge).toHaveClass('text-green-600')
    })
  })
})
