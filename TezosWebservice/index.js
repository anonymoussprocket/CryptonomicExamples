const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const conseiljs = require('conseiljs');
const fetch = require('node-fetch');
const log = require('loglevel');

const app = express();
const router = express.Router();

const NautilusCloudTezosNode = ''; // get values for these variables at https://nautilus.cloud
const NautilusCloudConseilNode = '';
const NautilusCloudConseilKey = '';

router.get('/', async (req, res) => {
    const block = await conseiljs.TezosNodeReader.getBlockHead(NautilusCloudTezosNode);
    console.log(JSON.stringify(block));

    const ConseilServer = { url: NautilusCloudConseilNode, apiKey: NautilusCloudConseilKey, network: 'mainnet' };
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(query, 'block_level', 'amount', 'fee');
    query = conseiljs.ConseilQueryBuilder.addPredicate(query, 'block_hash', conseiljs.ConseilOperator.EQ, [block['hash']]);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'amount', conseiljs.ConseilFunction.sum);
    query = conseiljs.ConseilQueryBuilder.addAggregationFunction(query, 'fee', conseiljs.ConseilFunction.sum);

    const result = await conseiljs.ConseilDataClient.executeEntityQuery(ConseilServer, 'tezos', ConseilServer.network, 'operations', query);
    console.log(JSON.stringify(result))

    const data = {
        hash: block['hash'],
        baker: block['metadata']['baker'],
        timestamp: block['header']['timestamp'],
        level: result[0]['block_level'],
        totalAmount: result[0]['sum_amount'],
        totalFee: result[0]['sum_fee']
    };

    res.json(data);
});

app.use('/', router);

async function init() {
    if (NautilusCloudTezosNode.length === 0) { console.log('Tezos node URL is empty'); process.exit(1); }
    if (!(await pokeTezosNode(NautilusCloudTezosNode))) { console.log('Tezos node unreachable'); process.exit(1); }

    const logger = log.getLogger('conseiljs');
    logger.setLevel('debug', false);
    conseiljs.registerLogger(logger);
    conseiljs.registerFetch(fetch);

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    http.createServer(app).listen(3080);
    console.log('conseiljs-express-sample listening on http:3080');
}

async function pokeTezosNode(url) {
    const p = new Promise((resolve, reject) => {
        fetch(url).then(resolve, reject);
        setTimeout(reject, 2_000, new Error("No response in 2s"));
    });

    let r = false;
    await p.then(response => r = true).catch(reason => r = false);

    return r;
}

init();
