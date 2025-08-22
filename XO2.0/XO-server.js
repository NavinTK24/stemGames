import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

// Create HTTP + Socket.io server in ESM
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

var count = 0;
var Xclient = '';
var Oclient = '';
let gameOver = false;
var questionResult = false


io.on('connection', (socket) => {

    
    
    console.log("Welcome");
    // console.log("Player connected: "+socket.id);
    console.log('Clients connected:', io.engine.clientsCount);
    let player = '';
    let currentAnswer = ""; // temporarily store the latest answer

    app.post("/get-question", async (req, res) => {
        try {
            const prompt = `Give me a DSA question that can be answered in a word or two
        and its correct answer in JSON format like:
        {"question": "your question here", "answer": "your answer here"}
        Do not add any extra text or markdown fences.`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Parse response into JSON
            const qa = JSON.parse(text);

            currentAnswer = qa.answer.trim().toLowerCase(); // save answer safely

            res.json({ question: qa.question });

            console.log('Fetched Successfully');

        } catch (error) {
            console.error("Error fetching question:", error);
            res.status(500).json({ question: "❌ Failed to fetch question" });
        }
    });
    
    app.post("/check-answer", (req, res) => {
       
        // normalize user input
        const userAnswer = (req.body.answer || "").toLowerCase().replace(/\s+/g, ""); // remove all spaces

        if (!currentAnswer) {
            return res.status(400).json({ result: "❌ No question asked yet" });
        }

        // normalize correct answer
        const correctAnswer = currentAnswer.toLowerCase().replace(/\s+/g, "");

        if (userAnswer === correctAnswer) {
            res.json({ result: "✅ Correct!" });
            questionResult = true;

        } else {
            res.json({ result: `❌ Wrong! Correct answer is: ${currentAnswer}` });
        }
    });

    //Decides and emits the data to the client
    socket.on('playerChoice', (data) => {

        if (questionResult) {
            if (count === 0 && Xclient === '' && Oclient === '' && data.click === true) {
                Xclient = socket.id;
                player = 'X';
                console.log(`XClient: ${Xclient}`);
            } else if (count > 0 && socket.id != Xclient && Oclient === '' && data.click === true) {
                Oclient = socket.id;
                console.log(`Oclient: ${Oclient}`);
            }


            if (socket.id === Xclient) {
                player = 'X';
            } else if (socket.id === Oclient) {
                player = 'O';
            }

            io.emit('updateClick',)

            //Allows single client to play both
            if (io.engine.clientsCount === 1 && Oclient === '') {
                io.emit('updatedDiv', {
                    id: data.id,
                    value: Number(data.value),
                    player: player,
                    count: count + 1,
                });
                count++;
            }
            //Blocks Xclient during O's turn and vice versa
            else if ((socket.id === Xclient && player === 'X') || (socket.id === Oclient && player === 'O')) {
                console.log('calling to update div');
                io.emit('updatedDiv', {
                    id: data.id,
                    value: Number(data.value),
                    player: player,
                    count: count + 1
                });
                count++;
            }
            else {//when choices mismatch
                socket.emit('notYourTurn');
                console.log(`Invalid move attempt by ${socket.id}`);
            }

            questionResult = false;
        }


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
        console.log("Player disconnected: " + socket.id);
        // Reset roles if one of the players leaves
        console.log("Resetting game due to disconnect");
        count = 0;
        Xclient = '';
        Oclient = '';
        io.emit('resetBoardForAll');
    });
});

const PORT = process.env.PORT || 3009;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
