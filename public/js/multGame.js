document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[2];
    console.log("room number game.js: " + room);
    const ws = new WebSocket(`ws://${location.host}?room=${room}`);
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

                let user = sessionStorage.getItem("userInfo")
                user = JSON.parse(user)
                user.score = user.score + data.score;
                console.log("=====info: " + user)
                if (user != null) {
                    console.log("a piece of information in info: " + user.name)
                }
                sessionStorage.setItem("userInfo", JSON.stringify(user))
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

    form.onsubmit = event => {
        event.preventDefault();
        if (input.value) {
            if (input.value === solutionData) {
                console.log("=======user got it right!")
                ws.send(JSON.stringify({ type: 'end', message: "game ended!" }));
            } else {
                ws.send(input.value);
            }
        }
    };

    function startGame() {
        console.log("Game Started!");
        // Update the UI or game state to indicate the game has started
        document.getElementById('gameDidNotStart').style.display = 'none';
        playRequested = true;
        player.playVideo();
        
    }

    function isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

});
