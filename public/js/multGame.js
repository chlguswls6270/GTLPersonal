document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[2];
    console.log("room number game.js: " + room);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/single-public?room=${room}`);
    console.log("====chlguswls");
    const form = document.getElementById('userForm');
    const input = document.getElementById('inputField');
    const messages = document.getElementById('chat-log');

    ws.onmessage = (event) => {
        if (isValidJSON(event.data)) {
            const data = JSON.parse(event.data);
            if (data.type === 'start') {
                console.log("starting the game");
                startGame();
            } else if (data.type === 'end') {
                if (data.message === 'you lost!') {
                    console.log("game ended. redirecting to result page")
                    window.location.href = '/multResult/lost/' + data.score
                } else if (data.message === 'you won!') {
                    console.log("game ended. redirecting to result page")
                    window.location.href = '/multResult/won/' + data.score
                }
                let info = sessionStorage.getItem("userInfo");
                info = JSON.parse(info)
                if (info != null) {
                    updateSessionStorage(data.score);
                    updateScoreMongoDB(data.score);
                }
            } else if (data.type === 'invalid-room') {
                window.location.href = '/invalidRoom';
            }
        } else if (typeof event.data === 'string') {
            const message = document.createElement('div');
            const new_text = document.createTextNode(event.data)
            message.appendChild(new_text);
            messages.appendChild(message)
        } else {
            const blob = event.data;
            blob.text().then(text => {
                const message = document.createElement('div');
                const new_text = document.createTextNode(text)
                message.appendChild(new_text);
                messages.appendChild(message)
            })
        }
    };

    form.onsubmit = async function(event) {
        event.preventDefault();
        let userInput = document.getElementById('inputField').value;
        userInput = encodeForHtml(userInput).toLowerCase();
        console.log("=========correct answer: " + solutionData)
        console.log("=========user answer: " + (userInput))
        let currAnswer = latestAnswer;
        //calculate similarity
        let sim;
        try {
            sim = await calculateSimilarity(userInput, solutionData);
            console.log("sim: " + sim);
        } catch (error) {
            console.log("error when calculating sim")
        }
        console.log("sim: " + sim);
        document.getElementById('sim').textContent = `similarity: ${sim}%`;

        if (userInput) {
            if (userInput === solutionData) {
                console.log("=======user got it right!")
                ws.send(JSON.stringify({ type: 'end', message: "game ended!" }));
            } else {
                ws.send(`${currAnswer} (${sim}%)`);
            }
        }
    };

    async function calculateSimilarity(sentence1, sentence2) {
        try {
            const response = await fetch(`${port}/calculate-similarity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sentence1, sentence2 })
            });
            const data = await response.json();
            if (data.error) {
                console.log("error calculating sim");
                throw new Error(data.error);
            } else {
                let sim = data.similarity.toFixed(2);
                console.log("sim is: " + sim);
                return sim;
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    function startGame() {
        console.log("Game Started!");
        // Update the UI or game state to indicate the game has started
        document.getElementById('gameDidNotStart').style.display = 'none';
        playRequested = true;
        player.playVideo();
        console.log("music played!");
    }

    function isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    function updateSessionStorage(scoreChange) {
        let user = sessionStorage.getItem("userInfo")
        user = JSON.parse(user)
        user.score = user.score + scoreChange;
        console.log("=====info: " + user)
        if (user != null) {
            console.log("a piece of information in info: " + user.name)
        }
        sessionStorage.setItem("userInfo", JSON.stringify(user))
    }

    async function updateScoreMongoDB(scoreChange) {
        let user = sessionStorage.getItem("userInfo");
        user = JSON.parse(user)
        let id = user.obj
        console.log("id in multGame.js: " + id)
        console.log("score in multGame.js: " + scoreChange)
        try {
            const response = await fetch('/update-score', {
                method: 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                },
                body: JSON.stringify({ id: id, scoreChange: scoreChange})
            });
            const data = await response.json();
            if (response.ok) {
                console.log(data.message);
            } else {
                console.error('Error:', data.message);
            }
            
        } catch (error) {
            console.error('Error:', error);
        }
    }

});
