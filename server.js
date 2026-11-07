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
    "Bottleneck", "Best Practice", "Framework", "Deliverables"
];

function generateIndividualCard(customWords = []) {
    let userPool = [...customWords].filter(w => w.trim() !== "");
    if (userPool.length < 24) {
        const needed = 24 - userPool.length;
        let availableDefaults = defaultWords.filter(w => !userPool.includes(w));
        if (availableDefaults.length < needed) availableDefaults = [...defaultWords];
        availableDefaults.sort(() => Math.random() - 0.5);
        userPool = userPool.concat(availableDefaults.slice(0, needed));
    }
    userPool.sort(() => Math.random() - 0.5);

    let card = [];
    let wordIndex = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            card.push({ text: "☕ JOKER (FREE)", marked: true });
        } else {
            card.push({ text: userPool[wordIndex], marked: false });
            wordIndex++;
        }
    }
    return card;
}

function setupDailyReset() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 5 && now.getMinutes() === 0) {
            console.log("05:00 Uhr erreicht: Generiere neue tägliche Karten...");
            for (let id in players) {
                players[id].card = generateIndividualCard(players[id].customWordsInput);
            }
            io.emit('updatePlayers', players);
            io.emit('dailyResetTriggered');
        }
    }, 60000);
}
setupDailyReset();

io.on('connection', (socket) => {
    console.log(`Verbindung: ${socket.id}`);

    socket.on('joinGame', ({ name, customWords }) => {
        let card = generateIndividualCard(customWords);
        players[socket.id] = { 
            name: name || `Spieler ${socket.id.slice(0,4)}`, 
            card: card,
            customWordsInput: customWords
        };
        io.emit('updatePlayers', players);
    });

    socket.on('clickCell', (cellIndex) => {
        if (!players[socket.id]) return;
        if (cellIndex === 12) return;

        players[socket.id].card[cellIndex].marked = !players[socket.id].card[cellIndex].marked;
        let hasWon = checkBingo(players[socket.id].card);
        io.emit('updatePlayers', players);

        if (hasWon) {
            io.emit('bingoWinner', players[socket.id].name);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

function checkBingo(card) {
    const lines = [, [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
, [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
, [4, 8, 12, 16, 20]
    ];
    return lines.some(line => line.every(index => card[index].marked));
}

// WICHTIG FÜR RENDER: Nutzt den zugewiesenen Cloud-Port oder lokal 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
