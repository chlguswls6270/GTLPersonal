const http = require("http");
const path = require("path");
const { createServer } = require('http');
const express = require("express");   /* Accessing express module */
const bodyParser = require("body-parser");
const app = express();  /* app is a request handler function */
const axios = require('axios');
const querystring = require('querystring');
const portNumber = 5001;
const WebSocket = require('ws');
require("dotenv").config({ path: path.resolve(__dirname, 'env_var_folder/.env') })
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET; // Use a secure key for signing JWT

const server = createServer(app);

const wss = new WebSocket.Server({ server });

process.stdin.setEncoding("utf8");

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json())
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

const uri = process.env.MONGO_CONNECTION_STRING;

const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        clientID: CLIENT_ID
    };
      
    response.render("index", variables);
});

app.get("/songList", async (req, res) => {
    const variables = {
        songArray: songArray
    };
    console.log("===========rendering songList")
    console.log("======" + songArray)
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
    const startTime = parseFloat(req.params.startTime);
    const quizStart = parseFloat(req.params.quizStart);
    const quizEnd = parseFloat(req.params.quizEnd);
    //const quizEnd = convertTimeToSeconds(req.params.quizEnd);
    console.log("========start time: " + startTime)
    console.log("-=======start time param: " + req.params.startTime)
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

app.get("/multResult/:result/:scoreChange", (req, res) => {
    let result = req.params.result;
    const scoreChange = req.params.scoreChange;

    if (result === 'won') {
        result = 'you won!'
    } else if (result === 'lost') {
        result = 'you lost!'
    }
    variable = {
        result: result,
        scoreChange: scoreChange,
        portNumber: portNumber,
    }
    res.render('multResult', variable)
});

app.post("/songList/game/", (req, res) => {
    console.log("is mult and solo game both use this????")
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
    console.log("=========roomNumber")
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
        console.log("============adding room: " + roomNumber);
        roomMap.set(roomNumber, { clients: new Set(), started: false, songID: pickedSongID, startTime: Date.now(), timer: null});
    } else { // there is a available room
        console.log("===========there was an avaible room!==========");
    }
    res.redirect("/multGame/" + roomNumber)
});

app.get('/multGame/:room', (req, res) => {
    //CHANGE TO /multgame/:room LATER. CONFUSING FOR BROWSER.
    let room = req.params.room;
    let roomInfo = roomMap.get(room);
    let objID = roomInfo.songID;
    let song = songArray.find(elem => {
        return elem._id.toString() === objID
    });
    const startTime =   parseFloat(song.startTime);
    const quizStart = parseFloat(song.quizStartTime);
    const quizEnd = parseFloat(song.quizEndTime);
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

app.post("/update-score", async (req, res) => {
    console.log("I'm in update-score endpoint!=====1")
    console.log("just trying printing req.body" + req.body)
    const { id, scoreChange } = req.body;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    console.log("I'm in update-score endpoint!=====2");
    console.log("score value in end point: " + scoreChange);
    console.log("id value in end point: " + id);

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ObjectId' });
    }

    try {
        await updateScore(client, databaseAndCollectionUser, id, scoreChange)
        console.log("I'm in update-score endpoint!=====3")
        res.send({ message: 'Score updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});




// =======================

server.listen(portNumber, () => console.log(`Server listening on http://localhost:${portNumber}`));

//======================= MondgoDB code
async function insertQuiz(client, databaseAndCollection, newQuiz) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newQuiz);
}

async function updateScore(client, databaseAndCollection, objID, score) {
    console.log("I'm in updateScore function!====1")
    let filter = { _id : new ObjectId(objID)}; //might be not the correct way to access objID.
    console.log("I'm in updateScore function!====2")
    console.log("score value is: " + score)
    let update = { $inc: {score: score } }; //inc might not exist
    console.log("I'm in updateScore function!====3")

    const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .updateOne(filter, update);
    console.log("I'm in updateScore function!====4")

    console.log(`Documents modified: ${result.modifiedCount}`);
}

//======================= Websocket Server code
const roomMap = new Map();
let num_max_user = 3

// Adding the exclude method to Set prototype
Set.prototype.exclude = function(element) {
    return new Set([...this].filter(el => el !== element));
};

wss.on('connection', (ws, req) => {
    console.log("New WebSocket connection established");
    console.log("========url: " + req.url)
    const room = new URLSearchParams(req.url.substring(1)).get('room');
    // if (!roomMap.has(room)) {
    //     roomMap.set(room, new Set());
    // }
    console.log("wss room name: " + room)
    if (!roomMap.has(room) || roomMap.get(room).clients.size > num_max_user || roomMap.get(room).started) {
        console.log("room does not exists: " + !roomMap.has(room))
        console.log("room capacity greater than max" + roomMap.get(room).clients.size > num_max_user)
        console.log("room has started: " + oomMap.get(room).started)
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
                    lostClients = clients.exclude(ws)
                    console.log("num of lost clients: " + lostClients.size)
                    lostClients.forEach(async client => {
                        if (client.readyState === WebSocket.OPEN) {
                            console.log("===========sending lost messge to ws's")
                            client.send(JSON.stringify({ type: 'end', message: "you lost!", score: -1 }));
                        }
                    });
                    //calculate how many scores should be sent
                    let currRoomNum = roomMap.get(room).clients.size;
                    console.log("========currRoomNum: " + currRoomNum)
                    ws.send(JSON.stringify({type: 'end', message: 'you won!', score: currRoomNum - 1}));
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
            console.log("=========deleting a user");
            roomMap.get(room)?.clients.delete(ws);
            if (roomMap.get(room).clients.size === 0) {
                console.log("========deleting a room: " + room)
                roomMap.delete(room); // Optionally clean up empty room
            }
        }
    });
});

//======================= google login handling code
console.log("Client id: " + CLIENT_ID + ", JWT screst: " + JWT_SECRET)

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);
const jwt = require('jsonwebtoken');

const databaseAndCollectionUser = {db: process.env.MONGO_DB_NAME, collection: "users"};


async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload;
}

app.use(express.json());


app.post('/api/auth/google', async (req, res) => {
    const token = req.body.token;
    try {
        //console.log("token gotten from the page is: " + token)
        const user = await verify(token);
        
        //check if user exists in database
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
        let found = await lookUpOneEntry(client, databaseAndCollectionUser, user.sub);
        console.log("===========2===========")
        
        if (!found) {
            console.log("new user found! adding to the mongodb!");
            found = {
                sub: user.sub,
                name: user.name,
                score: 0,
                image: user.picture,
            };
            await insertQuiz(client, databaseAndCollectionUser, found);
            console.log("new user added");
        } else {
            console.log("user already exists!");
        }

        found = await lookUpOneEntry(client, databaseAndCollectionUser, user.sub);
        
        // Generate JWT for session management
        const authToken = jwt.sign(found, JWT_SECRET, { expiresIn: '1h' });

        res.json({ authToken, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function lookUpOneEntry(client, databaseAndCollection, userSub) {
    let filter = {sub: userSub};
    try {
        //console.log("what is the collections? " + databaseAndCollection.collection)
        const result = await client.db(databaseAndCollection.db)
                            .collection(databaseAndCollection.collection)
                            .findOne(filter);
        //console.log("result of mogodb search is: " +result)
        if (result) {
            console.log('User found:', result);
            return result;
        } else {
            console.log('No user was found');
            return result;
        }
    } catch (error) {
        console.error('Error looking up entry:', error);
        return false;
    }
}

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