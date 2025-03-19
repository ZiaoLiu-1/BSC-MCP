import { request, gql } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();

// Update to use the streaming endpoint which works with our API key
const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';
const API_KEY = process.env.BITQUERY_API_KEY;

// Use X-API-KEY header which our test confirmed works
const headers = {
  'Content-Type': 'application/json',
  'X-API-KEY': API_KEY
};

// Get newly created tokens on Four Meme
export async function getNewlyCreatedTokensOnFourMeme(limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time }
          limit: { count: ${limit} }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Sender: { is: "0x0000000000000000000000000000000000000000" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          Call {
            From
            Value
            To
            Signature {
              Name
              Signature
            }
          }
          Log {
            SmartContract
            Signature {
              Name
            }
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Transfers;
  } catch (error) {
    console.error('Error fetching newly created tokens:', error);
    throw error;
  }
}

// Get latest trades of a token on Four Meme
export async function getLatestTradesOfToken(tokenAddress, limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          where: {
            Log: {Signature: {Name: {is: "TokenSale"}}}, 
            Arguments: {includes: {Value: {Address: {is: "${tokenAddress}"}}}}}
          orderBy: {descending: Block_Time}
          limit: {count: ${limit}}
        ) {
          Log {
            Signature {
              Name
            }
          }
          Transaction {
            From
            To
            Value
            Type
            Hash
          }
          Arguments {
            Type
            Value {
              ... on EVM_ABI_Boolean_Value_Arg {
                bool
              }
              ... on EVM_ABI_Bytes_Value_Arg {
                hex
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
              ... on EVM_ABI_String_Value_Arg {
                string
              }
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
            }
            Name
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Events;
  } catch (error) {
    console.error(`Error fetching latest trades for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Track trades by a Four Meme user
export async function getTradesByUser(userAddress) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        buys: Transfers(
          orderBy: { descending: Block_Time }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Receiver: { is: "${userAddress}" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
        sells: Transfers(
          orderBy: { descending: Block_Time }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Sender: { is: "${userAddress}" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return {
      buys: data.EVM.buys,
      sells: data.EVM.sells
    };
  } catch (error) {
    console.error(`Error fetching trades for user ${userAddress}:`, error);
    throw error;
  }
}

// Get latest trades of a token on Four Meme using Transfers
export async function getLatestTokenTransfers(tokenAddress, limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time }
          limit: { count: ${limit} }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Currency: {
                SmartContract: { is: "${tokenAddress}" }
              }
            }
            TransactionStatus: { Success: true }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Sender
            Receiver
          }
          Transaction {
            Hash
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Transfers;
  } catch (error) {
    console.error(`Error fetching token transfers for ${tokenAddress}:`, error);
    throw error;
  }
}

// Get top buyers for a token on Four Meme
export async function getTopBuyersForToken(tokenAddress) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time, descendingByField: "total" }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Currency: {
                SmartContract: { is: "${tokenAddress}" }
              }
              Sender: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            TransactionStatus: { Success: true }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Buyer: Receiver
          }
          total: sum(of: Transfer_Amount)
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Transfers;
  } catch (error) {
    console.error(`Error fetching top buyers for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Track liquidity add events for all tokens on Four Meme
export async function getLiquidityAddedEvents(limit = 20) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          limit: {count: ${limit}}
          where: {
            LogHeader: {Address: {is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b"}},
            Log: {Signature: {Name: {is: "LiquidityAdded"}}}
          }
        ) {
          Block {
            Time
            Number
            Hash
          }
          Transaction {
            Hash
            From
            To
          }
          Arguments {
            Name
            Value {
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Events;
  } catch (error) {
    console.error('Error fetching liquidity added events:', error);
    throw error;
  }
}

// Track liquidity add events for a specific token on Four Meme
export async function getTokenLiquidityAddedEvents(tokenAddress, limit = 20) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          limit: {count: ${limit}}
          where: {
            LogHeader: {Address: {is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b"}}, 
            Log: {Signature: {Name: {is: "LiquidityAdded"}}}, 
            Arguments: {includes: {Name: {is: "token1"}, Value: {Address: {is: "${tokenAddress}"}}}}
          }
        ) {
          Block {
            Time
            Number
            Hash
          }
          Transaction {
            Hash
            From
            To
          }
          Arguments {
            Name
            Value {
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, headers);
    return data.EVM.Events;
  } catch (error) {
    console.error(`Error fetching liquidity added events for token ${tokenAddress}:`, error);
    throw error;
  }
} 