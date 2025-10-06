import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// @ts-ignore
import VueKonva from 'vue-konva'

const app = createApp(App)
// @ts-ignore
app.use(VueKonva)
app.mount('#app')
