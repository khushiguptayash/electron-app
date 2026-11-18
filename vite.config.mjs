// Import Vite's configuration helper for a typed configuration object.
import { defineConfig } from 'vite';
// Import the official React plugin for JSX transformation and React integration.
import react from '@vitejs/plugin-react';

// Export the Vite build configuration used by npm start and npm run build.
export default defineConfig({
  // Enable React JSX compilation and development integration.
  plugins: [react()],
  // Use relative asset URLs so Electron can open the built HTML from the dist folder.
  base: './',
});
