const http = require("http");
const path = require("path");
const { createServer } = require('http');
const express = require("express");   /* Accessing express module */
const bodyParser = require("body-parser");
const app = express();  /* app is a request handler function */
const querystring = require('querystring');
const portNumber = 5001;
const port = process.env.URL;
const WebSocket = require('ws');
require("dotenv").config({ path: path.resolve(__dirname, 'env_var_folder/.env') })
const CLIENT_ID = process.env.CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET; // Use a secure key for signing JWT
const { exec } = require('child_process');


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

app.post('/calculate-similarity', (req, res) => {
    const { sentence1, sentence2 } = req.body;

    if (!sentence1 || !sentence2) {
        return res.status(400).send({ error: 'Both sentences are required' });
    }

    const command = `python3 judger.py "${sentence1}" "${sentence2}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send({ error: error.message });
        }
        if (stderr) {
            return res.status(500).send({ error: stderr });
        }
        console.log("sim: " + parseFloat(stdout.trim()));
        res.send({ similarity: parseFloat(stdout.trim()) });
    });
});

app.get("/", async (request, response) => {
    
    const variables = {
        clientID: CLIENT_ID
    };
      
    response.render("index", variables);
});
app.get("/songList", (req, res) => {

    const variables = {
    };
    console.log("===========rendering songList")
    res.render('songList', variables);
});

// New endpoint to load more songs
app.get("/loadMoreSongs", async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    let result = [];
    const limit = 15; // Number of songs to load per request
    const offset = parseInt(req.query.offset) || 0; // Offset for pagination

    try {
        await client.connect();
        const cursor = client.db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .find({ approved: true })
            .skip(offset)
            .limit(limit);
        
        result = await cursor.toArray();
        console.log("=====in the result: " + result);
        console.log(`Loaded more: ${result.length} songs`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

    res.json(result);
});

// Function to encode special characters to HTML entities
function encodeForHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&#34;')
              .replace(/'/g, '&#39;')
              .replace(/\//g, '&#x2F;')
              .replace(/`/g, '&#x60;')
              .replace(/=/g, '&#x3D;');
}

app.get('/songList/game/:id/:startTime/:quizStart/:quizEnd/:objID', async (req, res) => {
    const id = req.params.id;
    const startTime = parseFloat(req.params.startTime);
    const quizStart = parseFloat(req.params.quizStart);
    const quizEnd = parseFloat(req.params.quizEnd);
    //const quizEnd = convertTimeToSeconds(req.params.quizEnd);
    console.log("========start time: " + startTime)
    console.log("-=======start time param: " + req.params.startTime)
    const objID = req.params.objID;
    const objId = new ObjectId(objID);

    //find solution in mongodb
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .findOne(
            { _id: objId }
        );
    let solution = result.lyrics;
    solution = encodeForHtml(solution);
    console.log("result in app.get: " + result);
    console.log("solution in app.get: " + solution);
    let portTemp;
    if (port) {
        portTemp = port;
    } else {
        portTemp = `http://localhost:${portNumber}`
    }
    const variables = {
        id: id, 
        startTime: startTime, 
        quizStartTime: quizStart, 
        quizEndTime: quizEnd,
        port: portTemp,
        objID: objID,
        solution: solution,
    };

    res.render('singleGame', variables);
    
});

app.get("/addGame", (request, response) => {
    let portNumber_template = portNumber;
    
    const variables = {
        portNumber: portNumber_template
    };
      /* Generating the HTML using welcome template */

      response.render("addGame", variables);
});

