// extractAuctionFilesDetailed.js
const fs = require('fs');
const path = require('path');

// Archivos que queremos extraer
const files = [
  'src/contexts/GameContext.tsx',
  'src/screens/AuctionScreen/AuctionScreen.tsx',
  'src/services/auctionService.ts',
  'src/utils/roundManager.ts',
  'src/types/auction.ts',
];

// Nombre del archivo de salida
const outputFile = 'subasta_extraccion_detailed.txt';

// Función para extraer funciones, clases y tipos
const extractSummary = (content) => {
  const functions = [...content.matchAll(/(?:export\s+)?function\s+(\w+)/g)].map(m => m[1]);
  const arrowFunctions = [...content.matchAll(/const\s+(\w+)\s*=\s*\(/g)].map(m => m[1]);
  const classes = [...content.matchAll(/class\s+(\w+)/g)].map(m => m[1]);
  const types = [...content.matchAll(/(?:export\s+)?type\s+(\w+)/g)].map(m => m[1]);
  const interfaces = [...content.matchAll(/(?:export\s+)?interface\s+(\w+)/g)].map(m => m[1]);

  return { functions, arrowFunctions, classes, types, interfaces };
};

// Función principal
const extractFiles = () => {
  let combinedContent = '';

  files.forEach((filePath) => {
    const absolutePath = path.resolve(filePath);

    if (fs.existsSync(absolutePath)) {
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');

      const summary = extractSummary(fileContent);

      combinedContent += `\n\n===== ${filePath} =====\n\n`;

      combinedContent += `📋 Resumen:\n`;
      if (summary.functions.length) combinedContent += `- Funciones: ${summary.functions.join(', ')}\n`;
      if (summary.arrowFunctions.length) combinedContent += `- Funciones Flecha: ${summary.arrowFunctions.join(', ')}\n`;
      if (summary.classes.length) combinedContent += `- Clases: ${summary.classes.join(', ')}\n`;
      if (summary.types.length) combinedContent += `- Tipos: ${summary.types.join(', ')}\n`;
      if (summary.interfaces.length) combinedContent += `- Interfaces: ${summary.interfaces.join(', ')}\n`;

      combinedContent += `\n🧩 Código Completo:\n\n`;
      combinedContent += fileContent;
      combinedContent += `\n\n========================\n\n`;
    } else {
      combinedContent += `\n\n===== ${filePath} (NO EXISTE) =====\n\n`;
    }
  });

  fs.writeFileSync(outputFile, combinedContent, 'utf-8');
  console.log(`✅ Archivo generado: ${outputFile}`);
};

// Ejecutar
extractFiles();
