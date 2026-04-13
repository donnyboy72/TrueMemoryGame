# 🧠 TrueMemoryGame

A modern, data-driven memory training application designed to track cognitive performance over time.
Built with a focus on **session analytics, scalable data simulation, and performance tracking**, this project goes beyond a simple memory game.

---

## 📌 Overview

**TrueMemoryGame** is an interactive memory-based game that challenges users to improve recall and pattern recognition while capturing detailed performance data.

Unlike traditional memory games, this project emphasizes:

* Tracking **multiple attempts within a session**
* Analyzing **user performance trends**
* Supporting **simulated datasets for testing and development**

---

## 🎯 Features

* 🧩 Classic memory matching gameplay
* 📊 Multi-check tracking within a single session *(NEW)*
* 🔄 Transition from session-based → **multi-attempt session tracking**
* 🧪 Simulated data generation for testing
* 📈 Dynamic graph updates for performance visualization
* ⚙️ Expandable variable types for deeper analytics

---

## 🧠 Key Concept: Session Evolution

### Old Approach ❌

* One session = one result
* Limited insight into user behavior

### New Approach ✅

* One session = **multiple attempts tracked**
* Enables:

  * Trend analysis
  * Fatigue detection
  * Learning curve modeling

---

## 🛠️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript *(or your actual stack)*
* **Data Simulation:** Gemini CLI + Ollama
* **Automation / Testing:** Playwright
* **Visualization:** Custom graph logic

---

## 📊 Data Simulation

This project uses **AI-assisted simulation** to generate realistic user data.

### Tools Used:

* Gemini CLI → generates scripts
* Ollama → runs local LLM workflows
* Playwright → simulates user interaction

This allows:

* Scalable testing without real users
* Rapid iteration on analytics features

---

## 📈 Metrics Tracked

* Accuracy per attempt
* Time per match
* Number of attempts per session
* Improvement rate within session
* Long-term performance trends

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/donnyboy72/TrueMemoryGame.git
cd TrueMemoryGame
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the app

```bash
npm start
```

---

## 🧪 Running Simulations

```bash
# Example (update based on your actual scripts)
node simulateData.js
```

---

## 📂 Project Structure

```
TrueMemoryGame/
│── src/
│   ├── components/
│   ├── logic/
│   ├── data/
│── simulations/
│── public/
│── README.md
```

---

## 🔥 Recent Updates

* ✅ Added more variable types for richer analytics
* 📊 Improved graph visualization
* 🧪 Integrated simulated data pipeline
* 🔁 Switched from session-based → multi-attempt tracking (**major upgrade**)

---

## 🎮 Future Improvements

* User authentication & profiles
* Cloud-based data storage *(optional)*
* AI-driven performance insights
* Adaptive difficulty system

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch
3. Submit a pull request

---

## 📜 License

MIT License

---

## 👤 Author

**Donavan Watley**
GitHub: https://github.com/donnyboy72

---

## 💡 Inspiration

Memory games are commonly used to improve cognitive skills like recall and concentration ([GitHub][1]).
This project expands that idea by integrating **data tracking and analytics**, making it useful for both users and research-oriented applications.

---

[1]: https://github.com/topics/memory-matching-game?utm_source=chatgpt.com "memory-matching-game · GitHub Topics · GitHub"
