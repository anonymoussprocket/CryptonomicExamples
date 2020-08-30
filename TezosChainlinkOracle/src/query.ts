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

interface ClientStorage {
    administrator: string;
    fortune: string;
    jobId: string;
    requestId: number;
    oracleAddress: string;
    tokenAddress: string;
    pendingRequestId: number;
}

let state: any;
let tezosNode: string;
let conseilServer: any;
let networkBlockTime: number;
let tokenAddress: string;
let oracleAddress: string;
let clientAddress: string;

let monitor: any;
let currentFortune: string;
let newFortune: string;

function clearRPCOperationGroupHash(hash: string) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}

function init() {
    state = JSON.parse(fs.readFileSync('../state.json').toString());
    tezosNode = state.config.tezosNode;
    conseilServer = { url: state.config.conseilURL, apiKey: state.config.conseilApiKey, network: state.config.conseilNetwork };
    networkBlockTime = state.config.networkBlockTime;
    tokenAddress = state.tokenAddress;
    oracleAddress = state.oracleAddress;
    clientAddress = state.clientAddress;
}

async function getSimpleStorage(): Promise<ClientStorage> {
    const storageResult = await TezosNodeReader.getContractStorage(tezosNode, clientAddress);

    let storage = {
        administrator: JSONPath({ path: '$.args[0].args[0].string', json: storageResult })[0],
        fortune: JSONPath({ path: '$.args[0].args[1].args[0].string', json: storageResult })[0],
        jobId: JSONPath({ path: '$.args[0].args[1].args[1].bytes', json: storageResult })[0],
        requestId: Number(JSONPath({ path: '$.args[1].args[0].args[0].int', json: storageResult })[0]),
        oracleAddress: JSONPath({ path: '$.args[1].args[0].args[1].string', json: storageResult })[0],
        tokenAddress: JSONPath({ path: '$.args[1].args[1].args[0].string', json: storageResult })[0],
        pendingRequestId: -1
    };

    try {
        storage.pendingRequestId = Number(JSONPath({ path: '$.args[1].args[1].args[1].int', json: storageResult })[0]);
    } catch { }

    return storage;
}

async function checkFortune() {
    
}

async function switchOracle() {
    //KT1TQR3eyYCytqBK9EB28J1taa2cX41F9R8x
}

async function requestFortune(signer: Signer, keyStore: KeyStore, payment: number) {
    const fee = 300_000;
    const gasLimit = 500_000;
    const storageFee = 3_000;

    const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, 'request_fortune', '0', TezosParameterFormat.Michelson);
    //const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, '', `(Right (Right Unit))`, TezosParameterFormat.Michelson);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);

    console.log(`Injected transaction operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    console.log(JSON.stringify(conseilResult));
}

async function confirmTokenBalance(address: string, minimum: number) {
    const storage = await MultiAssetTokenHelper.getSimpleStorage(tezosNode, tokenAddress);
    const token = await MultiAssetTokenHelper.getTokenDefinition(tezosNode, storage.metadataMap);
    const balance = await MultiAssetTokenHelper.getAccountBalance(tezosNode, storage.balanceMap, address, token.tokenid);

    if (balance < minimum) { throw new Error('Insufficient token balance'); }
}

async function run() {
    init();

    const oracleFee = 1;

    const userKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleUserZach.secretKey);
    const userSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(userKeyStore.secretKey, 'edsk'));

    await confirmTokenBalance(userKeyStore.publicKeyHash, oracleFee);

    const contractState = await getSimpleStorage();
    //console.log(JSON.stringify(contractState, null, 4));
    currentFortune = contractState.fortune;

    //monitor = setInterval(async () => { await checkFortune() }, networkBlockTime * 1000 * 5);
    await requestFortune(userSigner, userKeyStore, oracleFee);
}

run();
