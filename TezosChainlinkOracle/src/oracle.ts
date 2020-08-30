import fetch from 'node-fetch';
import * as log from 'loglevel';
import * as fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

import { registerFetch, registerLogger } from 'conseiljs';

import { TezosNodeReader, TezosNodeWriter, TezosConseilClient, TezosMessageUtils, KeyStore, Signer } from 'conseiljs';
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

let state: any;
let tezosNode: string;
let conseilServer: any;
let networkBlockTime: number;
let oracleAddress: string;

let pendingCheck = false;
let monitor: any;
let mapId: number;
let nextRequestId: number;

function clearRPCOperationGroupHash(hash: string) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}

function init() {
    state = JSON.parse(fs.readFileSync('../state.json').toString());
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

async function checkForRequest() {
    if (pendingCheck) { return; }

    pendingCheck = true;
    try {
        const packedKey = TezosMessageUtils.encodeBigMapKey(Buffer.from(TezosMessageUtils.writePackedData(nextRequestId, 'net'), 'hex'));
        const mapResult = await TezosNodeReader.getValueForBigMapKey(tezosNode, mapId, packedKey);

        console.log(JSON.stringify(mapResult));

        // TODO: example with Conseil

        //JSONPath({ path: '$.args[1][*].args', json: mapResult }).forEach(v => allowances[v[0]['string']] = Number(v[1]['int']));

        processRequest();

        nextRequestId += 1;
    } catch (err) {
        console.log(`error in checkForRequest, ${JSON.stringify(err)}`);
        console.trace(err);
    } finally {
        pendingCheck = false;
    }
}

async function processRequest() {
    //state.oracleData
}

async function run() {
    init();

    const adminKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleAdmin.secretKey);
    const adminSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(adminKeyStore.secretKey, 'edsk'));

    const oracleStorage = await getSimpleStorage();
    mapId = oracleStorage.map;
    nextRequestId = oracleStorage.counter;

    monitor = setInterval(async () => { await checkForRequest() }, networkBlockTime * 1000);
}

run();
