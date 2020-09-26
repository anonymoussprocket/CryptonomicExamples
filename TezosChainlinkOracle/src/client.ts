import fetch from 'node-fetch';
import * as log from 'loglevel';
import * as fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

import { registerFetch, registerLogger } from 'conseiljs';

import { TezosNodeReader, TezosNodeWriter, TezosConseilClient, TezosMessageUtils, TezosParameterFormat, KeyStore, Signer, ChainlinkTokenHelper } from 'conseiljs';
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
    state = JSON.parse(fs.readFileSync('state.json').toString());
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
    // TODO
}

async function switchOracle() {
    // TODO
}

async function requestFortune(signer: Signer, keyStore: KeyStore, payment: number, timeout: number = 5, map?: any) {
    let elt: string[] = [];
    if (map !== undefined) {
        Object.keys(map).forEach(key => {
            let val: string | number;
            if (Number.isInteger(map[key])) {
                val = `(Right (Left ${Number(map[key])}))`;
            } else if (map[key].startsWith('0x')) {
                val = `(Left ${map[key]})`;
            } else {
                val = `(Right (Right "${map[key]}"))`;
            }

            elt.push(`Elt "${key}" ${val}`);
        });
    }

    const fee = 300_000;
    const gasLimit = 500_000;
    const storageFee = 3_000;

    const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, 'request_fortune', `(Pair { ${elt.join('; ')} } (Pair ${payment} ${timeout}))`, TezosParameterFormat.Michelson);
    //const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, '', `(Right (Right Unit))`, TezosParameterFormat.Michelson);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);

    console.log(`Injected transaction operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    console.log(JSON.stringify(conseilResult));
}

async function cancelFortune(signer: Signer, keyStore: KeyStore, requestId: number) {
    const fee = 300_000;
    const gasLimit = 500_000;
    const storageFee = 3_000;

    //const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, 'cancel_fortune', 'Unit', TezosParameterFormat.Michelson);
    const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, clientAddress, 0, fee, storageFee, gasLimit, '', '(Left (Left Unit))', TezosParameterFormat.Michelson);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);

    console.log(`Injected transaction operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    console.log(JSON.stringify(conseilResult));
}

async function confirmTokenBalance(address: string, minimum: number) {
    const storage = await ChainlinkTokenHelper.getSimpleStorage(tezosNode, tokenAddress);
    const token = await ChainlinkTokenHelper.getTokenDefinition(tezosNode, storage.metadataMap);
    try {
        const balance = await ChainlinkTokenHelper.getAccountBalance(tezosNode, storage.balanceMap, address);
        if (balance < minimum) { throw new Error('Insufficient token balance'); }
    } catch {
        throw new Error('No balance found');
    }
}

async function run() {
    init();

    const oracleFee = 1;

    const userKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleUserAlice.secretKey);
    const userSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(userKeyStore.secretKey, 'edsk'));

    await confirmTokenBalance(userKeyStore.publicKeyHash, oracleFee);

    const contractState = await getSimpleStorage();
    console.log(`current fortune: "${contractState.fortune}"`);

    //monitor = setInterval(async () => { await checkFortune() }, networkBlockTime * 1000 * 5);

    await requestFortune(userSigner, userKeyStore, oracleFee, 5, {a: 'b', c: 1, d: '0xc0ff33'});
    //await cancelFortune(userSigner, userKeyStore,1);
}

run();
