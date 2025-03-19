import axios from 'axios';
import UserAgent from 'user-agents';
import { v4 as uuidv4 } from 'uuid';

/**
 * Client for accessing GMGN API data for BSC tokens
 */
class GMGNClient {
  /**
   * Set up a randomized client session with appropriate headers
   * @returns {object} Headers and request configuration
   */
  randomizeRequest() {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
    
    const headers = {
      'Host': 'gmgn.ai',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'dnt': '1',
      'priority': 'u=1, i',
      'referer': 'https://gmgn.ai/?chain=bsc',
      'user-agent': userAgent
    };
    
    return { headers };
  }

  /**
   * Get top traders for a token on BSC
   * 
   * @param {string} tokenAddress - Token contract address
   * @param {number} limit - Maximum number of traders to return (default 100)
   * @param {string} orderby - Sort field (default 'profit')
   * @param {string} direction - Sort direction ('asc' or 'desc')
   * @returns {Promise<Array>} List of trader details with address and profit information
   */
  async getTopTraders(tokenAddress, limit = 100, orderby = "profit", direction = "desc") {
    const baseUrl = "https://gmgn.ai/defi/quotation/v1/tokens/top_traders/bsc";
    
    // Clean the token address if it has URL parameters
    if (tokenAddress.includes('?')) {
      tokenAddress = tokenAddress.split('?')[0];
    }
    
    const deviceId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    
    const params = {
      "device_id": deviceId,
      "client_id": `gmgn_web_${timestamp}`,
      "from_app": "gmgn",
      "app_ver": timestamp,
      "tz_name": "Asia/Shanghai",
      "tz_offset": "28800",
      "app_lang": "zh-CN",
      "limit": limit,
      "orderby": orderby,
      "direction": direction
    };
    
    const url = `${baseUrl}/${tokenAddress}`;
    
    try {
      const { headers } = this.randomizeRequest();
      const response = await axios.get(url, { params, headers });
      
      if (response.status !== 200) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const data = response.data;
      if (!data || !data.data) {
        throw new Error("Invalid response data");
      }
      
      // Extract trader details
      const traders = data.data;
      const traderDetails = [];
      
      for (const trader of traders) {
        if (trader.address) {
          const traderInfo = {
            address: trader.address,
            profit: trader.profit || 0,
            profit_usd: trader.profit_usd || 0,
            volume: trader.volume || 0,
            volume_usd: trader.volume_usd || 0,
            buy_count: trader.buy_count || 0,
            sell_count: trader.sell_count || 0
          };
          traderDetails.push(traderInfo);
        }
      }
      
      return traderDetails;
    } catch (error) {
      console.error(`Error getting top traders data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch token trades from gmgn.ai API
   * 
   * @param {string} tokenAddress - Token contract address
   * @param {number} fromTimestamp - Start timestamp
   * @param {number} toTimestamp - End timestamp
   * @param {number} limit - Number of records to return (default 100)
   * @param {string} maker - Trader wallet address (optional)
   * @param {string} nextPage - Next page identifier (optional)
   * @returns {Promise<object>} API response data
   */
  async fetchTokenTrades(
    tokenAddress, 
    fromTimestamp = 0, 
    toTimestamp = Math.floor(Date.now() / 1000), 
    limit = 100, 
    maker = "", 
    nextPage = null
  ) {
    const baseUrl = "https://gmgn.ai/api/v1/token_trades/bsc";
    
    // Clean the token address if it has URL parameters
    if (tokenAddress.includes('?')) {
      tokenAddress = tokenAddress.split('?')[0];
    }
    
    const params = {
      "device_id": uuidv4(),
      "client_id": `gmgn_web_${new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]}`,
      "from_app": "gmgn",
      "app_ver": new Date().toISOString().replace(/[-:T]/g, '').split('.')[0],
      "tz_name": "Asia/Shanghai",
      "tz_offset": "28800",
      "app_lang": "zh-CN",
      "limit": limit,
      "maker": maker,
      "from": fromTimestamp,
      "to": toTimestamp
    };

    if (nextPage) {
      params.cursor = nextPage;
    }
    
    const url = `${baseUrl}/${tokenAddress}`;
    
    try {
      const { headers } = this.randomizeRequest();
      const response = await axios.get(url, { params, headers });
      
      if (response.status !== 200) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error getting token trade data: ${error.message}`);
      throw error;
    }
  }
}

// Create singleton instance
const gmgnClient = new GMGNClient();

export default gmgnClient; 