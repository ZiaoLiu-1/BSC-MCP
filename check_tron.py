import random
import tls_client
from fake_useragent import UserAgent
import time
import uuid
import json
import argparse
import sys
import os

class GMGNClient:
    """Client for accessing GMGN API data for Tron tokens"""
    
    def randomiseRequest(self):
        """Set up a randomized TLS client session with appropriate headers"""
        self.identifier = random.choice([browser for browser in tls_client.settings.ClientIdentifiers.__args__ if browser.startswith(('chrome', 'safari', 'firefox', 'opera'))])
        self.sendRequest = tls_client.Session(random_tls_extension_order=True, client_identifier=self.identifier)

        parts = self.identifier.split('_')
        identifier, version, *rest = parts
        other = rest[0] if rest else None

        os = 'windows'
        if identifier == 'opera':
            identifier = 'chrome'
        elif version == 'ios':
            os = 'ios'
        else:
            os = 'windows'

        self.user_agent = UserAgent(browsers=[identifier], os=[os]).random

        self.headers = {
            'Host': 'gmgn.ai',
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'dnt': '1',
            'priority': 'u=1, i',
            'referer': 'https://gmgn.ai/?chain=tron',
            'user-agent': self.user_agent
        }

    def fetch_token_trades(self, token_address, from_timestamp=0, to_timestamp=int(time.time()), limit=100, maker="", next_page=None):
        """
        Fetch token trades from gmgn.ai API
        
        Args:
            token_address: Token contract address
            from_timestamp: Start timestamp
            to_timestamp: End timestamp
            limit: Number of records to return (default 100)
            maker: Trader wallet address (optional)
            next_page: Next page identifier (optional)
        
        Returns:
            dict: API response data
        """
        base_url = "https://gmgn.ai/api/v1/token_trades/tron"
        
        # Clean the token address if it has URL parameters
        if '?' in token_address:
            token_address = token_address.split('?')[0]
        
        params = {
            "device_id": str(uuid.uuid4()),
            "client_id": f"gmgn_web_{time.strftime('%Y.%m%d.%H%M%S')}",
            "from_app": "gmgn",
            "app_ver": f"{time.strftime('%Y.%m%d.%H%M%S')}",
            "tz_name": "Asia/Shanghai",
            "tz_offset": "28800",
            "app_lang": "zh-CN",
            "limit": limit,
            "maker": maker,
            "from": from_timestamp,
            "to": to_timestamp
        }

        if next_page:
            params["cursor"] = next_page
        
        url = f"{base_url}/{token_address}"
        
        try:
            self.randomiseRequest()  # Randomize request info before each request
            response = self.sendRequest.get(url, params=params, headers=self.headers)
            if response.status_code != 200:
                raise Exception(f"HTTP Error: {response.status_code}")
            return response.json()
        except Exception as e:
            print(f"Error getting token trade data: {e}", file=sys.stderr)
            return {"error": str(e)}

    def get_top_traders(self, token_address, limit=100, orderby="profit", direction="desc", save_to_file=False):
        """
        Get top traders for a token on Tron
        
        Args:
            token_address: Token contract address
            limit: Maximum number of traders to return (default 100)
            orderby: Sort field (default 'profit')
            direction: Sort direction ('asc' or 'desc')
            save_to_file: Whether to save results to a file (default False)
        
        Returns:
            list: List of trader details with address and profit information
        """
        base_url = "https://gmgn.ai/defi/quotation/v1/tokens/top_traders/tron"
        
        # Clean the token address if it has URL parameters
        if '?' in token_address:
            token_address = token_address.split('?')[0]
        
        device_id = str(uuid.uuid4())
        timestamp = time.strftime('%Y.%m%d.%H%M%S')
        
        params = {
            "device_id": device_id,
            "client_id": f"gmgn_web_{timestamp}",
            "from_app": "gmgn",
            "app_ver": timestamp,
            "tz_name": "Asia/Shanghai",
            "tz_offset": "28800",
            "app_lang": "zh-CN",
            "limit": limit,
            "orderby": orderby,
            "direction": direction
        }
        
        url = f"{base_url}/{token_address}"
        
        try:
            self.randomiseRequest()  # Randomize request info before each request
            response = self.sendRequest.get(url, params=params, headers=self.headers)
            if response.status_code != 200:
                raise Exception(f"HTTP Error: {response.status_code}")
            
            data = response.json()
            if not data or 'data' not in data:
                raise Exception("Invalid response data")
            
            # Extract trader details
            traders = data['data']
            trader_details = []
            
            for trader in traders:
                if 'address' in trader:
                    trader_info = {
                        'address': trader['address'],
                        'profit': trader.get('profit', 0),
                        'profit_usd': trader.get('profit_usd', 0),
                        'volume': trader.get('volume', 0),
                        'volume_usd': trader.get('volume_usd', 0),
                        'buy_count': trader.get('buy_count', 0),
                        'sell_count': trader.get('sell_count', 0)
                    }
                    trader_details.append(trader_info)
            
            # Optionally save to file
            if save_to_file:
                with open('tron_top_traders.txt', 'w') as f:
                    for trader in trader_details:
                        f.write(f"{trader['address']}\n")
                print(f"Successfully saved {len(trader_details)} trader addresses to tron_top_traders.txt", file=sys.stderr)
            
            return {
                "status": "success",
                "count": len(trader_details),
                "traders": trader_details
            }
            
        except Exception as e:
            print(f"Error getting top traders data: {e}", file=sys.stderr)
            return {
                "status": "error",
                "message": str(e),
                "traders": []
            }

