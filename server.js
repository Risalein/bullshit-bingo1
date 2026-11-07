const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {};

const defaultWords = [
    "Synergien", "Agil", "Könnt ihr mich hören?", "No-Brainer", "Disruption", 
    "Deep Dive", "Am Ende des Tages", "Auf dem Schirm", "KPIs", "Low-Hanging Fruits", 
    "Mindset", "New Work", "Micro stumm!", "Customer Journey", "Benchmark", 
    "Quick Win", "Clustern", "Offline besprechen", "Outside the box", "Next Steps",
    "Fokus", "Mehrwert", "Win-Win", "Stakeholder", "Pipeline", "Skalieren", 
    "Bottleneck", "Best Practice", "Framework", "Deliverables", "KPI-Review",
    "Onboarding", "Roadmap", "Uplift", "Ready to go", "Meilenstein"
];

let dynamicWords = [];

function generateIndividualCard() {
    let combinedPool = [...new Set([...dynamicWords, ...defaultWords])];
    combinedPool.sort(() => Math.random() - 0.5);

    let card = [];
    // Schleife läuft nun über alle 25 Felder ohne Ausnahme
    for (let i = 0; i < 25; i++) {
        card.push({ text: combinedPool[i] || `Ersatzwort ${i}`, marked: false });
    }
    return card;
}

function setupDailyReset() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 5 && now.getMinutes() === 0) {
            console.log("05:00 Uhr: Karten werden neu generiert.");
            for (let id in players) {
                players[id].card = generateIndividualCard();
            }
            io.emit('updatePlayers', players);
            io.emit('dailyResetTriggered');
        }
    }, 60000);
}
setupDailyReset();

io.on('connection', (socket) => {
    socket.emit('wordCountUpdate', { total: [...new Set([...dynamicWords, ...defaultWords])].length, custom: dynamicWords.length });

    socket.on('addCustomWord', (word) => {
        const cleanedWord = word.trim();
        if (!cleanedWord) return;
        
        if (!defaultWords.includes(cleanedWord) && !dynamicWords.includes(cleanedWord)) {
            dynamicWords.push(cleanedWord);
            io.emit('wordCountUpdate', { total: [...new Set([...dynamicWords, ...defaultWords])].length, custom: dynamicWords.length });
        }
    });

    socket.on('joinGame', ({ name, userId }) => {
        if (!userId) return;

        if (!players[userId]) {
            players[userId] = {
                name: name || `Spieler ${userId.slice(0,4)}`,
                card: generateIndividualCard()
            };
        } else if (name) {
            players[userId].name = name;
        }

        socket.userId = userId;
        io.emit('updatePlayers', players);
    });

    socket.on('clickCell', ({ cellIndex, userId }) => {
        if (!userId || !players[userId]) return;

        // Die Sperre für Index 12 wurde entfernt. Jedes Feld schaltet nun den Zustand um.
        players[userId].card[cellIndex].marked = !players[userId].card[cellIndex].marked;
        let hasWon = checkBingo(players[userId].card);
        
        io.emit('updatePlayers', players);

        if (hasWon) {
            io.emit('bingoWinner', players[userId].name);
        }
    });

    socket.on('disconnect', () => {});
});

function checkBingo(card) {
    const lines = [,,,,, ,,,,, , ];
    return lines.some(line => line.every(index => card[index].marked));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
