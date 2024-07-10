document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[2];
    console.log("room number game.js: " + room);
    const ws = new WebSocket(`ws://${location.host}/mult-private-lobby?room=${room}`);
    console.log("====chlguswls");
    // const form = document.getElementById('userForm');
    // const input = document.getElementById('inputField');
    // const messages = document.getElementById('chat-log');
    const messages = document.getElementById('users');

    ws.onmessage = (event) => {
        //display user when new user is detected.
        const data = JSON.parse(event.data);
        if (data.type === 'new-user') {
            const user = document.createElement('div');
            const new_user = document.createTextNode(data.message)
            user.appendChild(new_user);
            messages.appendChild(user)
        } else if (data.type === 'user-left') {
            console.log("usre left message received!")
            let children = messages.children;
            children.item(data.idx).style.display = 'none';
        }
    };

    document.getElementById('start').addEventListener('click', function() {
        console.log("sending start signal from lobby!")
        ws.send(JSON.stringify({ type: 'start', message: "start the game!" }));// Change this URL to the desired page
    });
    //send start mesage to wss when host press start button

});
