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

app.post("/get-recipe", async (req, res) => {
    const { dish } = req.body;

    try {
        const prompt = `Give me a detailed, step-by-step recipe for ${dish}.`;

        const result = await model.generateContent(prompt);
        const recipeText = result.response.text();

        res.json({ recipe: recipeText });

    } catch (error) {
        console.error("Error fetching recipe:", error);
        res.status(500).json({ recipe: "❌ Failed to fetch recipe" });
    }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