app.post("/addGame", async (request, response) => {
    let {startTime, quizStartTime, quizEndTime, youtubeURL, lyrics, artist, title, thumbnailURL} =  request.body;

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
            youtubeURL: extractYouTubeVideoID(youtubeURL),
            thumbnailURL: thumbnailURL,
            approved: false,
        };
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



app.get("/multResult/:result/:scoreChange", (req, res) => {
    let result = req.params.result;
    const scoreChange = req.params.scoreChange;

    if (result === 'won') {
        result = 'YOU WIN!'
        variable = {
            result: result,
            scoreChange: scoreChange,
        }
        res.render('multResultWon', variable)
    } else if (result === 'lost') {
        result = 'you lose...'
        variable = {
            result: result,
            scoreChange: scoreChange,
        }
        res.render('multResultLost', variable)
    }
    
    
});

app.post("/songList/game/", async (req, res) => {
    console.log("does mult and solo game both use this????");
    let display = "you got it right!";

    variable = {
        result: display,
        portNumber: portNumber
    };

    res.render("result", variable);
});

app.get('/multGame', async (req, res) => {
    let roomNumber = getFirstFalseValue();
    console.log("=========roomNumber")
    if (roomNumber == null) { // there is no available rooms
        console.log("===========no available rooms. making a new room==========");
        //make a new room number
        roomNumber = generateRandomString(8);
        while (roomMap.has(roomNumber)) {
            roomNumber = generateRandomString(8);
        }
        
        //get random song from the db and store its info in roomMap.
        let randSongArray = await getRandomDocument(1);
        let randSong = randSongArray[0];
        console.log("========randSong: " + randSong)
        console.log("======randSong ID: " + randSong._id)
        let pickedSongID = randSong._id.toString();
        let songInfo = {
            startTime: parseFloat(randSong.startTime),
            quizStart: parseFloat(randSong.quizStartTime),
            quizEnd: parseFloat(randSong.quizEndTime),
            youtubeURL: randSong.youtubeURL,
            solution: encodeForHtml(randSong.lyrics),
        }
        
        console.log("============picked ObjID: " + pickedSongID);
        console.log("============adding room: " + roomNumber);
        //roomMap.set(roomNumber, { clients: new Set(), started: false, songID: pickedSongID, startTime: Date.now(), timer: null});
        roomMap.set(roomNumber, { clients: new Set(), started: false, songID: pickedSongID, startTime: Date.now(), timer: null, songInfo: songInfo});
    } else { // there is a available room
        console.log("===========there was an avaible room!==========");
    }
    res.redirect("/multGame/" + roomNumber)
});

app.get('/invalidRoom', (req, res) => {
    const result = 'YOUR ROOM IS INVALID!'
    variable = {
        result: result,
    }
    res.render('invalidRoom', variable);
});

async function getRandomDocument(num) {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        const database = client.db(databaseAndCollection.db); // Replace with your database name
        const collection = database.collection(databaseAndCollection.collection); // Replace with your collection name

        // Use the $sample stage to get a single random document
        const randomDocument = await collection.aggregate([{ $sample: { size: num } }]).toArray();

        if (randomDocument.length > 0) {
            console.log('Random Document:', randomDocument[0]);
            return randomDocument;
        } else {
            console.log('No documents found in the collection.');
            return null;
        }
    } finally {
        await client.close();
    }
}

