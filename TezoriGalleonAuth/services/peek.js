const express = require('express');

const router = express.Router();

router.get('/peek', (req, res) => {
    req.session.reload((err) => { console.log(`reload error ${err} in peek service`); });

    if (req.session.status === 'pending') {
        res.sendStatus(200);
        return;
    }

    if (req.session.status === 'success') {
        res.redirect('/succeed.html');
        return;
    }

    if (req.session.status === 'failure') {
        res.redirect('/fail.html');
        return;
    }
});

module.exports = { router: router };
