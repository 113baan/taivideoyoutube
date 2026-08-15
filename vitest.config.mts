import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Cac service thuan tuy chay duoc trong Node, khong can Electron.
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
