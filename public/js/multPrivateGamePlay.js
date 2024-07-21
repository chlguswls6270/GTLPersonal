document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[2];
    console.log("room number game.js: " + room);
    const ws = new WebSocket(`ws://${location.host}/mult-private-play?room=${room}`);
    console.log("====chlguswls");
    const form = document.getElementById('userForm');
    const input = document.getElementById('inputField');
    const messages = document.getElementById('chat-log');
    let index = -1;
    let maxRound = songInfoArray.length;
    console.log("maxRound: " + maxRound);
    console.log(songInfoArray);
    ws.onmessage = (event) => {
        if (isValidJSON(event.data)) {
            const data = JSON.parse(event.data);
            if (data.type === 'start') {
                console.log("starting the game");
                startGame();
            } else if (data.type === 'regular') {
                const message = document.createElement('div');
                const new_text = document.createTextNode(data.message);
                message.appendChild(new_text);
                messages.appendChild(message);
            } else if (data.type === 'lobby-exit') {
                //logic for ending the game
                const message = document.createElement('div');
                const new_text = document.createTextNode('lobby disappeared!!');
                message.appendChild(new_text);
                messages.appendChild(message);
            } else if (data.type === 'index') {
                index = data.idx
                const message = document.createElement('div');
                const new_text = document.createTextNode(`I'm ${index}P!!`);
                message.appendChild(new_text);
                messages.appendChild(message);
            } else if(data.type === 'continue') {
                document.getElementById('formContainer').style.display = 'none';
                document.getElementById('inputField').value = '';

                if (player && player.pauseVideo) {
                    player.pauseVideo();
                }
                console.log("continuing to next round")
                console.log("startTime before: " + startTime)
                const new_round = data.currRound; 
                startTime = songInfoArray[new_round - 1].startTime;
                quizStartTime = songInfoArray[new_round - 1].quizStart;
                quizEndTime =songInfoArray[new_round - 1].quizEnd;
                quizStarted = false;
                quizSubmitted = false;
                playRequested = false;

                solutionData = songInfoArray[new_round - 1].solution;

                // Check if a player instance already exists
                if (player && player.destroy) {
                    player.destroy();
                }
                //continue to next game
                player = new YT.Player('player', {
                    height: '390',
                    width: '640',
                    videoId: songInfoArray[new_round - 1].youtubeURL,
                    playerVars: {
                        'controls': 0,
                        'rel': 0,
                        'showinfo': 0,
                        'modestbranding': 1,
                        'start': Math.floor(startTime),
                        'cc_load_policy': 0,
                        'cc_lang_pref': '',
                    },
                    events: {
                        'onReady': onPlayerReady,
                        'onStateChange': onPlayerStateChange
                    }
                });
                console.log("startTime after: " + startTime)
                console.log("should be updated!")
                // Ensure the video plays after the player is ready
                player.addEventListener('onReady', function(event) {
                    event.target.playVideo();
                });
            } else if (data.type === 'end') {
                const message = document.createElement('div');
                const rank = getUserRank(data.users, index)
                const new_text = document.createTextNode(`lobby said game ended!! winner is ${data.winner}. my place is ${rank}`);
                message.appendChild(new_text);
                messages.appendChild(message);

                //redirect to the next game.
                if (rank == 1) {
                    window.location.href = `/multPrivateResult/won/${index}/${rank}`
                } else {
                    window.location.href = `/multPrivateResult/lost/${data.winner}/${rank}`
                }
            }
        }
    };

    form.onsubmit = event => {
        event.preventDefault();
        if (input.value) {
            if (input.value === solutionData) { //game not ended yet. need to continue to next round.
                console.log("=======user got it right!")
                ws.send(JSON.stringify({ type: 'correct', winner: index }));
            } else {
                ws.send(JSON.stringify({ type: 'regular', message: input.value }));
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

    function getUserRank(usersArray, userName) {
        // Sort the array based on the values in descending order
        usersArray.sort((a, b) => b[1] - a[1]);
    
        // Find the position of the given user
        const rank = usersArray.findIndex(user => user[0] === userName) + 1;
    
        return rank;
    }

});