app.get('/multGame/:room', (req, res) => {
    //CHANGE TO /multgame/:room LATER. CONFUSING FOR BROWSER.
    let room = req.params.room;
    let roomInfo = roomMap.get(room);
    let objID = roomInfo.songID;
    
    const startTime = roomInfo.songInfo.startTime;
    const quizStart = roomInfo.songInfo.quizStart;
    const quizEnd = roomInfo.songInfo.quizEnd;

    let portTemp;
    if (port) {
        portTemp = port;
    } else {
        portTemp = `http://localhost:${portNumber}`
    }

    const variables = {
        id: roomInfo.songInfo.youtubeURL,
        startTime: startTime,
        quizStartTime: quizStart,
        quizEndTime: quizEnd,
        port: portTemp,
        objID: objID,
        solution: roomInfo.songInfo.solution,
        portNumber: portNumber,
    };
    console.log("=============solution in server: " + roomInfo.songInfo.solution)

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

app.get("/ranking", (req, res) => {
    const variables = {
        portNumber: portNumber
    }
    res.render('ranking', variables)
});

app.post("/get-ranking", async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    let users;
    try {
        await client.connect();
        const database = client.db(databaseAndCollectionUser.db); // Replace with your database name
        const collection = database.collection(databaseAndCollectionUser.collection); // Replace with your collection name

        // Find all users and sort them by score in decreasing order
        users = await collection.find().sort({ score: -1 }).toArray();

        console.log('Users sorted by score:', users);
    } finally {
        await client.close();
    }
    if (users) {
        res.json({ users })
    } else {
        res.status(400).json({ error: "user array is falsy" });
    }
});

app.get("/multPrivateGame", (req, res) => {
    const variables = {};
    res.render("multPrivateGame", variables)
});

app.get('/multPrivateGameMakeRoom', async (req, res) => {
    console.log("===========making new private mult game room==========");
    //make a new room number
    roomNumber = generateRandomString(8);
    while (privateRoomMap.has(roomNumber)) {
        roomNumber = generateRandomString(8);
    }
    
    //get random song from the db and store its info in roomMap.
    let randSongArray = await getRandomDocument(1);
    //let pickedSongID = randSong._id.toString();
    let songInfoArray = [];

    randSongArray.forEach(elem => {
        songInfoArray.push({
            startTime: parseFloat(elem.startTime),
            quizStart: parseFloat(elem.quizStartTime),
            quizEnd: parseFloat(elem.quizEndTime),
            youtubeURL: elem.youtubeURL,
            solution: elem.lyrics,
            title: elem.title,
            artist: elem.artist,
        });
    });
    
    //console.log("============picked ObjID: " + pickedSongID);
    console.log("============adding room: " + roomNumber);
    //roomMap.set(roomNumber, { clients: new Set(), started: false, songID: pickedSongID, startTime: Date.now(), timer: null});
    privateRoomMap.set(roomNumber, { clients: new Set(), started: false, startTime: Date.now(), timer: null, songInfoArray: songInfoArray, lobby: null, currPlayer: 1, currRound: 1});
    res.redirect("/multGameLobby/" + roomNumber)
});

app.get('/multGameLobby/:room', (req, res) => {
    //CHANGE TO /multgame/:room LATER. CONFUSING FOR BROWSER.
    let room = req.params.room;
    let roomInfo = privateRoomMap.get(room);
    // let objID = roomInfo.songID;
    
    // const startTime = roomInfo.songInfo.startTime;
    // const quizStart = roomInfo.songInfo.quizStart;
    // const quizEnd = roomInfo.songInfo.quizEnd;
    const variables = {
        // id: roomInfo.songInfo.youtubeURL,
        // startTime: startTime,
        // quizStartTime: quizStart,
        // quizEndTime: quizEnd,
        portNumber: portNumber,
        // objID: objID,
        // solution: roomInfo.songInfo.solution,
        songInfoArray: roomInfo.songInfoArray,
        room: room,
    };
    console.log("===============songname: " + variables.songName);

    // console.log("=============solution in server: " + roomInfo.songInfo.solution)

    res.render('multGameLobby', variables);
});

// New endpoint to load more songs
app.get("/refreshSongs/:numSongs/:room", async (req, res) => {

    const numSongs = parseInt(req.params.numSongs);
    let room = req.params.room;
    console.log("numSong: " + numSongs);
    console.log("room: " + room);
    let songInfoArray = [];
    try {
        console.log("trying....")
        let randSongArray = await getRandomDocument(numSongs);
        console.log("got randsong: " + randSongArray);
        

        randSongArray.forEach(elem => {
            songInfoArray.push({
                startTime: parseFloat(elem.startTime),
                quizStart: parseFloat(elem.quizStartTime),
                quizEnd: parseFloat(elem.quizEndTime),
                youtubeURL: elem.youtubeURL,
                solution: elem.lyrics,
                title: elem.title,
                artist: elem.artist,
            });
        });
        console.log("made songInfoArray: " + songInfoArray);
        updateFieldInPrivateRoomMap(room, "songInfoArray", songInfoArray);
        console.log("value of the map corresponding to the key updated: " + privateRoomMap.get(room));
        console.log("updated field in map.");
    } catch (e) {
        console.error(e);
    }
    console.log("sending things....")
    res.json(songInfoArray);
});

// Function to update a field in an object within the map
function updateFieldInPrivateRoomMap(key, field, newValue) {
    if (privateRoomMap.has(key)) {
        let obj = privateRoomMap.get(key); // Get the object by key
        obj[field] = newValue; // Update the specific field
        console.log("updating room number: " + key);
        console.log("field that is updated: " + field);
        console.log("value for updated field: " + newValue);
        console.log("updated value for key: " + obj.songInfoArray);
        privateRoomMap.set(key, obj); // Update the map with the modified object
    } else {
        console.log(`Key ${key} does not exist in the map.`);
    }
}

app.get('/multPrivateJoinRoom/:room', (req, res) => {
    //CHANGE TO /multgame/:room LATER. CONFUSING FOR BROWSER.
    let room = req.params.room;
    let roomInfo = privateRoomMap.get(room);
    if (roomInfo) {
        console.log("room: " + room);
        console.log("roomInfo: " + roomInfo);
        console.log("songInfoArray: " + roomInfo.songInfoArray);

        const variables = {
            portNumber: portNumber,
            songInfoArray: roomInfo.songInfoArray,
            room: room,
        };

        res.render('multPrivateGamePlay', variables);
    } else {
        res.render('invalidRoom', {result: "Room does not exist"});
    }
    
});

app.get('/multPrivateResult/:result/:winner/:rank', (req, res) => {
    const result = req.params.result;
    const winner = req.params.winner;
    if (result === 'won') {
        const variables = {
            portNumber: portNumber
        }
        res.render('multPrivateResultWon', variables);
    } else if (result === 'lost') {
        const rank = req.params.rank;
        const variables = {
            rank: rank,
            portNumber: portNumber,
            winner: winner,
        }
        res.render('multPrivateResultLost', variables)
    }
});

app.get('/multPrivateGame/podium/:users', (req, res) => {
    let users = req.params.users;
    console.log("========users obj in server.");
    const variables = {
        users: users,
    }
    res.render('podium', variables)
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
const privateRoomMap = new Map();
let num_max_user = 3

// Adding the exclude method to Set prototype
Set.prototype.exclude = function(element) {
    return new Set([...this].filter(el => el !== element));
};

wss.on('connection', (ws, req) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const room = parsedUrl.searchParams.get('room');
    console.log("==============pathname: " + pathname);
    if (pathname === '/single-public') {
        console.log("gooooood!");
        console.log("========url: " + req.url)
        handleSinglePublic(ws, room);
    } else if (pathname === "/mult-private-lobby") {
        handleMultPrivateLobby(ws, room)
    } else if (pathname === '/mult-private-play') {
        handleMultPrivatePlay(ws, room);
    } else {
        ws.close(1000, 'Invalid URL path');
    }
});

function handleSinglePublic(ws, room) {
    // console.log("New WebSocket connection established");
    // console.log("========url: " + req.url)
    // const room = new URLSearchParams(req.url.substring(1)).get('room');
    // if (!roomMap.has(room)) {
    //     roomMap.set(room, new Set());
    // }
    console.log("wss room name: " + room)
    if (!roomMap.has(room) || roomMap.get(room).clients.size > num_max_user || roomMap.get(room).started) {
        // console.log("room does not exists: " + !roomMap.has(room))
        // console.log("room capacity greater than max" + roomMap.get(room).clients.size > num_max_user)
        // console.log("room has started: " + roomMap.get(room).started)
        // console.log("tried to enter a invalid room: does not exist, already started.")
        ws.send(JSON.stringify({ type: 'invalid-room' }));
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
}

function handleMultPrivateLobby(ws, room) {
    if (!privateRoomMap.has(room) || privateRoomMap.get(room).started) {
        ws.send(JSON.stringify({ type: 'invalid-room' }));
        ws.close();
        return;
    }
    const roomData = privateRoomMap.get(room);
    roomData.lobby = ws;  // Add the client to the room's set
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'start') {
            console.log("============start message received.")
            //send start messages to all users in room
            const clients = roomData.clients;
            if (clients) {
                clients.forEach(client => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        console.log("===========start message sent")
                        client.ws.send(JSON.stringify({ type: 'start', message: "start the game!" }));
                    }
                });
            }
            privateRoomMap.get(room).started = true;
        } else if (data.type === 'end') {
            const clients = roomData.clients;
            if (clients) {
                clients.forEach(client => {
                    console.log("===========end message sent from lobby to plays.")
                    client.ws.send(JSON.stringify({type: 'end', winner: data.winner, users: data.users}))
                });
            }
        } else if (data.type === 'update') {
            const clients = roomData.clients;
            if (clients) {
                clients.forEach(client => {
                    console.log("===========update message sent from lobby to plays.")
                    console.log("songIngoArray received by server: " + data.songInfoArray);
                    client.ws.send(JSON.stringify({type: 'update', songInfoArray: data.songInfoArray}));
                });
            }
        }
    });

    ws.on('close', () => {
        const clients = privateRoomMap.get(room).clients;
        if (clients) {
            clients.forEach(client => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    console.log("===========user sent message")
                    client.ws.send(JSON.stringify({ type: 'lobby-exit', message: "lobby disappeared!!!" }));
                }
            });
        }
        
        console.log("========deleting a room: " + room)
        privateRoomMap.delete(room); // Optionally clean up empty room
    });
}

