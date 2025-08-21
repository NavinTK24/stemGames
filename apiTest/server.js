import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("public"));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let currentAnswer = ""; // temporarily store the latest answer

app.post("/get-question", async (req, res) => {
    try {
        const prompt = `Give a DSA question that can be answered in a word or two
        and its correct answer in JSON format like:
        {"question": "your question here", "answer": "your answer here"}
        Do not add any extra text or markdown fences.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse response into JSON
        const qa = JSON.parse(text);

        currentAnswer = qa.answer.trim().toLowerCase(); // save answer safely

        res.json({ question: qa.question });

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
    } else {
        res.json({ result: `❌ Wrong! Correct answer is: ${currentAnswer}` });
    }
});


const PORT = 3002;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

// npm init -y
// npm instal express node-fetch dotenv
// npm install @google/generative-ai dotenv