def parse_arguments():
    parser = argparse.ArgumentParser(description='GMGN API Client for Tron')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # get_top_traders command
    top_traders_parser = subparsers.add_parser('get_top_traders', help='Get top traders for a token')
    top_traders_parser.add_argument('token_address', help='Token contract address')
    top_traders_parser.add_argument('--limit', type=int, default=100, help='Maximum number of traders to return')
    top_traders_parser.add_argument('--orderby', default='profit', help='Field to order results by')
    top_traders_parser.add_argument('--direction', default='desc', choices=['asc', 'desc'], help='Sort direction')
    top_traders_parser.add_argument('--save', action='store_true', help='Save results to a file')
    
    # fetch_token_trades command
    token_trades_parser = subparsers.add_parser('fetch_token_trades', help='Fetch token trades')
    token_trades_parser.add_argument('token_address', help='Token contract address')
    token_trades_parser.add_argument('--from', dest='from_timestamp', type=int, default=0, help='Start timestamp')
    token_trades_parser.add_argument('--to', dest='to_timestamp', type=int, 
                                    default=int(time.time()), help='End timestamp')
    token_trades_parser.add_argument('--limit', type=int, default=100, help='Number of records to return')
    token_trades_parser.add_argument('--maker', default='', help='Trader wallet address')
    
    return parser.parse_args()

# Example usage
if __name__ == "__main__":
    # Ensure no garbage is printed to stdout
    sys.stdout = open(os.dup(1), 'w', buffering=1)
    sys.stderr = open(os.dup(2), 'w', buffering=1)
    
    args = parse_arguments()
    client = GMGNClient()
    
    if args.command == 'get_top_traders':
        result = client.get_top_traders(
            args.token_address, 
            args.limit, 
            args.orderby, 
            args.direction, 
            args.save
        )
        # Print only the JSON result to stdout
        sys.stdout.write(json.dumps(result))
    
    elif args.command == 'fetch_token_trades':
        result = client.fetch_token_trades(
            args.token_address,
            args.from_timestamp,
            args.to_timestamp,
            args.limit,
            args.maker
        )
        # Print only the JSON result to stdout
        sys.stdout.write(json.dumps(result))
    
    else:
        sys.stderr.write("Unknown command\n")
        result = {"status": "error", "message": "Unknown command"}
        sys.stdout.write(json.dumps(result))
        sys.exit(1) 