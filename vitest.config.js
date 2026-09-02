import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Config separada de vite.config.js para no arrastrar el plugin de Tailwind
// (innecesario para tests de la capa de datos) al runner de tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
