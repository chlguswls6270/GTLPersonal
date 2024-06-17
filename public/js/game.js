document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired");
    const room = window.location.pathname.split('/')[1];
    console.log("room number game.js: " + room);
    const ws = new WebSocket(`ws://${location.host}?room=${room}`);
    console.log("====chlguswls");
    const form = document.getElementById('userForm');
    const input = document.getElementById('inputField');
    const messages = document.getElementById('chat-log');

    ws.onmessage = (event) => {
        const blob = event.data;
        blob.text().then(text => {
            const message = document.createElement('div');
            const new_text = document.createTextNode(text)
            message.appendChild(new_text);

            messages.appendChild(message)
        })
    };

    form.onsubmit = event => {
        event.preventDefault();
        if (input.value) {
            ws.send(input.value);
            input.value = '';
        }
    };
});
