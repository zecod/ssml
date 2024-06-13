document.getElementById("listVoicesBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/listVoices");
    const voices = await response.json();
    const voicesList = document.getElementById("voicesList");
    voicesList.innerHTML = "";

    const renderVoices = (filter = "") => {
      voicesList.innerHTML = "";
      voices
        .filter(
          (voice) =>
            voice.DisplayName.toLowerCase().includes(filter.toLowerCase()) ||
            voice.ShortName.toLowerCase().includes(filter.toLowerCase())
        )
        .forEach((voice) => {
          const voiceCard = document.createElement("div");
          voiceCard.className =
            "p-4 bg-white rounded-lg shadow-md flex items-center space-x-4";

          const flagImg = document.createElement("img");
          flagImg.src = voice.flag;
          flagImg.alt = `${voice.Locale} flag`;
          flagImg.className = "w-10 h-10 rounded-full";

          const voiceInfo = document.createElement("div");
          voiceInfo.className = "flex-1";

          const voiceName = document.createElement("h3");
          voiceName.className = "text-lg font-semibold";
          voiceName.textContent = `${voice.DisplayName} (${voice.ShortName})`;

          const voiceDetails = document.createElement("p");
          voiceDetails.className = "text-sm text-gray-500";
          voiceDetails.textContent = `Language: ${voice.Locale}, Gender: ${voice.Gender}, Sample Rate: ${voice.SampleRateHertz}Hz, Words Per Minute: ${voice.WordsPerMinute}`;

          voiceInfo.appendChild(voiceName);
          voiceInfo.appendChild(voiceDetails);
          voiceCard.appendChild(flagImg);
          voiceCard.appendChild(voiceInfo);

          voiceCard.addEventListener("click", () => {
            document
              .querySelectorAll(".voice-card")
              .forEach((card) => card.classList.remove("bg-blue-100"));
            voiceCard.classList.add("bg-blue-100");
            document.getElementById(
              "voiceSelectContainer"
            ).textContent = `${voice.DisplayName} (${voice.ShortName})`;
            document.getElementById("voiceSelectContainer").dataset.voiceName =
              voice.ShortName;
            document.getElementById("voiceSelectContainer").dataset.voiceRate =
              voice.WordsPerMinute;
          });

          voiceCard.classList.add("voice-card");
          voicesList.appendChild(voiceCard);
        });
    };

    renderVoices();

    document.getElementById("searchBar").addEventListener("input", (e) => {
      renderVoices(e.target.value);
    });
  } catch (error) {
    console.error("Error fetching voices:", error);
  }
});

document
  .getElementById("generateSSMLBtn")
  .addEventListener("click", async () => {
    const text = document.getElementById("textInput").value;
    const voiceName = document.getElementById("voiceSelectContainer").dataset
      .voiceName;
    if (!text || !voiceName) {
      alert("Please enter text and select a voice");
      return;
    }

    try {
      const response = await fetch("/api/generateSSML", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, voiceName }),
      });
      const data = await response.json();
      document.getElementById("ssmlOutput").textContent = data.ssml;
    } catch (error) {
      console.error("Error generating SSML:", error);
    }
  });

document.getElementById("synthesizeBtn").addEventListener("click", async () => {
  const text = document.getElementById("textInput").value;
  const voiceName = document.getElementById("voiceSelectContainer").dataset
    .voiceName;
  const rate = document.getElementById("voiceSelectContainer").dataset
    .voiceRate;

  if (!text || !voiceName || !rate) {
    alert("Please enter text and select a voice");
    return;
  }

  try {
    const response = await fetch("/api/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName, rate }),
    });
    const data = await response.json();
    if (!data.audioStream) {
      throw new Error("No audio stream in the response");
    }
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.src = `data:audio/mp3;base64,${data.audioStream}`;
    document.getElementById("speechMarksOutput").textContent = JSON.stringify(
      data.speechMarks,
      null,
      2
    );

    // Display text with words wrapped in spans
    const highlightedText = document.getElementById("highlightedText");
    highlightedText.innerHTML = text
      .split(" ")
      .map((word, index) => `<span id="word-${index}">${word}</span>`)
      .join(" ");

    // Highlight words during audio playback using requestAnimationFrame
    function highlightWords() {
      const currentTime = audioPlayer.currentTime * 1000; // Convert to milliseconds
      data.speechMarks.forEach((mark, index) => {
        const wordElement = document.getElementById(`word-${index}`);
        if (currentTime >= mark.start && currentTime <= mark.end) {
          wordElement.style.backgroundColor = "yellow";
        } else {
          wordElement.style.backgroundColor = "transparent";
        }
      });
      requestAnimationFrame(highlightWords);
    }

    audioPlayer.addEventListener("play", () => {
      requestAnimationFrame(highlightWords);
    });
  } catch (error) {
    console.error("Error synthesizing audio:", error);
  }
});
