const express = require('express');
const session = require('express-session');
const http = require('http');
const { uuid } = require('uuidv4');
const cookieParser = require('cookie-parser');

const app = express();

const sessionSecret = 'Tezos Tacos Nachos';

const sessionStore = new session.MemoryStore({ reapInterval: 60000 * 10 })

app.set('view engine', 'ejs');

app.use(cookieParser());

app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    genid: (req) => uuid(),
    resave: false,
    saveUninitialized: true,
}));

app.use(function(req, res, next) {
    res.locals.sessionId = req.session.id;
    res.locals.sessionAddress = req.session.address;
    res.locals.sessionWords = req.session.words;
    res.locals.sessionPrompt = req.session.prompt;

    next();
});

const getSessionState = async (sid) => {
    return new Promise((resolve, reject) => {
        sessionStore.get(sid, (e, s) => {
            console.log(`session ${s}`)
            if (!e && s) { resolve(s); }
    
            if (e) { console.log(`session not found ${sid} ${JSON.stringify(e)}`); }
            reject()
        });
    });
};

const updateSessionState = (sid, content) => {
    sessionStore.set(sid, content, (e, s) => {
        if (e) { console.log(`could not update session ${sid} ${JSON.stringify(e)}`); }
    });
}

module.exports = { getSessionState, updateSessionState };

var views = require('./services/views');
app.use('/', views.router);

var prompt = require('./services/prompt');
app.use('/', prompt.router);

var validate = require('./services/validate');
app.use('/', validate.router);

var peek = require('./services/peek');
app.use('/', peek.router);

http.createServer(app).listen(8080);
console.log('Server listening on 8080');
