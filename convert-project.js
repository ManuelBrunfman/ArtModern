const fs = require('fs');
const path = require('path');

function projectToJson(projectPath, ignoreDirs = ['node_modules', '.git', 'build', 'dist']) {
  const result = { files: {} };
  
  function processDir(dirPath, currentObj) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      const relativePath = path.relative(projectPath, itemPath);
      
      if (stats.isDirectory()) {
        if (ignoreDirs.includes(item)) continue;
        
        currentObj[item] = { files: {} };
        processDir(itemPath, currentObj[item].files);
      } else {
        try {
          // Solo incluir archivos de código y configuración
          const ext = path.extname(item).toLowerCase();
          if (['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.html'].includes(ext)) {
            const content = fs.readFileSync(itemPath, 'utf8');
            currentObj[item] = content;
          }
        } catch (error) {
          console.error(`Error reading file ${itemPath}:`, error);
        }
      }
    }
  }
  
  processDir(projectPath, result.files);
  return result;
}

// Uso
const projectPath = '.';
const projectJson = projectToJson(projectPath);
fs.writeFileSync('proyecto.json', JSON.stringify(projectJson, null, 2));