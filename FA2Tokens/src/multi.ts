import fetch from 'node-fetch';
import * as log from 'loglevel';

import { registerFetch, registerLogger } from 'conseiljs';

import { MultiAssetTokenHelper, TezosConseilClient, KeyStore, Signer, TezosMessageUtils } from 'conseiljs';
import { KeyStoreUtils, SoftSigner } from 'conseiljs-softsigner';

const logger = log.getLogger('conseiljs');
logger.setLevel('debug', false);
registerLogger(logger);
registerFetch(fetch);

const tezosNode = '...'; // get access to Tezos infra at https://nautilus.cloud
const conseilServer = { url: '...', apiKey: '...', network: 'carthagenet' }; // get access to Tezos infra at https://nautilus.cloud
const networkBlockTime = 30 + 1;
const confirmWaitBlocks = 7;

let keyStore: KeyStore;
let signer: Signer;
let contractAddress = '';

async function loadAccount(): Promise<KeyStore> {
    keyStore = await KeyStoreUtils.restoreIdentityFromSecretKey('edskRvuZssMGV9ntq6jHeuMuboai1s1Aot2uYp6tR6r4zZexZxXb5wya5yfH5TgU3ATrSyZzZwmHsEvNAXUqX5u5pFcvENcAg2');
    console.log(`public key: ${keyStore.publicKey}`);
    console.log(`secret key: ${keyStore.secretKey}`);
    console.log(`account hash: ${keyStore.publicKeyHash}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

    signer = await SoftSigner.createSigner(TezosMessageUtils.writeKeyWithHint(keyStore.secretKey, 'edsk'), 0);

    return keyStore;
}

async function run() {
    await loadAccount();

    let groupid = '';
    let conseilResult: any;

    groupid = await MultiAssetTokenHelper.deployContract(tezosNode, signer, keyStore, 900_000, keyStore.publicKeyHash, 'Simple Token 2-0', 'FA2M0', 0, 6);
    console.log(`Injected deployment operation with ${groupid}`);

    await MultiAssetTokenHelper.verifyDestination(tezosNode, contractAddress);
    const storage = await MultiAssetTokenHelper.getSimpleStorage(tezosNode, contractAddress);
    await MultiAssetTokenHelper.getTokenDefinition(tezosNode, storage.metadataMap);

    groupid = await MultiAssetTokenHelper.activate(tezosNode, contractAddress, signer, keyStore, 500_000);
    console.log(`Injected activation operation with ${groupid}`);

    conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, confirmWaitBlocks, networkBlockTime);
    console.log(JSON.stringify(conseilResult));
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

    groupid = await MultiAssetTokenHelper.mint(tezosNode, contractAddress, signer, keyStore, 500_000, keyStore.publicKeyHash, 1_000_000, "FA2M0", 0)
    console.log(`Injected mint operation with ${groupid}`);

    conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, confirmWaitBlocks, networkBlockTime);
    console.log(JSON.stringify(conseilResult));
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

    const balance = await MultiAssetTokenHelper.getAccountBalance(tezosNode, storage.balanceMap, keyStore.publicKeyHash, 0);
    console.log(balance);

    groupid = await MultiAssetTokenHelper.transfer(tezosNode, contractAddress, signer, keyStore, 500_000, keyStore.publicKeyHash, [{ address: 'tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5', tokenid: 0, balance: 1 }, { address: 'tz1gz9SDEvBwqZeVaEHcYubAKNu7TLX7Atch', tokenid: 0, balance: 2 }]);
    console.log(`Injected transfer operation with ${groupid}`);

    conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, confirmWaitBlocks, networkBlockTime);
    console.log(JSON.stringify(conseilResult));
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
}

run();
