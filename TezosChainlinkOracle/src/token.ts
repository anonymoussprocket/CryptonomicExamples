import fetch from 'node-fetch';
import * as log from 'loglevel';
import * as fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

import { registerFetch, registerLogger } from 'conseiljs';

import { TezosNodeReader, TezosNodeWriter, TezosConseilClient, TezosMessageUtils, TezosParameterFormat, KeyStore, Signer, MultiAssetTokenHelper } from 'conseiljs';
import { KeyStoreUtils, SoftSigner } from 'conseiljs-softsigner';

const logger = log.getLogger('conseiljs');
logger.setLevel('debug', false);
registerLogger(logger);
registerFetch(fetch);

let state: any;
let tezosNode: string;
let conseilServer: any;
let networkBlockTime: number;
let tokenAddress: string;
let clientAddress: string;

function init() {
    state = JSON.parse(fs.readFileSync('state.json').toString());
    tezosNode = state.config.tezosNode;
    conseilServer = { url: state.config.conseilURL, apiKey: state.config.conseilApiKey, network: state.config.conseilNetwork };
    networkBlockTime = state.config.networkBlockTime;
    tokenAddress = state.tokenAddress;
    clientAddress = state.clientAddress;
}

async function run() {
    init();

    const storage = await MultiAssetTokenHelper.getSimpleStorage(tezosNode, tokenAddress);
    console.log(JSON.stringify(storage, null, 4))
    const token = await MultiAssetTokenHelper.getTokenDefinition(tezosNode, storage.metadataMap);
    console.log(JSON.stringify(token, null, 4))
    let balance = await MultiAssetTokenHelper.getAccountBalance(tezosNode, storage.balanceMap, state.oracleUserZach.pkh, 0);
    console.log(balance);

    const userKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleUserZach.secretKey);
    const userSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(userKeyStore.secretKey, 'edsk'));

    const groupid = await MultiAssetTokenHelper.transfer(tezosNode, tokenAddress, userSigner, userKeyStore, 100_000, userKeyStore.publicKeyHash, [ { address: state.oracleUserAlice.pkh, tokenid: 0, balance: 10 } ]);
    console.log(`Injected transaction operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    balance = await MultiAssetTokenHelper.getAccountBalance(tezosNode, storage.balanceMap, state.oracleUserAlice.pkh, 0);
    console.log(balance);
}

run();
