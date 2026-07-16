// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages (project page) 用の設定
// リポジトリ: https://github.com/4getkun/Curation_MLB
// 公開URL: https://4getkun.github.io/Curation_MLB/
export default defineConfig({
  site: 'https://4getkun.github.io',
  base: '/Curation_MLB',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()],
  },
});
