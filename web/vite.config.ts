/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: '/',
    server: { port: 5183 },
    build: { target: 'esnext' },
    test: {
        include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'api/**/*.test.ts'],
        environment: 'node',
        setupFiles: ['./testSetup.ts'],
    },
});
