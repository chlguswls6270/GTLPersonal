const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const port = 3000;

const clientId = 'f1430daab3214a46883250bbee4e6102';
const clientSecret = '66ae267b84d3420597eaa48a9be0506a';
const redirectUri = 'http://localhost:3000/callback';

const scopes = [
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing'
];

// Step 1: Redirect to Spotify's authorization page
app.get('/login', (req, res) => {
    const authorizeUrl = `https://accounts.spotify.com/authorize?` +
        querystring.stringify({
            response_type: 'code',
            client_id: clientId,
            scope: scopes.join(' '),
            redirect_uri: redirectUri
        });
    res.redirect(authorizeUrl);
});

// Step 2: Handle the callback from Spotify
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const tokenUrl = 'https://accounts.spotify.com/api/token';

    const authOptions = {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    const data = querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    });

    try {
        const response = await axios.post(tokenUrl, data, authOptions);
        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;

        // Store the access token and refresh token
        app.locals.accessToken = accessToken;
        app.locals.refreshToken = refreshToken;

        res.send('Successfully authenticated. You can now control playback. Use /play, /pause, or /resume.');
    } catch (error) {
        console.error(error);
        res.send('Error getting access token');
    }
});

// Refresh the access token
async function refreshAccessToken() {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const refreshToken = app.locals.refreshToken;

    const authOptions = {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    const data = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    try {
        const response = await axios.post(tokenUrl, data, authOptions);
        const accessToken = response.data.access_token;
        app.locals.accessToken = accessToken;
    } catch (error) {
        console.error('Error refreshing access token', error);
    }
}

// Middleware to ensure the access token is refreshed
app.use(async (req, res, next) => {
    if (!app.locals.accessToken) {
        res.send('You need to login first: <a href="/login">Login</a>');
    } else {
        await refreshAccessToken();
        next();
    }
});

// Step 3: Control Playback
app.get('/play', async (req, res) => {
    try {
        await axios.put('https://api.spotify.com/v1/me/player/play', {}, {
            headers: {
                'Authorization': `Bearer ${app.locals.accessToken}`
            }
        });
        res.send('Playback started');
    } catch (error) {
        console.error(error);
        res.send('Error starting playback');
    }
});

app.get('/pause', async (req, res) => {
    try {
        await axios.put('https://api.spotify.com/v1/me/player/pause', {}, {
            headers: {
                'Authorization': `Bearer ${app.locals.accessToken}`
            }
        });
        res.send('Playback paused');
    } catch (error) {
        console.error(error);
        res.send('Error pausing playback');
    }
});

app.get('/resume', async (req, res) => {
    try {
        await axios.put('https://api.spotify.com/v1/me/player/play', {}, {
            headers: {
                'Authorization': `Bearer ${app.locals.accessToken}`
            }
        });
        res.send('Playback resumed');
    } catch (error) {
        console.error(error);
        res.send('Error resuming playback');
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
