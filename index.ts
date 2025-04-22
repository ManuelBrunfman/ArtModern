// index.tsx (entry point)

// Silencia warnings de deprecación del API namespaced de React Native Firebase
;(globalThis as any).RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import { AppRegistry } from 'react-native';
import App from './App'; // Ajusta la ruta a tu componente raíz
const appName = require('./app.json').name;

AppRegistry.registerComponent('main', () => App);
