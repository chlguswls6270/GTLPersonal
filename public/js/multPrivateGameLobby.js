document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[2];
    console.log("room number game.js: " + room);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/mult-private-lobby?room=${room}`);
    console.log("====chlguswls");
    // const form = document.getElementById('userForm');
    // const input = document.getElementById('inputField');
    // const messages = document.getElementById('chat-log');
    const usersDiv = document.getElementById('users');
    const resultTable = document.getElementById('resultTable');
    let users = new Map();
    ws.onmessage = (event) => {
        //display user when new user is detected.
        const data = JSON.parse(event.data);
        if (data.type === 'new-user') {
            console.log("new user's id: " + data.idx);
            users.set(data.idx, 0);
            // // Create a new row
            // const newRow = userTable.insertRow();
            
            // // Insert new cells into the new row
            // const cell1 = newRow.insertCell(0);
            // const cell2 = newRow.insertCell(1);
            const newUser = document.createElement('div');
            newUser.textContent = `${data.idx}P`
            usersDiv.appendChild(newUser)
            updateTable(users, resultTable);
        
            // // Add text to the new cells
            // cell1.textContent = `${data.idx}P`;
            // cell2.textContent = 0;
        } else if (data.type === 'user-left') {
            users.delete(data.idx);
            console.log("user left message received!");
            
            // const row = userTable.rows[data.idx];
            // // Loop through each cell in the row and update its content
            // for (let i = 0; i < row.cells.length; i++) {
            //     row.cells[i].textContent = "user left";
            // }
        } else if (data.type === 'continue') {
            console.log("I'm in lobby.js trying to continue to next round");
            users.set(data.winner, users.get(data.winner) + 1);
            
            // const row = userTable.rows[data.winner];
            // const cell = row.cells[1];
            // cell.textContent = users.get(data.winner);

            updateTable(users, resultTable);

        } else if (data.type === 'last-winner') {
            console.log("I'm in lobby.js last round finished")
            users.set(data.winner, users.get(data.winner) + 1)

            const winner = getKeysWithGreatestValue(users);

            //need to send signal so users redirect to other page.
            ws.send(JSON.stringify({ type: 'end', winner: winner, users: Array.from(users.entries()) }));
            
            updateTable(users, resultTable);

            //redirect to podium.
            window.location.href = '/multPrivateGame/podium/' + btoa(JSON.stringify(getRankedUsers(users)));
        } else if (data.type === 'invalid-room') {
            window.location.href = '/invalidRoom';
        }
    };

    document.getElementById('start').addEventListener('click', function() {
        console.log("sending start signal from lobby!")
        document.getElementById("song-buttons").style.display = 'none';
        document.getElementById("users").style.display = 'none';
        document.getElementById("result-table").style.display = 'flex';
        document.getElementById("start-game").style.display = 'none';
        ws.send(JSON.stringify({ type: 'start', message: "start the game!" }));// Change this URL to the desired page
    });
    //send start mesage to wss when host press start button

    document.getElementById('refreshSong').addEventListener('click', async () => {
        const refreshSongButton= document.getElementById('refreshSong');
        refreshSongButton.disabled = true;
        refreshSongButton.textContent = "Loading...";
        console.log("room: " + room);
        const numSongs = document.getElementById('numSong').value;
        console.log("numSongs: " + numSongs);

        try {
            const response = await fetch(`/refreshSongs/${numSongs}/${room}`);
            const songInfoArray = await response.json();

            if (songInfoArray.length === 0) {
                alert("Something went wrong");
                return;
            }
            const songList = document.getElementById('song-list');
            songList.innerHTML = '';
            songInfoArray.forEach(songInfo => {
                const songTitleDiv = document.createElement('div');
                songTitleDiv.id = 'songTitles';
                
                const songTitleStrong = document.createElement('strong');
                songTitleStrong.textContent = songInfo.title;
                
                songTitleDiv.appendChild(songTitleStrong);
                
                const artistStrong = document.createElement('strong');
                artistStrong.textContent = songInfo.artist;
                
                const lineBreak = document.createElement('br');
                
                songTitleDiv.appendChild(songTitleStrong);
                songTitleDiv.appendChild(lineBreak);
                songTitleDiv.appendChild(artistStrong);
                songList.appendChild(songTitleDiv);
            });

            ws.send(JSON.stringify({ type: 'update', songInfoArray: JSON.stringify(songInfoArray) }));

            refreshSongButton.textContent = 'refresh'; // Change the button text back
            refreshSongButton.disabled = false; // Re-enable the button
        } catch (error) {
            console.error('Error loading more songs:', error);
        }
    });

    function getKeyWithGreatestValue(users) {
        // Convert the object to an array of key-value pairs
        const entries = Array.from(users.entries())
        console.log(entries);
        let maxKey = null;
        let maxValue = -Infinity;
    
        // Iterate through the array of key-value pairs
        for (const [key, value] of entries) {
            if (value > maxValue) {
                maxValue = value;
                maxKey = key;
            }
        }
    
        return maxKey;
    }

    function getKeysWithGreatestValue(users) {
        // Convert the object to an array of key-value pairs
        const entries = Array.from(users.entries());
        console.log(entries);
        
        let maxValue = -Infinity;
        let keysWithMaxValue = [];
    
        // Iterate through the array of key-value pairs
        for (const [key, value] of entries) {
            if (value > maxValue) {
                // Found a new maximum value, reset the array
                maxValue = value;
                keysWithMaxValue = [key];
            } else if (value === maxValue) {
                // Found another key with the same maximum value, add to the array
                keysWithMaxValue.push(key);
            }
        }
    
        return keysWithMaxValue;
    }

    function getRankedUsers(map) {
        // Convert the map to an array of key-value pairs
        const usersArray = Array.from(map.entries());
        
        // Sort the array based on the values in descending order
        usersArray.sort((a, b) => b[1] - a[1]);
        
        return usersArray;
    }

    function updateTable(users, table) {
        const rankedUsers = getRankedUsers(users);
        const tbody = table.getElementsByTagName('tbody')[0];

        // Clear existing rows in the table body
        if(tbody) {
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
        }
        
        //Create the data rows
        rankedUsers.forEach((user, index) => {
            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            rankCell.textContent = index + 1;
            row.appendChild(rankCell);

            const userCell = document.createElement('td');
            userCell.textContent = `${user[0]}P`;
            row.appendChild(userCell);

            const scoreCell = document.createElement('td');
            scoreCell.textContent = user[1];
            row.appendChild(scoreCell);

            tbody.appendChild(row);
        });
    }
});
