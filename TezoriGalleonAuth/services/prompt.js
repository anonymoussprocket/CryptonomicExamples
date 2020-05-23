const express = require('express');
const base64url = require('base64url');
const bip39 = require('bip39');

const router = express.Router();

router.get('/prompt', (req, res) => {
    if (req.session.status === 'success') {
        res.redirect('/succeed.html');
        return;
    }

    if (req.session.status === 'failure') {
        res.redirect('/fail.html');
        return;
    }

    if (req.session.status === 'pending') {
        res.redirect('/prompt.html');
    }

    const mnemonic = bip39.generateMnemonic().split(' ');
    let words = [];
    for (let i = 0; i < 3; i++){
        words.push(mnemonic[Math.floor(Math.random() * 10) % mnemonic.length]);
    }

    req.session.words = words.join(' ');
    req.session.address = req.param('address');

    const prompt = {
        requestor: "Most Awesome dApp",
        desc: "The best and only dApp on Tezos",
        requrl: "http://localhost:8080/",
        prompt: req.session.words,
        callback: `http://localhost:8080/validate?sid=${req.session.id}`,
        target: req.param('address')
    }

    req.session.prompt = base64url(JSON.stringify(prompt));
    req.session.status = 'pending';

    res.redirect('/prompt.html');
});

module.exports = { router: router };
