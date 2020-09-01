# Chainlink oracles for Tezos with ConseilJS & SmartPy

**Mike Radin** ([@anonymoussprocket](https://github.com/anonymoussprocket), [@dsintermediatd](https://twitter.com/dsintermediatd))

**2020/Aug/31**

Earlier this year [Smart Chain Arena](https://medium.com/@SmartPy_io/bringing-chainlink-oracles-to-the-tezos-ecosystem-ed47dfc631bd) teamed up with [Cryptonomic](https://medium.com/the-cryptonomic-aperiodical/bringing-secure-chainlink-oracles-to-tezos-8b7b917e5c18) to deliver the developer tools and documentation necessary to [enable the use of Chainlink](https://twitter.com/SmartPy_io/status/1268881690824507392) on the Tezos platform. This effort has now produced artifacts with which we can demonstrate the future of this functionality.

This tutorial assumes you have some familiarity with SmartPy, the leading smart-contract development and simulation product for Tezos, with [ConseilJS](https://github.com/Cryptonomic/ConseilJS) as well as Typescript.

## System Design

There is a rich [example of an oracle](https://smartpy.io/dev/index.html?template=oracle.py) available in the SmartPy web-based IDE, we will modify it to serve [fortune cookie fortunes](https://joshmadison.com/2008/04/20/fortune-cookie-fortunes/) to smart contracts seeking to understand their future.

This system, at the moment, consists of three contracts and several human participants. There is a token contract to represent [$LINK](https://coinmarketcap.com/currencies/chainlink/) on Tezos, an oracle contract and a client contract that would be interacting with the oracle to get get fortunes in this case.

Different accounts would be managing these contracts, so that's at least two implicit accounts to get from the [Tezos faucet](http://faucet.tzalpha.net) for the testnet. We're assuming re-use of the [token contract](https://carthage.tzkt.io/KT1TQR3eyYCytqBK9EB28J1taa2cX41F9R8x/entrypoints). There is a faucet available for it. One account would be used to deploy the oracle contract and another to deploy the client contract. Technically speaking the client contract has two parts that can be deployed separately – the requestor and the recipient. For simplicity, in this tutorial it's a single contract.

### The Token

The Tezos ecosystem is highly collaborative. The current implementation of the Chainlink token on Tezos is based on [TZIP12](https://gitlab.com/tzip/tzip/-/blob/master/proposals/tzip-12/tzip-12.md), a token interface proposal being actively evolved by the community. For this purpose the [reference implementation](http://smartpy.io/dev/index.html?template=FA2.py) of the contract was modified to include an entry point: `proxy`. This call allows the oracle to get paid for its services.

### The Oracle

We made some small changes to the sample oracle contract to improve error messages and clear the request storage, but otherwise the contract is consistent with the original design and interfaces. This is important. While we expect data providers to deploy their own oracles, we also expect those contracts to be compatible and standardized. The contract today accepts requests from clients that can optionally include complex parameters and it responds to clients with the requested data.

This data would come from some external source that the oracle admin is responsible for in this tutorial we'll build an application that will monitor requests in the oracle contract storage and will respond accordingly.

### The Fortune Seeker

We made several changes to the default client. First, instead of serving the XTZ-USD rate, it serves fortune cookie fortunes. Various entry points and argument names changed to replace "xtzusd" with "fortune". Additionally, `request_fortune` now accepts a token amount to pay for the request and a timeout parameter.

### Compatibility & Upcoming Changes

It's critical to understand the type safety constraints of the Tezos platform. The oracle implementation allows for `int`, `byte` and `string` payloads, even if your use-case does not require such flexibility, you must leave it in place to allow the token contract to interact with it.

The current state of the contracts is fairly close to what may get tested for mainnet deployment. One outstanding feature is to replace the single implicit account token manager with a multi-sig smart-contract. This work is ongoing and is unlikely to change the way client contracts interact with the oracle and the token. Another thing under consideration is the ability to deploy a single oracle contract that would allow multiple data providers to proxy their responses through it.

## Implementation Overview

The code for this tutorial is on [Github](https://github.com/anonymoussprocket/CryptonomicExamples/tree/master/TezosChainlinkOracle). The code is written in Typescript with the exception of the [smart contracts](https://github.com/anonymoussprocket/CryptonomicExamples/tree/master/TezosChainlinkOracle/contracts/oracle.py), it's been tested with the following: node 12.18.3 LTS, npm 6.14.6. Pre-generated contracts are included in Micheline format.

### Configuration

System configuration is in [state.json](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/state.json). We will need a faucet accounts for `oracleAdmin` and `oracleUserAlice`. These accounts will be activated and revealed if needed in the bootstrap step. The first account will be used to deploy the oracle contract and respond to client requests, the second to deploy the client and query it. `tokenAddress` is the common token contract, you are free to deploy your own however and the code for it is included. `oracleAddress` and `clientAddress` will be populated during bootstrapping, `oracleData` is a few fortunes that will be served to clients. To make all of this work, we'll be using Tezos infrastructure provided by [Nautilus Cloud](https://nautilus.cloud/) rather than deploying instances of the [Conseil indexer](http://github.com/cryptonomic/Conseil) service and a new Tezos node. The top three elements of the `config` section will be populated with the data you'll see on the landing page of Nautilus Cloud.

From here, run `npm i` which will also execute `npm run build`. These steps will get the necessary dependencies and transpile Typescript into JavaScript.

### Bootstrap

`npm run bootstrap`

Before we can demonstrate the operation of the system, we need to initialize all the participants. This running this command will activate and reveal the `oracleAdmin` and `oracleUserAlice` accounts if needed. It will also deploy a token contract if one is missing, for this example we'll be using [KT1TQR3eyYCytqBK9EB28J1taa2cX41F9R8x](https://arronax.io/tezos/carthagenet/accounts/KT1TQR3eyYCytqBK9EB28J1taa2cX41F9R8x). Three other steps in this process are to deploy an oracle and a client contract. All the contract code is taken from the pre-generated Micheline output of the SmartPy IDE, based on oracle.py code. The final step is to seed some testnet tokens into the related accounts, this assumes that at least one of your accounts has tokens to share.

To see how these contracts work in concert before deployment, load [oracle.py](https://raw.githubusercontent.com/anonymoussprocket/CryptonomicExamples/master/TezosChainlinkOracle/contracts/oracle.py) into the SmartPy IDE and hit ▶️! On the right pane you'll see contract and test output.

The code that is executed by this command is contained in [bootstrap.ts](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts):

1. [Activate & reveal accounts](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts#L31)
1. [Deploy token contract](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts#L67)
1. [Deploy oracle contract](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts#L98)
1. [Deploy client contract](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts#L115)
1. [Seed tokens](https://github.com/anonymoussprocket/CryptonomicExamples/blob/master/TezosChainlinkOracle/src/bootstrap.ts#L132)

As mentioned previously, step two is skipped in the default configuration, to enable it, remove `tokenAddress` from state.json. You will need to change `deployOracleContract` for anything except this example unless you're only serving string data from your oracle and you do not accept extended parameters. You will also need to change `seedTokens` to give it account credentials for an account with a token balance.

### Client

`npm run client`

The client has several methods, it's able to read and parse current state, including the current fortune. I can request a new fortune from the oracle and it can cancel a pending request. There are two ways to get current state, one is to query a Tezos node directly, another is to query the Conseil indexer. In the process of writing this tutorial we deployed a client at `KT1MDitu7MUNtaZmfGvHr7MXzhtgTp6jnXuY`, you can see it the Michelson representation of the [storage on Arronax](https://arronax.io/tezos/carthagenet/accounts/query/eyJmaWVsZHMiOlsiYWNjb3VudF9pZCIsInN0b3JhZ2UiXSwicHJlZGljYXRlcyI6W3siZmllbGQiOiJhY2NvdW50X2lkIiwib3BlcmF0aW9uIjoiZXEiLCJzZXQiOlsiS1QxTURpdHU3TVVOdGFabWZHdkhyN01Yemh0Z1RwNmpuWHVZIl0sImludmVyc2UiOmZhbHNlfV0sIm9yZGVyQnkiOlt7ImZpZWxkIjoiYWNjb3VudF9pZCIsImRpcmVjdGlvbiI6ImRlc2MifV0sImFnZ3JlZ2F0aW9uIjpbXSwibGltaXQiOjEwMDB9). If you look inside `getSimpleStorage` you'll see how we parse this storage into an object.

Getting data from the oracle is demonstrated int `requestFortune` and it calls the similarly named `request_fortune` entry point. A few things to note here. The call to this function requires a payment and a timeout. The payment is denominated in tokens, *not* XTZ, that means that the caller of the contract must have the balance to perform this operation. Also, this payment must at least the minimum required by the oracle, more on this in the next section. The second parameter, timeout, is the minimum amount of time you're willing to wait for this request to be fulfilled. This period must be at least the minimum set by the oracle contract. At the end of this period the client will be able to cancel the request.

That brings us to `cancelFortune`. The client contract keeps track of state internally, this is why calls have few external arguments. The address of the oracle, the current request id and current fortune. Using this information the client know what to send to the oracle to revoke the request.

There is another important part of this contract that we didn't show a wrapper for and that's `receive_fortune`. This is the entry point that the oracle contract will call when completing the request for data. In the contract code, inside `request_fortune`, you'll see this entry point hard-wired into the oracle request.

### Oracle

`npm run oracle`

The oracle wrapper handles the lifecycle of the oracle contract, it can query the contract storage to determine if there are requests to process and if so, process them. In this case the oracle wrapper will serve a random fortune from the list in state.json. To do this it will need access to request data, there is a more complex schema for this contract because it can manage multiple client requests at once. First we'll need to `getSimpleStorage` to identify where the request data is stored. In this case it's the `map` parameter of `OracleStorage`. There is also a `lookup` map, but that is used by the contract internally. Using the map index we can then query the big_map data for a specific key. This key is a monotonically increasing index, so we can just probe for that data using `checkForRequest`. In our example the oracle services only one kind of request, if we served multiple types of data, say fortunes and token price predictions, we would differentiate between the two with the `jobId` argument. This means the client needs to send the correct job id as well. There is also a way to provide additional paramters into this request using the associated map. As you can see request processing actually happens off-chain. Once the oracle compiles a response it will send it to the requesting client using the `fulfill_request` entry point. There are two parameters here, request id and the response data. Note the request id here is not the client request id, it's the oracle request id. Data for us is just a string. If you need to send complex data, you can encode it as binary. There are various options available. This data can be `PACK`ed if the response must be parsed by the receiving smart contract or it can be any other encoding if it will be processed off-chain.

## References & support

This tutorial is meant to work out of the box. If this is not your experience please get in touch with us at Cryptonomic on the Riot (Element) [developer channel](https://matrix.to/#/!rUwpbdwWhWgKINPyOD:cryptonomic.tech?via=cryptonomic.tech&via=matrix.org&via=tzchat.org), or with the guys behind SmartPy in their [Telegram room](https://t.me/SmartPy_io).

- [Smart Contract Development Syllabus](https://medium.com/the-cryptonomic-aperiodical/smart-contract-development-syllabus-f285a8463a4d) for Tezos.
- [SmartPy Reference Manual](https://smartpy.io/dev/reference.html)
- [ConseilJS documentation](https://cryptonomic.github.io/ConseilJS/#/)
- [Nautilus Cloud](https://nautilus.cloud/) – turnkey Tezos infrastructure.
- [JSONPath](http://jsonpath.com) and [jsonpath-plus](https://www.npmjs.com/package/jsonpath-plus) for parsing contract storage.

## Acknowledgments

- [SmartPy](https://twitter.com/smartpy_io)
- [Cryptonomic](https://twitter.com/cryptonomictech)
