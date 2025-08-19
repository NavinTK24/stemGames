const socket = io();
let roomId = null;

document.getElementById('multiplayerBtn').onclick = () => {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('roomMenu').style.display = 'block';
};

document.getElementById('createRoomBtn').onclick = () => {
    roomId = document.getElementById('roomIdInput').value;
    socket.emit('createRoom', roomId);
};

document.getElementById('joinRoomBtn').onclick = () => {
    roomId = document.getElementById('roomIdInput').value;
    socket.emit('joinRoom', roomId);
};

socket.on('roomCreated', (id) => {
    alert(`Room ${id} created. Waiting for player...`);
    document.getElementById('settingsMenu').style.display = 'block';
});

socket.on('roomExists', () => alert('Room already exists!'));
socket.on('roomNotFound', () => alert('Room not found!'));
socket.on('roomFull', () => alert('Room is full!'));

socket.on('roomJoined', (id) => {
    alert(`Joined Room ${id}`);
});

socket.on('bothPlayersReady', () => {
    alert('Both players connected!');
    document.getElementById('settingsMenu').style.display = 'block';
});

document.getElementById('startGameBtn').onclick = () => {
    const difficulty = document.getElementById('difficulty').value;
    const topic = document.getElementById('topic').value;
    socket.emit('setGameSettings', { roomId, difficulty, topic });
};

socket.on('gameSettingsUpdated', (settings) => {
    document.getElementById('settingsMenu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    startGame(settings);
});

function startGame(settings) {
    const question = generateQuestion(settings.difficulty, settings.topic);
    document.getElementById('question').textContent = question.text;
    socket.emit('sendQuestion', { roomId, question });
}

socket.on('receiveQuestion', (question) => {
    document.getElementById('question').textContent = question.text;
});

document.getElementById('submitAnswer').onclick = () => {
    const answer = document.getElementById('answerInput').value;
    socket.emit('sendAnswer', { roomId, answer });
};

socket.on('receiveAnswer', (answer) => {
    document.getElementById('status').textContent = `Opponent answered: ${answer}`;
});

function generateQuestion(difficulty, topic) {
    let num1, num2;
    if (difficulty === 'easy') {
        num1 = Math.floor(Math.random() * 10) + 1;
        num2 = Math.floor(Math.random() * 10) + 1;
    } else if (difficulty === 'medium') {
        num1 = Math.floor(Math.random() * 50) + 10;
        num2 = Math.floor(Math.random() * 50) + 10;
    } else {
        num1 = Math.floor(Math.random() * 100) + 50;
        num2 = Math.floor(Math.random() * 100) + 50;
    }

    let text = '';
    let answer = 0;

    switch (topic) {
        case 'addition':
            text = `${num1} + ${num2}`;
            answer = num1 + num2;
            break;
        case 'subtraction':
            text = `${num1} - ${num2}`;
            answer = num1 - num2;
            break;
        case 'multiplication':
            text = `${num1} × ${num2}`;
            answer = num1 * num2;
            break;
        case 'division':
            text = `${num1} ÷ ${num2}`;
            answer = (num1 / num2).toFixed(2);
            break;
    }
    return { text, answer };
}