const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { SerialPort } = require('serialport');
const fs = require('fs');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'XO.html'));
});

//const device = '/dev/ttyUSB0'; //board port id
var count = 0;
var Xclient = '';
var Oclient = '';
let gameOver = false;

io.on('connection', (socket) => {
    console.log("Welcome");
    // console.log("Player connected: "+socket.id);
    console.log('Clients connected:', io.engine.clientsCount);
    
    //Decides and emits the data to the client
    socket.on('playerChoice', (data) => {
        const player = (count%2 === 0)? 'X' : 'O';

        //Assigns the first to click X to be  client1 and vice versa
        
        if(player === 'X' && Xclient === '' && data.click === true) {
            Xclient = socket.id;
            console.log(`XClient: ${Xclient}`);
        } else if(player === 'O' && socket.id != Xclient && data.click === true) {
            Oclient = socket.id;
            console.log(`Oclient: ${Oclient}`);
        }
        
        //Allows single client to play both
        if (io.engine.clientsCount === 1 && Oclient === '') {
            io.emit('updatedDiv', {
                id: data.id,
                value: Number(data.value),
                player: player,
                count: count+1,
            }); 
            console.log("single client");
            count++;
        }
        //Blocks Xclient during O's turn and vice versa
        else if(( socket.id === Xclient && player === 'X') || (socket.id === Oclient && player === 'O')) {
            io.emit('updatedDiv', { 
                id: data.id,
                value: Number(data.value),
                player: player,
                count: count+1
            }); 
            count++;
            console.log("two client");
        } 
        else {//when choices mismatch
            socket.emit('notYourTurn');
            console.log(`Invalid move attempt by ${socket.id}`);
        }
        
        
        //writing to serial monitor of arduino
        // var boxData = `Player ${player} clicked box ID: ${data.id}, Index: ${data.value}, Count: ${count} \n`;
        // fs.appendFile(device, boxData, (err) => {
        //     if(err) console.error('Write Failed: ',err);
        // })

        // socket.on('winMsgArduino', (whichClient) => {
        //     if (gameOver) return;

        //     var clientWon = `AND ${whichClient.player} WON!\n`;
        //     fs.appendFile(device, clientWon, (err) => {
        //         if (err) console.error('Write Failed: ',err);
        //     });

        //     gameOver = true;
        // });
        
        
    });

    //emits reset signal when button is pressed
    socket.on('resetEverything', () => {
        console.log(`Reset requested by ${socket.id}`);
        count = 0;
        gameOver = false;
        Xclient = '';
        Oclient = '';
        io.emit('resetBoardForAll');
    });
    
    socket.on('disconnect', () => {
        console.log("Player disconnected: "+socket.id);
        // Reset roles if one of the players leaves
        console.log("Resetting game due to disconnect");
        count = 0;
        Xclient = '';
        Oclient = '';
        io.emit('resetBoardForAll');
    });
});

http.listen(3004, () => {
    console.log("Server running at localhost:3004");
});
