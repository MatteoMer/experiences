import { defineConfig } from 'astro/config';
import { VitePWA } from 'vite-plugin-pwa';
import solidJs from "@astrojs/solid-js";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [VitePWA()]
  },
  integrations: [solidJs(), tailwind()]
});