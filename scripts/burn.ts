import { getClient } from '../src/client';
import { toStars } from '../src/utils';
import inquirer from 'inquirer';
import { mintTo } from './mint';
import { SigningCosmWasmClient } from 'cosmwasm';

const config = require('../config');
const BATCH_BURN_LIMIT = 50;

async function burn(client: SigningCosmWasmClient, msg: any) {
  const account = toStars(config.account);
  const minter = toStars(config.minter);
  const minterConfigResponse = await client.queryContractSmart(minter, {
    config: {},
  });
  const sg721 = minterConfigResponse.sg721_address;
  const result = await client.execute(account, sg721, msg, 'auto', 'burn');
  const wasmEvent = result.logs[0].events.find((e) => e.type === 'wasm');
  console.info(
    'The `wasm` event emitted by the contract execution:',
    wasmEvent
  );
}

async function burnToken(token: number) {
  const client = await getClient();
  const minter = toStars(config.minter);
  const minterConfigResponse = await client.queryContractSmart(minter, {
    config: {},
  });
  console.log('minter configResponse: ', minterConfigResponse);
  const sg721 = minterConfigResponse.sg721_address;

  console.log('SG721: ', sg721);
  console.log('Burning Token: ', token);
  const msg = { burn: { token_id: token } };
  console.log(JSON.stringify(msg, null, 2));
  console.log(
    'Please confirm that you would like to burn this token? This cannot be undone. Also note that this script can only burn tokens from your own wallet.'
  );
  const answer = await inquirer.prompt([
    {
      message: 'Ready to burn this token?',
      name: 'confirmation',
      type: 'confirm',
    },
  ]);
  if (!answer.confirmation) return;

  await burn(client, msg);
}

// Airdrop to yourself and burn excess in batches
// Makes several assumptions:
// - config address is the creator of the collection
// - config minter address is the collection
// - collection is not fully sold out
// - burn several tokens at a time
async function batchBurn() {
  const client = await getClient();
  const minter = toStars(config.minter);
  const account = toStars(config.account);

  const minterConfigResponse = await client.queryContractSmart(minter, {
    config: {},
  });
  console.log('minter configResponse: ', minterConfigResponse);

  const sg721 = minterConfigResponse.sg721_address;
  const totalSupply = minterConfigResponse.num_tokens;

  const sg721ConfigResponse = await client.queryContractSmart(sg721, {
    num_tokens: {},
  });
  const numMintedTokens = sg721ConfigResponse.count;
  console.log('total supply', totalSupply, 'num minted', numMintedTokens);

  const burnCount =
    totalSupply - numMintedTokens > BATCH_BURN_LIMIT
      ? BATCH_BURN_LIMIT
      : totalSupply - numMintedTokens;
  console.log('burning', burnCount, 'tokens');

  // Get confirmation before proceeding
  console.log(
    'WARNING: Burning excess supply. THERE IS NO WAY TO UNDO THIS ONCE IT IS ON CHAIN.'
  );
  const answer = await inquirer.prompt([
    {
      message: 'Ready to submit the transaction?',
      name: 'confirmation',
      type: 'confirm',
    },
  ]);
  if (!answer.confirmation) return;

  //   airdrop and burn 10 at a time
  for (let i = 0; i < burnCount; i++) {
    const tokenId = await mintTo(account);
    console.log('Burning token:', tokenId);
    const msg = { burn: { token_id: tokenId } };
    await burn(client, msg);
  }
}

const args = process.argv.slice(2);
if (args.length == 0) {
  console.log('No arguments provided, need token to burn');
} else if (args.length == 1 && args[0] == '--batch') {
  batchBurn();
} else if (args.length == 1 && args[0]) {
  burnToken(parseInt(args[0]));
} else {
  console.log('Invalid arguments');
}
