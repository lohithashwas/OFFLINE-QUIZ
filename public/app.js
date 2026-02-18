const socket = io();

// Anti-Cheating: Disable Context Menu & Shortcuts
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    if (event.ctrlKey && (event.key === 'c' || event.key === 'v' || event.key === 'u')) {
        event.preventDefault();
    }
});

// Detect Tab Switching
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        socket.emit('tab_switch_alert');
        alert("WARNING: Tab switching is monitored! The host has been notified.");
    }
});

// UI Elements
const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const feedbackScreen = document.getElementById('feedback-screen');

const teamInput = document.getElementById('team-name');
const jumbledWord = document.getElementById('jumbled-word');
const answerInput = document.getElementById('answer-input');
const timerBar = document.getElementById('timer-bar');

let myTeamName = "";

// On Load: Check for existing session
window.addEventListener('load', () => {
    const savedName = sessionStorage.getItem('myTeamName');
    if (savedName) {
        console.log('Restoring session for:', savedName);
        teamInput.value = savedName;
        joinGame(); // Auto-join
    }
});

function joinGame() {
    const name = teamInput.value.trim();
    if (!name) return alert("Please enter a team name");

    myTeamName = name;
    sessionStorage.setItem('myTeamName', name); // Persist
    socket.emit('join_game', myTeamName);

    joinScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
}

// Auto-Rejoin on Reconnection
socket.on('connect', () => {
    console.log('Connected to server');
    if (myTeamName) {
        console.log('Auto-rejoining as:', myTeamName);
        socket.emit('join_game', myTeamName);

        // If we were in a game, request state? 
        // For now, just being in the teams list is enough to verify answers.
    }
});

// Socket Events
socket.on('question_ready', (data) => {
    console.log('Event received: question_ready', data);

    // reset UI - Hide ALL overlays
    waitingScreen.classList.add('hidden');
    feedbackScreen.classList.add('hidden');
    document.getElementById('leaderboard-screen').classList.add('hidden');
    gameScreen.classList.remove('hidden');

    // Reset & Disable inputs
    answerInput.value = "";
    answerInput.disabled = true;
    answerInput.placeholder = "Wait for timer...";
    document.getElementById('submit-btn').disabled = true;

    // Set Word
    jumbledWord.innerText = data.question;
    jumbledWord.style.opacity = "0.5";

    // Reset Timer Bar
    if (timerInterval) clearInterval(timerInterval);
    timerBar.style.width = "100%";
    timerBar.style.backgroundColor = '#ccc';
});

socket.on('timer_started', (data) => {
    // Show game screen if not already visible (for late joiners)
    waitingScreen.classList.add('hidden');
    feedbackScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    // Update Question if provided (for late joiners)
    if (data.question) {
        jumbledWord.innerText = data.question;
    }

    // Enable inputs
    answerInput.disabled = false;
    answerInput.placeholder = "Your Answer";
    answerInput.focus();
    document.getElementById('submit-btn').disabled = false;

    jumbledWord.style.opacity = "1";

    // Start Timer Anim
    const remaining = data.endTime - Date.now();
    startTimer(remaining);
});

socket.on('time_up', () => {
    gameScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    feedbackScreen.classList.remove('hidden');
    document.getElementById('feedback-msg').innerText = "Time's Up!";
});

socket.on('game_over', (data) => {
    waitingScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    feedbackScreen.classList.add('hidden');
    document.getElementById('leaderboard-screen').classList.remove('hidden');

    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    data.leaderboard.forEach((entry, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${entry.team}</td>
            <td>${entry.score}</td>
        `;
        // Highlight my team
        if (entry.team === myTeamName) {
            tr.style.fontWeight = "bold";
            tr.style.color = "#4CAF50";
        }
        tbody.appendChild(tr);
    });
});

function submitAnswer() {
    const answer = answerInput.value.trim();
    if (!answer) return;

    socket.emit('submit_answer', answer);

    gameScreen.classList.add('hidden');
    feedbackScreen.classList.remove('hidden');
    document.getElementById('feedback-msg').innerText = "Answer Submitted!";
}

let timerInterval;
function startTimer(durationMs) {
    if (timerInterval) clearInterval(timerInterval);

    const start = Date.now();
    const end = start + durationMs;

    timerBar.style.width = '100%';
    timerBar.style.backgroundColor = '#4CAF50';

    timerInterval = setInterval(() => {
        const now = Date.now();
        const left = end - now;

        if (left <= 0) {
            clearInterval(timerInterval);
            timerBar.style.width = '0%';
            return;
        }

        const pct = (left / 60000) * 100; // Assuming 60s max
        timerBar.style.width = pct + '%';

        if (pct < 20) timerBar.style.backgroundColor = '#f44336';
        else if (pct < 50) timerBar.style.backgroundColor = '#ff9800';

    }, 100);
}