function handleMultPrivatePlay(ws, room) {
    if (!privateRoomMap.has(room) || privateRoomMap.get(room).started) {
        ws.send(JSON.stringify({ type: 'invalid-room' }));
        ws.close();
        return;
    }
    const roomData = privateRoomMap.get(room);
    roomData.clients.add({ws: ws, idx: roomData.currPlayer});  // Add the client to the room's set
    roomData.lobby.send(JSON.stringify({ type: 'new-user', idx: roomData.currPlayer }))
    ws.send(JSON.stringify({ type: 'index', idx: roomData.currPlayer}))
    roomData.currPlayer = roomData.currPlayer + 1;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const clients = privateRoomMap.get(room).clients;
        if (data.type === 'regular') {
            if (clients) {
                clients.forEach(client => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        console.log("===========user sent message")
                        client.ws.send(JSON.stringify({ type: 'regular', message: data.message }));
                    }
                });
            }
        } else if (data.type === 'correct') {
            console.log("=========roomData.currRound: " + roomData.currRound)
            console.log("=========num of rounds: " + roomData.songInfoArray.length)
            if (roomData.currRound < roomData.songInfoArray.length) {
                //continue to next game
                roomData.currRound += 1;
                console.log("continuing to the next round!")
                roomData.lobby.send(JSON.stringify({ type: 'continue', winner: data.winner}))
                if (clients) {
                    clients.forEach(client => {
                        if (client.ws.readyState === WebSocket.OPEN) {
                            console.log("===========sending signals to users so they can update")
                            client.ws.send(JSON.stringify({ type: 'continue', winner: data.winner, currRound: roomData.currRound }));
                        }
                    });
                }
                //SEND CLINETS SIGNALS SO THEY CAN UPDATE TO NEXT SONG!!!!
            } else if (roomData.currRound >= roomData.songInfoArray.length) {
                roomData.lobby.send(JSON.stringify({ type: 'last-winner', winner: data.winner}))
                console.log("need to end game!!")
                //end game. calculate points, and display who is the winner.
            }
        }
    });

    ws.on('close', () => {
        //need to change lobby for user list.
        //close an player.
        // Remove the client from the room on disconnect
        console.log("============ws close detected");
        if (privateRoomMap.get(room) !== undefined) {
            console.log("=========deleting a user in private mult");
            const clients = privateRoomMap.get(room)?.clients;
            const user = findInSet(elem => elem.ws == ws, clients);
            console.log("clients that should have client I'm deleting: " + clients)
            console.log("private mult deleting user information: " + user);
            clients.delete(user); //NOT SURE IF THIS IS RIGHT WAY TO DO IT
            privateRoomMap.get(room)?.lobby.send(JSON.stringify({ type: 'user-left', message: "a user left the room!", idx: user.idx}));
            // if (privateRoomMap.get(room).clients.size === 0) {
            //     console.log("========deleting a room: " + room)
            //     privateRoomMap.delete(room); // Optionally clean up empty room
            // }
        }
    });
}

