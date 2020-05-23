
const express = require('express');
const router = express.Router();

const conseiljs = require('conseiljs');
const conseiljsSigner = require('conseiljs-softsigner');
const base64url = require('base64url');
const fetch = require('node-fetch');
const log = require('loglevel');

const logger = log.getLogger('conseiljs');
logger.setLevel('debug', false);
conseiljs.registerLogger(logger);
conseiljs.registerFetch(fetch);

const top = require('../index');

router.get('/validate', async (req, res) => {
    let stateSession = await top.getSessionState(req.query.sid);

    if (stateSession) {
        const sig = base64url.decode(req.param('sig'));

        const v = await conseiljsSigner.KeyStoreUtils.checkTextSignature(sig, stateSession.words, await getPublicKey(stateSession.address));

        if (v) {
            stateSession.status = 'success';
            res.sendStatus(200);
        } else {
            stateSession.status = 'failure';
            res.sendStatus(401);
        }

        top.updateSessionState(req.query.sid, stateSession);
    } else {
        // not found
    }
});

module.exports = { router: router };

async function getPublicKey(address) {
    const serverInfo = { url: 'https://conseil-dev.cryptonomic-infra.tech', apiKey: 'galleon', network: 'carthagenet' };

    let publicKeyQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    publicKeyQuery = conseiljs.ConseilQueryBuilder.addFields(publicKeyQuery, 'public_key');
    publicKeyQuery = conseiljs.ConseilQueryBuilder.addPredicate(publicKeyQuery, 'kind', conseiljs.ConseilOperator.EQ, ['reveal'], false);
    publicKeyQuery = conseiljs.ConseilQueryBuilder.addPredicate(publicKeyQuery, 'status', conseiljs.ConseilOperator.EQ, ['applied'], false);
    publicKeyQuery = conseiljs.ConseilQueryBuilder.addPredicate(publicKeyQuery, 'source', conseiljs.ConseilOperator.EQ, [address], false);
    publicKeyQuery = conseiljs.ConseilQueryBuilder.setLimit(publicKeyQuery, 1);

    try {
        return (await conseiljs.ConseilDataClient.executeEntityQuery(serverInfo, 'tezos', 'carthagenet', 'operations', publicKeyQuery))[0].public_key;
    } catch (e) {
        console.log(e);
        throw Error('Public key not revealed on chain.');
    }
}