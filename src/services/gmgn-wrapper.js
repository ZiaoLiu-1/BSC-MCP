import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for the current module first
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../check.py');

/**
 * Execute the check.py script with the provided arguments
 * @param {Array} args - Arguments to pass to the Python script
 * @returns {Promise<Object>} - The parsed JSON result from the Python script
 */
function executePythonScript(args) {
  return new Promise((resolve, reject) => {
    console.error(`Executing Python script: python ${scriptPath} ${args.join(' ')}`);
    
    const pythonProcess = spawn('python', [scriptPath, ...args]);
    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`Error: ${errorString}`);
        reject(new Error(`Python script exited with code ${code}: ${errorString}`));
        return;
      }
      
      try {
        // Try to extract and parse JSON from the output
        // Look for valid JSON by finding matching braces
        const jsonMatch = dataString.match(/(\{.*\})/s);
        if (jsonMatch && jsonMatch[0]) {
          const jsonString = jsonMatch[0];
          const result = JSON.parse(jsonString);
          resolve(result);
        } else {
          console.error('Could not find valid JSON in output');
          console.error('Raw output:', dataString);
          resolve({ 
            status: "error", 
            message: "Could not parse Python output as JSON",
            traders: [] 
          });
        }
      } catch (error) {
        // If it's not valid JSON, return an error result
        console.error('Failed to parse JSON:', error);
        console.error('Raw output:', dataString);
        resolve({ 
          status: "error", 
          message: `Failed to parse output: ${error.message}`,
          traders: [] 
        });
      }
    });
  });
}

/**
 * Get top traders for a specific token using the Python implementation
 * @param {string} tokenAddress - Token contract address
 * @param {number} limit - Maximum number of traders to return
 * @param {string} orderBy - Field to order results by
 * @param {string} direction - Sort direction (asc or desc)
 * @returns {Promise<Object>} - The trader data
 */
export async function getTopTradersGMGN(tokenAddress, limit = 100, orderBy = 'profit', direction = 'desc') {
  const args = ['get_top_traders', tokenAddress, '--limit', limit.toString()];
  
  if (orderBy) {
    args.push('--orderby', orderBy);
  }
  
  if (direction) {
    args.push('--direction', direction);
  }
  
  return executePythonScript(args);
}

/**
 * Get top traders for multiple tokens in a single call
 * @param {string[]} tokenAddresses - Array of token contract addresses
 * @param {number} limit - Maximum number of traders to return per token
 * @param {string} orderBy - Field to order results by
 * @param {string} direction - Sort direction (asc or desc)
 * @returns {Promise<Object>} - Object with results for each token
 */
export async function getMultipleTopTradersGMGN(tokenAddresses, limit = 5, orderBy = 'profit', direction = 'desc') {
  // Validate input
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return {
      status: "error",
      message: "No token addresses provided",
      results: {}
    };
  }

  const results = {};
  const errors = [];

  // Process each token address in parallel
  const promises = tokenAddresses.map(async (tokenAddress) => {
    try {
      const result = await getTopTradersGMGN(tokenAddress, limit, orderBy, direction);
      results[tokenAddress] = {
        status: result.status || "success",
        traders: result.traders || [],
        count: result.traders ? result.traders.length : 0
      };
    } catch (error) {
      errors.push(`Error fetching data for ${tokenAddress}: ${error.message}`);
      results[tokenAddress] = {
        status: "error",
        message: error.message,
        traders: []
      };
    }
  });

  // Wait for all requests to complete
  await Promise.all(promises);

  return {
    status: errors.length > 0 ? "partial" : "success",
    errors: errors.length > 0 ? errors : undefined,
    results
  };
}

/**
 * Get token trades from GMGN
 * @param {string} tokenAddress - Token contract address
 * @param {number} fromTimestamp - Start timestamp
 * @param {number} toTimestamp - End timestamp
 * @param {number} limit - Maximum number of trades to return
 * @param {string} maker - Trader wallet address
 * @returns {Promise<Object>} - The trades data
 */
export async function getTokenTradesGMGN(
  tokenAddress, 
  fromTimestamp = 0, 
  toTimestamp = Math.floor(Date.now() / 1000), 
  limit = 100, 
  maker = ''
) {
  const args = [
    'fetch_token_trades', 
    tokenAddress,
    '--from', fromTimestamp.toString(),
    '--to', toTimestamp.toString(),
    '--limit', limit.toString()
  ];
  
  if (maker) {
    args.push('--maker', maker);
  }
  
  return executePythonScript(args);
} 