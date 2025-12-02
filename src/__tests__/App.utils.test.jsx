import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { mockLocalStorage } from '../tests/utils/testUtils'

describe('App Utility Functions', () => {
  describe('getRoleName', () => {
    it('should display "Administrador" for admin role', () => {
      mockLocalStorage.setAuthData('token', 'admin@test.com', 'admin')
      render(<App />)

      expect(screen.getByText('Administrador')).toBeInTheDocument()
    })

    it('should display "Empleado" for empleado role', () => {
      mockLocalStorage.setAuthData('token', 'empleado@test.com', 'empleado')
      render(<App />)

      expect(screen.getByText('Empleado')).toBeInTheDocument()
    })

    it('should display "Cliente" for cliente role', () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      expect(screen.getByText('Cliente')).toBeInTheDocument()
    })
  })

  describe('getRoleColor', () => {
    it('should apply red color class for admin', () => {
      mockLocalStorage.setAuthData('token', 'admin@test.com', 'admin')
      render(<App />)

      const roleElement = screen.getByText('Administrador')
      expect(roleElement).toHaveClass('text-red-600')
    })

    it('should apply blue color class for empleado', () => {
      mockLocalStorage.setAuthData('token', 'empleado@test.com', 'empleado')
      render(<App />)

      const roleElement = screen.getByText('Empleado')
      expect(roleElement).toHaveClass('text-blue-600')
    })

    it('should apply green color class for cliente', () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      const roleElement = screen.getByText('Cliente')
      expect(roleElement).toHaveClass('text-green-600')
    })
  })

  describe('getTabs', () => {
    it('should show 7 tabs for admin users', async () => {
      mockLocalStorage.setAuthData('token', 'admin@test.com', 'admin')
      render(<App />)

      // Wait for component to render
      await screen.findByText('📊 Dashboard')

      expect(screen.getByText('👥 Usuarios')).toBeInTheDocument()
      expect(screen.getByText('📈 CRM')).toBeInTheDocument()
      expect(screen.getByText('👤 Clientes')).toBeInTheDocument()
      expect(screen.getByText('📄 Pólizas')).toBeInTheDocument()
      expect(screen.getByText('🚗 Vehículos')).toBeInTheDocument()
      expect(screen.getByText('📊 Reportes')).toBeInTheDocument()
    })

    it('should show 5 tabs for empleado users', async () => {
      mockLocalStorage.setAuthData('token', 'empleado@test.com', 'empleado')
      render(<App />)

      await screen.findByText('📊 Dashboard')

      expect(screen.getByText('📈 CRM')).toBeInTheDocument()
      expect(screen.getByText('👤 Clientes')).toBeInTheDocument()
      expect(screen.getByText('📄 Pólizas')).toBeInTheDocument()
      expect(screen.getByText('🚗 Vehículos')).toBeInTheDocument()

      // Should NOT have admin-only tabs
      expect(screen.queryByText('👥 Usuarios')).not.toBeInTheDocument()
      expect(screen.queryByText('📊 Reportes')).not.toBeInTheDocument()
    })

    it('should show 5 tabs for cliente users', async () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      await screen.findByText('📊 Dashboard')

      expect(screen.getByText('👤 Mis Datos')).toBeInTheDocument()
      expect(screen.getByText('📄 Mis Pólizas')).toBeInTheDocument()
      expect(screen.getByText('🚗 Mis Vehículos')).toBeInTheDocument()
      expect(screen.getByText('🎫 Soporte')).toBeInTheDocument()

      // Should NOT have admin/empleado tabs
      expect(screen.queryByText('👥 Usuarios')).not.toBeInTheDocument()
      expect(screen.queryByText('📈 CRM')).not.toBeInTheDocument()
      expect(screen.queryByText('📊 Reportes')).not.toBeInTheDocument()
    })

    it('should always show Dashboard tab for all roles', async () => {
      const roles = ['admin', 'empleado', 'cliente']

      for (const role of roles) {
        localStorage.clear()
        mockLocalStorage.setAuthData('token', `${role}@test.com`, role)
        const { unmount } = render(<App />)

        expect(await screen.findByText('📊 Dashboard')).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Currency and Date Formatting', () => {
    it('should format currency correctly', async () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      // Wait for data to load and navigate to polizas
      await screen.findByText('📊 Dashboard')

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      polizasTab.click()

      // Check if currency is formatted (our mock has 50000)
      await screen.findByText(/50\.000/)
    })

    it('should display days until expiration', async () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      await screen.findByText('📊 Dashboard')

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      polizasTab.click()

      // Check if days are displayed (our mock has 45 and 15 days)
      await screen.findByText('45 días')
      expect(screen.getByText('15 días')).toBeInTheDocument()
    })

    it('should apply warning color to policies expiring soon', async () => {
      mockLocalStorage.setAuthData('token', 'cliente@test.com', 'cliente')
      render(<App />)

      await screen.findByText('📊 Dashboard')

      const polizasTab = screen.getByText('📄 Mis Pólizas')
      polizasTab.click()

      // Policy with 15 days should have red color (< 30 days)
      const nearExpiryElement = await screen.findByText('15 días')
      expect(nearExpiryElement).toHaveClass('text-red-600')

      // Policy with 45 days should have green color (>= 30 days)
      const safeExpiryElement = screen.getByText('45 días')
      expect(safeExpiryElement).toHaveClass('text-green-600')
    })
  })
})
