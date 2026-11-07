const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// Speicher für alle Spieler im Spiel (wird über persistente IDs gehalten)
let players = {};

const defaultWords = [
    "Synergien", "Agil", "Könnt ihr mich hören?", "No-Brainer", "Disruption", 
    "Deep Dive", "Am Ende des Tages", "Auf dem Schirm", "KPIs", "Low-Hanging Fruits", 
    "Mindset", "New Work", "Micro stumm!", "Customer Journey", "Benchmark", 
    "Quick Win", "Clustern", "Offline besprechen", "Outside the box", "Next Steps",
    "Fokus", "Mehrwert", "Win-Win", "Stakeholder", "Pipeline", "Skalieren", 
    "Bottleneck", "Best Practice", "Framework", "Deliverables"
];

let dynamicWords = [];

function generateIndividualCard() {
    let combinedPool = [...new Set([...dynamicWords, ...defaultWords])];
    combinedPool.sort(() => Math.random() - 0.5);

    let card = [];
    let wordIndex = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            card.push({ text: "☕ JOKER (FREE)", marked: true });
        } else {
            card.push({ text: combinedPool[wordIndex], marked: false });
            wordIndex++;
        }
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
    // Sende die aktuellen Pool-Zahlen an den frisch verbundenen Client
    socket.emit('wordCountUpdate', { total: [...new Set([...dynamicWords, ...defaultWords])].length, custom: dynamicWords.length });

    // Event: Begriff einsenden
    socket.on('addCustomWord', (word) => {
        const cleanedWord = word.trim();
        if (!cleanedWord) return;
        
        if (!defaultWords.includes(cleanedWord) && !dynamicWords.includes(cleanedWord)) {
            dynamicWords.push(cleanedWord);
            io.emit('wordCountUpdate', { total: [...new Set([...dynamicWords, ...defaultWords])].length, custom: dynamicWords.length });
        }
    });

    // Event: Spiel beitreten oder wiederverbinden mit eindeutiger userId
    socket.on('joinGame', ({ name, userId }) => {
        if (!userId) return;

        // Wenn der Spieler bereits existiert (z. B. nach einem Tab-Wechsel), behalten wir seine Karte!
        if (players[userId]) {
            // Aktualisiere nur den Namen, falls er geändert wurde
            if (name) players[userId].name = name;
        } else {
            // Komplett neuer Spieler erhält eine neue Karte
            players[userId] = {
                name: name || `Spieler ${userId.slice(0,4)}`,
                card: generateIndividualCard()
            };
        }

        // Verknüpfe die aktuelle socket.id mit der userId für den Disconnect
        socket.userId = userId;

        io.emit('updatePlayers', players);
    });

    // Event: Feld anklicken
    socket.on('clickCell', ({ cellIndex, userId }) => {
        if (!userId || !players[userId]) return;
        if (cellIndex === 12) return;

        players[userId].card[cellIndex].marked = !players[userId].card[cellIndex].marked;
        let hasWon = checkBingo(players[userId].card);
        
        io.emit('updatePlayers', players);

        if (hasWon) {
            io.emit('bingoWinner', players[userId].name);
        }
    });

    socket.on('disconnect', () => {
        // Bei einem kurzen Verbindungsabbruch/Zurückgehen löschen wir den Spieler NICHT sofort,
        // damit sein Zustand erhalten bleibt, wenn er gleich wiederkommt.
        // Optionale Bereinigung könnte nach Inaktivität erfolgen.
    });
});

function checkBingo(card) {
    const lines = [, [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24], // Horizontal, [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24], // Vertikal, [4,8,12,16,20] // Diagonal
    ];
    return lines.some(line => line.every(index => card[index].marked));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
