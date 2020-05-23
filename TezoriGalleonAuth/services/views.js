const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('./index', { 'active': 'index' });
});

router.get('/:page.html', (req, res) => {
    const pages = ['prompt', 'fail', 'succeed'];

    if (pages.indexOf(req.params.page) >= 0) {
        res.render(`./${req.params.page}`, { 'active': req.params.page });
    } else {
        res.sendStatus(500);
    }
});

module.exports = { router: router };
