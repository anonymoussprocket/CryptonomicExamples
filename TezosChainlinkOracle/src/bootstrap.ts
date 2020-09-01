import fetch from 'node-fetch';
import * as log from 'loglevel';
import * as fs from 'fs';

import { registerFetch, registerLogger } from 'conseiljs';

import { TezosNodeReader, TezosNodeWriter, TezosConseilClient, TezosMessageUtils, KeyStore, Signer, ChainlinkTokenHelper } from 'conseiljs';
import { KeyStoreUtils, SoftSigner } from 'conseiljs-softsigner';

const logger = log.getLogger('conseiljs');
logger.setLevel('debug', false);
registerLogger(logger);
registerFetch(fetch);

let state: any;
let tezosNode: string;
let conseilServer: any;
let networkBlockTime: number;

function clearRPCOperationGroupHash(hash: string) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}

function init() {
    state = JSON.parse(fs.readFileSync('state.json').toString());
    tezosNode = state.config.tezosNode;
    conseilServer = { url: state.config.conseilURL, apiKey: state.config.conseilApiKey, network: state.config.conseilNetwork };
    networkBlockTime = state.config.networkBlockTime;
}

async function initAccount(faucet: any): Promise<KeyStore> {
    console.log('~~ initAccount');

    const keyStore = await KeyStoreUtils.restoreIdentityFromFundraiser(faucet.mnemonic.join(' '), faucet.email, faucet.password, faucet.pkh);
    console.log(JSON.stringify(keyStore));
    const signer = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(keyStore.secretKey, 'edsk'));

    activateAccount(signer, keyStore, faucet.secret);
    revealAccount(signer, keyStore);

    return keyStore;
}

async function activateAccount(signer: Signer, keyStore: KeyStore, secret: string) {
    console.log(`~~ activateAccount`);
    const accountRecord = await TezosConseilClient.getAccount(conseilServer, conseilServer.network, keyStore.publicKeyHash);
    if (accountRecord !== undefined) { return; }

    const nodeResult = await TezosNodeWriter.sendIdentityActivationOperation(tezosNode, signer, keyStore, secret);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
    console.log(`Injected activation operation with ${groupid}`);

    await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);
}

async function revealAccount(signer: Signer, keyStore: KeyStore) {
    console.log(`~~ revealAccount`);
    if (await TezosNodeReader.isManagerKeyRevealedForAccount(tezosNode, keyStore.publicKeyHash)) { return; }

    const nodeResult = await TezosNodeWriter.sendKeyRevealOperation(tezosNode, signer, keyStore);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
    console.log(`Injected reveal operation with ${groupid}`);

    await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
}

async function deployTokenContract(signer: Signer, keyStore: KeyStore, activate: boolean, fee: number, timeout: number, adminAddress: string, tokenAddress: string): Promise<string> {
    console.log('~~ deployTokenContract');

    /*
    {
  "prim": "Pair",
  "args": [
    { "prim": "Pair", "args": [ { "string": "${adminAddress}" }, { "prim": "Pair", "args": [ { "int": "0" }, [] ] } ] },
    { "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "prim": "Unit" }, [] ] }, { "prim": "Pair", "args": [ { "prim": "False" }, [] ] } ] }
  ]
}
    */

    const storage = `{ "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "string": "${adminAddress}" }, { "prim": "Pair", "args": [ { "int": "0" }, [] ] } ] }, { "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "prim": "Unit" }, [] ] }, { "prim": "Pair", "args": [ { "prim": "False" }, [] ] } ] } ] }`;
    const contract = fs.readFileSync('contracts/token.micheline').toString();

    const {gas, storageCost} = await TezosNodeWriter.testContractDeployOperation(tezosNode, 'main', keyStore, 0, undefined, 500_000, 20_000, 800_000, contract, storage);

    const nodeResult = await TezosNodeWriter.sendContractOriginationOperation(tezosNode, signer, keyStore, 0, undefined, 400_000, storageCost + 300, gas + 3000, contract, storage);
    const groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);

    console.log(`Injected origination operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    // mint

    // fund accounts, oracleUserAlice, oracleUserRobert, oracleUserZach

    return conseilResult.originated_contracts;
}

async function deployOracleContract(signer: Signer, keyStore: KeyStore, activate: boolean, fee: number, timeout: number, adminAddress: string, tokenAddress: string): Promise<string> {
    console.log('~~ deployOracleContract');

    const storage = `{ "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "prim": ${activate ? '"True"' : '"False"'} }, { "string": "${adminAddress}" } ] }, { "prim": "Pair", "args": [ { "int": "${fee}" }, { "int": "${timeout}" } ] } ] }, { "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "int": "0" }, [] ] }, { "prim": "Pair", "args": [ [], { "string": "${tokenAddress}" } ] } ] } ] }`;
    const contract = fs.readFileSync('contracts/oracle.micheline').toString();

    const {gas, storageCost} = await TezosNodeWriter.testContractDeployOperation(tezosNode, 'main', keyStore, 0, undefined, 100_000, 10_000, 800_000, contract, storage);

    const nodeResult = await TezosNodeWriter.sendContractOriginationOperation(tezosNode, signer, keyStore, 0, undefined, 150_000, storageCost + 300, gas + 3000, contract, storage);
    const groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);

    console.log(`Injected origination operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    return conseilResult.originated_contracts;
}

