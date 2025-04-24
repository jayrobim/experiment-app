import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: 'experiment', // 设置为相对路径
  build: {
    outDir: 'experiment', // 输出目录
    assetsDir: 'assets' // 静态资源子目录
  }
})