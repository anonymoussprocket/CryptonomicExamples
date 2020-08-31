import fetch from 'node-fetch';
import * as log from 'loglevel';
import * as fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

import { registerFetch, registerLogger } from 'conseiljs';

import { TezosNodeReader, TezosNodeWriter, TezosConseilClient, TezosMessageUtils, KeyStore, Signer, TezosParameterFormat } from 'conseiljs';
import { KeyStoreUtils, SoftSigner } from 'conseiljs-softsigner';

const logger = log.getLogger('conseiljs');
logger.setLevel('debug', false);
registerLogger(logger);
registerFetch(fetch);

interface OracleStorage {
    active: boolean;
    administrator: string;
    fee: number;
    timeout: number;
    counter: number;
    map: number;
    lookup: number;
    token: string;
}

interface OracleRequest {
    amount: number;
    client: string;
    requestId: number;
    jobId: string;
    params: any;
    target: string;
    timestamp: Date;
}

let state: any;
let tezosNode: string;
let conseilServer: any;
let networkBlockTime: number;
let oracleAddress: string;

let pendingCheck = false;
let monitor: any;
let mapId: number;
let currentRequestId: number;

function clearRPCOperationGroupHash(hash: string) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}

function init() {
    state = JSON.parse(fs.readFileSync('state.json').toString());
    tezosNode = state.config.tezosNode;
    conseilServer = { url: state.config.conseilURL, apiKey: state.config.conseilApiKey, network: state.config.conseilNetwork };
    networkBlockTime = state.config.networkBlockTime;
    oracleAddress = state.oracleAddress;
}

async function getSimpleStorage(): Promise<OracleStorage> {
    const storageResult = await TezosNodeReader.getContractStorage(tezosNode, oracleAddress);

    return {
        active: (JSONPath({ path: '$.args[0].args[0].args[0].prim', json: storageResult })[0]).toString().toLowerCase().startsWith('t'),
        administrator: JSONPath({ path: '$.args[0].args[0].args[1].string', json: storageResult })[0],
        fee: Number(JSONPath({ path: '$.args[0].args[1].args[0].int', json: storageResult })[0]),
        timeout: Number(JSONPath({ path: '$.args[0].args[1].args[1].int', json: storageResult })[0]),
        counter: Number(JSONPath({ path: '$.args[1].args[0].args[0].int', json: storageResult })[0]),
        map: Number(JSONPath({ path: '$.args[1].args[0].args[1].int', json: storageResult })[0]),
        lookup: Number(JSONPath({ path: '$.args[1].args[1].args[0].int', json: storageResult })[0]),
        token: JSONPath({ path: '$.args[1].args[1].args[1].string', json: storageResult })[0]
    };
}

async function checkForRequest(signer: Signer, keyStore: KeyStore, ) {
    if (pendingCheck) { return; }

    pendingCheck = true;
    try {
        const packedKey = TezosMessageUtils.encodeBigMapKey(Buffer.from(TezosMessageUtils.writePackedData(currentRequestId, 'nat'), 'hex'));
        const mapResult = await TezosNodeReader.getValueForBigMapKey(tezosNode, mapId, packedKey);

        // TODO: example with Conseil

        const request = {
            amount: Number(JSONPath({ path: '$.args[0].args[0].int', json: mapResult })[0]),
            client: JSONPath({ path: '$.args[0].args[1].args[0].string', json: mapResult })[0],
            requestId: Number(JSONPath({ path: '$.args[0].args[1].args[1].int', json: mapResult })[0]),
            jobId: JSONPath({ path: '$.args[1].args[0].args[0].bytes', json: mapResult })[0],
            params: {}, // $.args[1].args[0].args[1]
            target: JSONPath({ path: '$.args[1].args[1].args[0].string', json: mapResult })[0],
            timestamp: new Date(JSONPath({ path: '$.args[1].args[1].args[1].string', json: mapResult })[0])
        };

        processRequest(signer, keyStore, request);

        currentRequestId += 1;
    } catch (err) {
        console.log(`error in checkForRequest, ${JSON.stringify(err)}`);
        console.trace(err);
    } finally {
        pendingCheck = false;
    }
}

async function processRequest(signer: Signer, keyStore: KeyStore, request: OracleRequest) {
    const fee = 300_000;
    const gasLimit = 500_000;
    const storageFee = 3_000;

    const fortune = state.oracleData[Math.floor(Math.random() * state.oracleData.length - 1)];
    const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, signer, keyStore, state.oracleAddress, 0, fee, storageFee, gasLimit, 'fulfill_request', `(Pair ${request.requestId} (Right (Right "${fortune}")))`, TezosParameterFormat.Michelson);

    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);

    console.log(`Injected transaction operation with ${groupid}`);
    await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 10, networkBlockTime);
}

async function run() {
    init();

    const adminKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleAdmin.secretKey);
    const adminSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(adminKeyStore.secretKey, 'edsk'));

    const oracleStorage = await getSimpleStorage();
    mapId = oracleStorage.map;
    currentRequestId = oracleStorage.counter - 1;

    await checkForRequest(adminSigner, adminKeyStore);

    //monitor = setInterval(async () => { await checkForRequest() }, networkBlockTime * 1000);
}

run();
