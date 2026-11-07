const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {};

// Deine reinen RP-Begriffe (Exakt 34 Stück, ohne Platzhalter)
const vorgegebeneBegriffe = [
    "VU aus Verfolgung", "VU aus Dummheit", "FD Eigenunfall", "PD Eigenunfall", "VPD baut scheiße",
    "Faye sauer auf VPD", "Frostie sauer auf VPD", "Faye ist sauer", "Frostie ist sauer", "Issi ist sauer",
    "Sturz aus Dummheit", "Einsatz anders als Dispatch", "MANV Vorarlarm", "MANV Schlägerei", "Fake Cop Ankündigung",
    "Dauerhaft bewusstlos", "Liberty Schlägerei", "Fahrzeug verschwindet auf MANV", "Leitstellentelefon ohne Antwort", "Einheit antwortet nicht im Funk",
    "CMC antwortet nicht im Funk", "Bernards antwortet nicht im Funk", "Bernards fordert Abtransport", "CMC vor 22 Uhr im Feierabend", "Mindestbesatzung zwischen 18 und 22 Uhr",
    "Storno", "Ortskunde", "Falscher Funk gefunkt", "Patient streitet mit PD", "Alkoholintox",
    "Falsches Fahrzeug", "Status vergessen", "Funkgerät ausgeschalten", "EMS wird überfallen"
];

function generateIndividualCard() {
    let userPool = [...vorgegebeneBegriffe];
    
    // Professioneller Fisher-Yates Shuffle für echte Zufallsmischung
    for (let i = userPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [userPool[i], userPool[j]] = [userPool[j], userPool[i]];
    }

    // Erstellt das 5x5 Feld komplett OHNE Joker (Feld 12 ist ein normaler Begriff)
    let card = [];
    for (let i = 0; i < 25; i++) {
        card.push({ text: userPool[i], marked: false });
    }
    return card;
}

function setupDailyReset() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 5 && now.getMinutes() === 0) {
            console.log("05:00 Uhr erreicht: Generiere neue tägliche Karten...");
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
    console.log(`Verbindung: ${socket.id}`);

    socket.on('joinGame', ({ name }) => {
        let card = generateIndividualCard();
        players[socket.id] = { 
            name: name || `Spieler ${socket.id.slice(0,4)}`, 
            card: card
        };
        io.emit('updatePlayers', players);
    });

    socket.on('clickCell', (cellIndex) => {
        if (!players[socket.id]) return;

        // Umschalten des Feldes (Feld 12 ist jetzt ebenfalls klickbar!)
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
    // Alle korrekten mathematischen Gewinnlinien für ein normales 5x5 Raster (0-24)
    const lines = [
        // Horizontal, [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        // Vertikal, [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        // Diagonal, [4, 8, 12, 16, 20]
    ];
    return lines.some(line => line.every(index => card[index].marked));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
