const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {};

// HIER SIND DEINE EINREICHTEN BEGRIFFE FEST HINTERLEGT
const defaultWords = [
    "VU aus Verfolgung",
    "VU aus Dummheit",
    "FD Eigenunfall",
    "PD Eigenunfall",
    "VPD baut scheiße",
    "Faye sauer auf VPD",
    "Frostie sauer auf VPD",
    "Faye ist sauer",
    "Frostie ist sauer",
    "Issi ist sauer",
    "Sturz aus Dummheit",
    "Einsatz anders als Dispatch",
    "MANV Vorarlarm",
    "MANV Schlägerei",
    "Fake Cop Ankündigung",
    "Dauerhaft bewusstlos",
    "Liberty Schlägerei",
    "Fahrzeug verschwindet auf MANV",
    "Leitstellentelefon ohne Antwort",
    "Einheit antwortet nicht im Funk",
    "CMC antwortet nicht im Funk",
    "Bernards antwortet nicht im Funk",
    "Bernards fordert Abtransport",
    "CMC vor 22 Uhr im Feierabend",
    "Mindestbesatzung zwischen 18 und 22 Uhr",
    "Storno",
    "Ortskunde",
    "Falscher Funk gefunkt",
    "Patient streitet mit PD",
    "Alkoholintox",
    "Falsches Fahrzeug",
    "Status vergessen",
    "Funkgerät ausgeschalten",
    "EMS wird überfallen"
];

let dynamicWords = [];

function generateIndividualCard() {
    let combinedPool = [...new Set([...dynamicWords, ...defaultWords])];
    combinedPool.sort(() => Math.random() - 0.5);

    let card = [];
    // Generiert alle 25 Felder (inklusive der Mitte) aus dem Begriffspool
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
    const lines = [, [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // Horizontal, [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // Vertikal, [4, 8, 12, 16, 20] // Diagonal
    ];
    return lines.some(line => line.every(index => card[index].marked));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
