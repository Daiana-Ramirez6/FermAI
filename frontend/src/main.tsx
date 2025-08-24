import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App' 

createRoot(document.getElementById('root')!).render( //busca el div vacio con id root en index.html, con create root le dice a react aqui vas a trabajar
  <StrictMode> 
    <App />
  </StrictMode>,
)
//.render(<App />): react mete tu aplicación <App /> dentro del div con id root en index.html
//StrictMode: ayuda a detectar problemas en la aplicación, activa comprobaciones adicionales y advertencias durante el desarrollo, no afecta al entorno de producción