async function deployFortuneSeekerContract(signer: Signer, keyStore: KeyStore, adminAddress: string, oracleAddress: string, tokenAddress: string): Promise<string> {
    console.log('~~ deployOracleContract');

    const storage = `{ "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "string": "${adminAddress}" }, { "prim": "Pair", "args": [ { "string": "" }, { "bytes": "0001" } ] } ] }, { "prim": "Pair", "args": [ { "prim": "Pair", "args": [ { "int": "1" }, { "string": "${oracleAddress}" } ] }, { "prim": "Pair", "args": [ { "string": "${tokenAddress}" }, { "prim": "None" } ] } ] } ] }`;
    const contract = fs.readFileSync('contracts/fortune_seeker.micheline').toString();

    const {gas, storageCost} = await TezosNodeWriter.testContractDeployOperation(tezosNode, 'main', keyStore, 0, undefined, 100_000, 10_000, 800_000, contract, storage);

    const nodeResult = await TezosNodeWriter.sendContractOriginationOperation(tezosNode, signer, keyStore, 0, undefined, 150_000, storageCost + 300, gas + 3000, contract, storage);
    const groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);

    console.log(`Injected origination operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);

    return conseilResult.originated_contracts;
}

async function seedTokens(amount: number) {
    const keyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleUserZach.secretKey);
    const signer = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(keyStore.secretKey, 'edsk'));


    let transfers: any[] = [];
    transfers.push({ address: state.oracleAdmin.pkh, tokenid: 0, balance: amount });
    transfers.push({ address: state.oracleUserAlice.pkh, tokenid: 0, balance: amount });
    transfers.push({ address: state.oracleAddress, tokenid: 0, balance: amount });
    transfers.push({ address: state.clientAddress, tokenid: 0, balance: amount });

    const groupid = await ChainlinkTokenHelper.transfer(tezosNode, state.tokenAddress, signer, keyStore, 300_000, keyStore.publicKeyHash, transfers);
    console.log(`Injected transaction operation with ${groupid}`);
    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 7, networkBlockTime);
    console.log(JSON.stringify(conseilResult, null, 4));
}

async function run() {
    init();

    let changed = false;

    if (!state.oracleAdmin.secretKey || state.oracleAdmin.secretKey.length === 0) {
        const ks = await initAccount(state.oracleAdmin);
        state.oracleAdmin.secretKey = ks.secretKey;
        changed = true;
    }

    if (!state.oracleUserAlice.secretKey || state.oracleUserAlice.secretKey.length === 0) {
        const ks = await initAccount(state.oracleUserAlice);
        state.oracleUserAlice.secretKey = ks.secretKey;
        changed = true;
    }

    if (!state.tokenAddress) {
        const adminKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleAdmin.secretKey);
        const adminSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(adminKeyStore.secretKey, 'edsk'));

        const tokenAddress = await deployTokenContract(adminSigner, adminKeyStore, true, 0, 5, adminKeyStore.publicKeyHash, state.tokenAddress);

        state.tokenAddress = tokenAddress;
        changed = true;
    }

    if (!state.oracleAddress) {
        const adminKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleAdmin.secretKey);
        const adminSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(adminKeyStore.secretKey, 'edsk'));

        const oracleAddress = await deployOracleContract(adminSigner, adminKeyStore, true, 0, 5, adminKeyStore.publicKeyHash, state.tokenAddress);
        state.oracleAddress = oracleAddress;
        changed = true;
    }

    if (!state.clientAddress) {
        const clientKeyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(state.oracleUserZach.secretKey);
        const clientSigner = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(clientKeyStore.secretKey, 'edsk'));

        const clientAddress = await deployFortuneSeekerContract(clientSigner, clientKeyStore, clientKeyStore.publicKeyHash, state.oracleAddress, state.tokenAddress);
        state.clientAddress = clientAddress;
        changed = true;
    }

    if (changed) { fs.writeFileSync('state.json', JSON.stringify(state, null, 4)); }

    await seedTokens(1000);
}

run();