function findInSet (pred, set) { 
    for (let item of set) if(pred(item)) return item;
}

//======================= google login handling code
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
                image: user.picture
            };
            await insertQuiz(client, databaseAndCollectionUser, found);
            console.log("new user added");
        } else {
            console.log("user already exists!");
        }

        found = await lookUpOneEntry(client, databaseAndCollectionUser, user.sub);
        //find user's ranking
        let rank = await getUserRanking(client, user.sub)
        found.rank = rank;
        console.log("rank in login endpoint" + found.rank)
        // Generate JWT for session management
        const authToken = jwt.sign(found, JWT_SECRET, { expiresIn: '1h' });

        res.json({ authToken, user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/logout', async (req, res) => {
    const token = req.headers['authorization'];
    const objId = req.body.objId;
    
    console.log("============logging out")
    console.log("token in logout endpoint: " + token)
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) return res.sendStatus(403); // Forbidden
        console.log("==============no error verifying jwt")
        const userId = decoded.sub;
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

        console.log("updated successfully")
        
        res.json({ message: 'Logged out successfully' });
    });
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

async function getUserRanking(client, userId) {
    try {
        await client.connect();
        const database = client.db(databaseAndCollectionUser.db);
        const collection = database.collection(databaseAndCollectionUser.collection);

        // Step 1: Fetch the user's score
        const user = await collection.findOne({ sub: userId });
        if (!user) {
            throw new Error('User not found');
        }

        const userScore = user.score;

        // Step 2: Count the number of users with a higher score
        const higherScoreCount = await collection.countDocuments({ score: { $gt: userScore } });

        // User's rank is the number of users with a higher score + 1
        const userRank = higherScoreCount + 1;
        console.log("========user rank: " + userRank);
        return userRank;
    } finally {
        await client.close();
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