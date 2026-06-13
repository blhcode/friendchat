import { initApp } from './app'
import { initTheme } from './theme'
import './style.css'

initTheme()

const root = document.querySelector<HTMLElement>('#app')
if (root) {
  void initApp(root)
}
