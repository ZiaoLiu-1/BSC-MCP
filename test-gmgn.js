import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, 'check.py');
const tokenAddress = '0x5c85d6c6825ab4032337f11ee92a72df936b46f6';

console.log(`Executing Python script: python ${scriptPath} get_top_traders ${tokenAddress} --limit 5`);

const pythonProcess = spawn('python', [scriptPath, 'get_top_traders', tokenAddress, '--limit', '5']);
let dataString = '';
let errorString = '';

pythonProcess.stdout.on('data', (data) => {
  dataString += data.toString();
  console.log(`Python stdout: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  errorString += data.toString();
  console.error(`Python stderr: ${data}`);
});

pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
  if (code !== 0) {
    console.error(`Error: ${errorString}`);
    return;
  }
  
  console.log('Raw output:', dataString);
  
  try {
    // Try to parse the output as JSON
    const result = JSON.parse(dataString);
    console.log('Parsed JSON result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Failed to parse JSON:', error);
  }
}); 