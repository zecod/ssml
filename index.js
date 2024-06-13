import express from "express";
import axios from "axios";
import mp3Duration from "mp3-duration";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());

const subscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY;
const serviceRegion = process.env.AZURE_SERVICE_REGION;
const voicesFilePath = path.resolve(__dirname, "voices.json");

// Function to fetch and store voices from Azure API
const fetchAndStoreVoices = async () => {
  const url = `https://${serviceRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const headers = {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
  };

  try {
    const response = await axios.get(url, { headers });
    const voices = response.data.map((voice) => ({
      DisplayName: voice.DisplayName,
      ShortName: voice.ShortName,
      Locale: voice.Locale,
      Gender: voice.Gender,
      SampleRateHertz: voice.SampleRateHertz,
      WordsPerMinute: voice.WordsPerMinute || "150",
      flag: `https://flagcdn.com/w40/${voice.Locale.split(
        "-"
      )[1].toLowerCase()}.png`,
      engine: "vercelli",
    }));

    // Store voices to voices.json
    fs.writeFileSync(voicesFilePath, JSON.stringify(voices, null, 2));
  } catch (error) {
    console.error("Error fetching voices from Azure API:", error);
  }
};

// Endpoint to fetch and store voices
app.post("/api/fetchVoices", async (req, res) => {
  await fetchAndStoreVoices();
  res.json({ message: "Voices fetched and stored successfully." });
});

// Endpoint to list available voices from voices.json
app.get("/api/listVoices", (req, res) => {
  try {
    const voices = JSON.parse(fs.readFileSync(voicesFilePath, "utf-8"));
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate SSML
app.post("/api/generateSSML", (req, res) => {
  const { text, voiceName } = req.body;

  if (!text || !voiceName) {
    return res.status(400).json({ error: "Text and voiceName are required" });
  }

  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceName}'>${text}</voice>
</speak>`;

  res.json({ ssml });
});

// Endpoint to synthesize speech to audio with speech marks
app.post("/api/synthesize", async (req, res) => {
  const { text, voiceName, rate } = req.body;

  if (!text || !voiceName || !rate) {
    return res
      .status(400)
      .json({ error: "Text, voiceName, and rate are required" });
  }

  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <mstts:silence type="sentenceboundary" value="50ms"/>
    ${text}
  </voice>
</speak>`;

  const url = `https://${serviceRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const headers = {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Content-Type": "application/ssml+xml",
    "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
    "X-Microsoft-Speech-Marks": "word",
  };

  try {
    const response = await axios.post(url, ssml, {
      headers,
      responseType: "arraybuffer",
    });
    const audioBuffer = Buffer.from(response.data, "binary");

    // Get duration of MP3 audio
    mp3Duration(audioBuffer, (err, duration) => {
      if (err) return res.status(500).json({ error: err.message });

      const audioLengthInSeconds = duration;
      const words = text.split(" ");
      const totalWords = words.length;
      const wordDuration = (audioLengthInSeconds * 1200) / totalWords;

      const speechMarks = words.map((word, index) => ({
        type: "word",
        value: word,
        start: index * wordDuration,
        end: (index + 1) * wordDuration,
      }));

      res.json({
        audioStream: audioBuffer.toString("base64"),
        format: "mp3",
        speechMarks: speechMarks,
      });
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.response ? error.response.data : error.message });
  }
});

// Initialize the voices.json file
if (!fs.existsSync(voicesFilePath)) {
  fetchAndStoreVoices();
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
