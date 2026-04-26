import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { inject } from '@vercel/analytics'

// Initialize Vercel Web Analytics
inject()

const app = createApp(App)
app.use(createPinia())  // This registers Pinia so all components can use stores
app.mount('#app')