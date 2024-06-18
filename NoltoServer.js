const http = require("http");
const path = require("path");
const { createServer } = require('http');
const express = require("express");   /* Accessing express module */
const bodyParser = require("body-parser");
const app = express();  /* app is a request handler function */
const axios = require('axios');
const querystring = require('querystring');
const portNumber = 5001;
/* Module for file reading */
const fs = require("fs");
const WebSocket = require('ws');

const server = createServer(app);

const wss = new WebSocket.Server({ server });

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

app.get("/", async (request, response) => {
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
        console.log(`Found: ${result.length} songs`);
        //console.log(result);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    result.forEach(elem => {
        songArray.push(elem);
    });
    const variables = {
    };
      
    response.render("index", variables);
});

app.get("/songList", async (req, res) => {
    const variables = {
        songArray: songArray
    };

    res.render('songList', variables);
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

app.get("/multResult/:result", (req, res) => {
    let result = req.params.result;

    if (result === 'won') {
        result = 'you won!'
    } else if (result === 'lost') {
        result = 'you lost!'
    }
    variable = {
        result: result,
        portNumber: portNumber,
    }
    res.render('multResult', variable)
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

app.get('/multGame', (req, res) => {
    let roomNumber = getFirstFalseValue();
    if (roomNumber == null) { // there is no available rooms
        console.log("===========no available rooms. making a new room==========");
        //make a new room number
        roomNumber = generateRandomString(8);
        while (roomMap.has(roomNumber)) {
            roomNumber = generateRandomString(8);
        }
        //pick a game and attatch it to the roomName
        let pickedSongID = getRandomElement(songArray)._id.toString();
        console.log("============length of songArray: " + songArray.length);
        console.log("============picked ObjID: " + pickedSongID);
        roomMap.set(roomNumber, { clients: new Set(), started: false, songID: pickedSongID, startTime: Date.now(), timer: null});
    } else { // there is a available room
        console.log("===========there was an avaible room!==========");
    }
    res.redirect("/" + roomNumber)
});

app.get('/:room', (req, res) => {
    let room = req.params.room;
    let roomInfo = roomMap.get(room);
    let objID = roomInfo.songID;
    let song = songArray.find(elem => {
        return elem._id.toString() === objID
    });
    const startTime = convertTimeToSeconds(song.startTime);
    const quizStart = convertTimeToSeconds(song.quizStartTime);
    const quizEnd = convertTimeToSeconds(song.quizEndTime);
    // console.log("============objID: " + objID);
    // console.log("============song found: " + song);
    // console.log("============youtubeURL: " + song.youtubeURL);
    const variables = {
        id: song.youtubeURL,
        startTime: startTime,
        quizStartTime: quizStart,
        quizEndTime: quizEnd,
        portNumber: portNumber,
        objID: objID,
        solution: song.lyrics,
    };

    res.render('multGame', variables);
});

// =======================

server.listen(portNumber, () => console.log(`Server listening on http://localhost:${portNumber}`));

//======================= MondgoDB code
async function insertQuiz(client, databaseAndCollection, newQuiz) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newQuiz);
}

//======================= Websocket Server code
const roomMap = new Map();
let num_max_user = 3
wss.on('connection', (ws, req) => {
    console.log("New WebSocket connection established");
    const room = new URLSearchParams(req.url.substring(1)).get('room');
    // if (!roomMap.has(room)) {
    //     roomMap.set(room, new Set());
    // }

    if (!roomMap.has(room) || roomMap.get(room).clients.size > num_max_user || roomMap.get(room).started) {
        console.log("tried to enter a invalid room: does not exist, already started.")
        ws.close();
        return;
    }

    const roomData = roomMap.get(room);
    roomData.clients.add(ws);  // Add the client to the room's set
    console.log("room name: " + room)
    console.log("number of clients: " + roomData.clients.size)

    ws.on('message', (message) => {
        console.log("====is it end message?" + isValidJSON(message))
        if (isValidJSON(message)) {
            const data = JSON.parse(message);
            if (data.type === 'end') {
                const clients = roomMap.get(room).clients;
                if (clients) {
                    clients.delete(ws);
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            console.log("===========game ended")
                            client.send(JSON.stringify({ type: 'end', message: "you lost!" }));
                        }
                    });
                    ws.send(JSON.stringify({type: 'end', message: 'you won!'}))
                }
            }
        } else {
            // Retrieve all clients in the room and send them the message
            const clients = roomMap.get(room).clients;
            if (clients) {
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        console.log("===========user sent message")
                        client.send(message);
                    }
                });
            }
        }
    });

    if (roomData.clients.size >= 2) {
        const timeElapsed = Date.now() - roomData.startTime;
        if (timeElapsed >= 10000 || roomData.clients.size >= num_max_user) {
            if (roomData.timer) {
                clearTimeout(roomData.timer);
            }
            setTimeout(() => {
                    console.log("========max reached")
                    startGame(room);
            }, 100);
            
        } else {
            if (roomData.timer) {
                clearTimeout(roomData.timer);
            }
            roomData.timer = setTimeout(() => {
                if (roomData.clients.size >= 2) {
                    console.log("========20s passed")
                    startGame(room);
                }
            }, 20000 - timeElapsed);
        }
    }

    ws.on('close', () => {
        // Remove the client from the room on disconnect
        if (roomMap.get(room) !== undefined) {
            roomMap.get(room)?.clients.delete(ws);
            if (roomMap.get(room).clients.size === 0) {
                console.log("========deleting a room: " + room)
                roomMap.delete(room); // Optionally clean up empty room
            }
        }
    });
});



//======================= helper function
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Function to get the first value with false boolean field
function getFirstFalseValue() {
    for (let [key, value] of roomMap) {
      if (!value.started) {
        return key;
      }
    }
    return null; // or undefined, if no such value is found
}

function extractYouTubeVideoID(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|.+\?v=)([^\&\?\/]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function convertTimeToSeconds(time) {
    const [minutes, seconds] = time.split(':').map(Number);
    return (minutes * 60) + seconds;
}

function getRandomElement(arr) {
    // Generate a random index based on the array length
    const randomIndex = Math.floor(Math.random() * arr.length);
    // Return the element at the random index
    return arr[randomIndex];
}

function startGame(room) {
    const roomData = roomMap.get(room);
    if (roomData) {
        roomData.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                console.log("client is ready");
                client.send(JSON.stringify({ type: 'start' }));
            } else {
                console.log("there was a client not ready");
            }
        });
        if (roomData.timer) {
            clearTimeout(roomData.timer);
        }
        roomData.started = true;
    }
}

function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}