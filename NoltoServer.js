const http = require("http");
const path = require("path");
const express = require("express");   /* Accessing express module */
const bodyParser = require("body-parser");
const app = express();  /* app is a request handler function */
const axios = require('axios');
const querystring = require('querystring');
const portNumber = 5001;
/* Module for file reading */
const fs = require("fs");
const { WebSocketServer } = require("ws")

const wss = new WebSocketServer({ port: 8002 })

process.stdin.setEncoding("utf8");

app.use(bodyParser.urlencoded({extended:false}));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

require("dotenv").config({ path: path.resolve(__dirname, 'mongodb_folder/.env') })
const uri = process.env.MONGO_CONNECTION_STRING;

const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(bodyParser.urlencoded({extended:false}));

// Serve static files from the 'public' directory
app.use(express.static('public'));

//array of all songs. need to optimize later
let songArray = [];

app.get("/", (request, response) => {
    const variables = {
    };
      
    response.render("index", variables);
});

app.get("/songList", async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    songArray = [];
    let result = [];
    try {
        await client.connect();
        let filter = {};
        const cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        
        result = await cursor.toArray();
        console.log(`Found: ${result.length} movies`);
        console.log(result);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    result.forEach(elem => {
        songArray.push(elem);
    });
    const variables = {
        songArray: songArray
    };

    res.render('songList', variables);
});

app.get("/multSongList", async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    songArray = [];
    let result = [];
    try {
        await client.connect();
        let filter = {};
        const cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        
        result = await cursor.toArray();
        console.log(`Found: ${result.length} movies`);
        console.log(result);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    result.forEach(elem => {
        songArray.push(elem);
    });
    const variables = {
        songArray: songArray
    };

    res.render('multSongList', variables);
});

app.get("/addGame", (request, response) => {
    let portNumber_template = portNumber;
    
    const variables = {
        portNumber: portNumber_template
    };
      /* Generating the HTML using welcome template */

      response.render("addGameV2", variables);
});

app.post("/addGame", async (request, response) => {
    let {startTime, quizStartTime, quizEndTime, youtubeURL, lyrics, artist, title} =  request.body;

    //Sending info to mongo db
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        /* Inserting  */
        let quiz = {
            startTime: startTime,
            quizStartTime: quizStartTime,
            quizEndTime: quizEndTime,
            lyrics: lyrics,
            artist: artist,
            title: title,
            youtubeURL: extractYouTubeVideoID(youtubeURL),};
        await insertQuiz(client, databaseAndCollection, quiz);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    //displaying confirm page
    let time = new Date().toString();
    const variables = {
            startTime: startTime,
            quizStartTime: quizStartTime,
            quizEndTime: quizEndTime,
            youtubeURL: youtubeURL,
            lyrics: lyrics,
            time: time,
            artist: artist,
            title: title,
            portNumber: portNumber
        };
    response.render("confirm", variables);
});

app.get('/songList/game/:id/:startTime/:quizStart/:quizEnd/:objID', (req, res) => {
    const id = req.params.id;
    const startTime = convertTimeToSeconds(req.params.startTime);
    const quizStart = convertTimeToSeconds(req.params.quizStart);
    const quizEnd = convertTimeToSeconds(req.params.quizEnd);
    const objID = req.params.objID;

    let song = songArray.find(elem => {
        return elem._id.toString() === objID
    });
    let solution = song.lyrics

    const variables = {
        id: id, 
        startTime: startTime, 
        quizStartTime: quizStart, 
        quizEndTime: quizEnd,
        portNumber: portNumber,
        objID: objID,
        solution: solution,
    };

    res.render('game', variables);
    
});

app.get('/multSongList/multGame/:id/:startTime/:quizStart/:quizEnd/:objID', (req, res) => {
    const id = req.params.id;
    const startTime = convertTimeToSeconds(req.params.startTime);
    const quizStart = convertTimeToSeconds(req.params.quizStart);
    const quizEnd = convertTimeToSeconds(req.params.quizEnd);
    const objID = req.params.objID;

    let song = songArray.find(elem => {
        return elem._id.toString() === objID
    });
    let solution = song.lyrics

    const variables = {
        id: id, 
        startTime: startTime, 
        quizStartTime: quizStart, 
        quizEndTime: quizEnd,
        portNumber: portNumber,
        objID: objID,
        solution: solution,
    };

    res.render('multGame', variables);
    
});

app.post("/songList/game/", (req, res) => {
    let { userAttempt, objID } = req.body;
    let song = songArray.find(elem => {
        return elem._id.toString() === objID
    });
    let result = "";

    console.log("answer: " + song.lyrics);
    console.log("user:   " + userAttempt + "////");
    
    if (song.lyrics === userAttempt) {
        result = "you got it right!"
    } else {
        result = "you are wrong!"
    }

    variable = {
        result: result,
        portNumber: portNumber
    };

    res.render("result", variable);
});

function extractYouTubeVideoID(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|.+\?v=)([^\&\?\/]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function convertTimeToSeconds(time) {
    const [minutes, seconds] = time.split(':').map(Number);
    return (minutes * 60) + seconds;
}

// =======================

app.listen(portNumber);
process.stdout.write(`Web server started and running at http://localhost:${portNumber}\n`);

//======================= MondgoDB code
async function insertQuiz(client, databaseAndCollection, newQuiz) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newQuiz);
}

//======================= Websocket code

// broadcast 메소드 추가
wss.broadcast = (message) => {
    wss.clients.forEach((client) => {
      client.send(message);
    });
};

wss.on("connection", (ws, request) => {
ws.on("message", (data) => {
    wss.broadcast(data.toString());
});

ws.on("close", () => {
    wss.broadcast(`유저 한명이 떠났습니다. 현재 유저 ${wss.clients.size} 명`);
});

wss.broadcast(
    `새로운 유저가 접속했습니다. 현재 유저 ${wss.clients.size} 명`
);

console.log(`새로운 유저 접속: ${request.socket.remoteAddress}`)
})