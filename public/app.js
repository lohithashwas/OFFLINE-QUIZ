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
const investScreen = document.getElementById('invest-screen');
const gameScreen = document.getElementById('game-screen');
const feedbackScreen = document.getElementById('feedback-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

const teamInput = document.getElementById('team-name');
const jumbledWord = document.getElementById('jumbled-word');
const investWord = document.getElementById('invest-word');
const answerInput = document.getElementById('answer-input');
const timerBar = document.getElementById('timer-bar');
const scoreDetails = document.getElementById('score-details');

let myTeamName = "";
let myInvested = false;

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
    }
});

// Helper: hide all screens
function hideAllScreens() {
    joinScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    investScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    feedbackScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
}

// ========== INVEST PHASE ==========
socket.on('invest_phase', (data) => {
    console.log('Event received: invest_phase', data);

    hideAllScreens();
    investScreen.classList.remove('hidden');

    // Show the jumbled word preview
    investWord.innerText = data.question;
    myInvested = false;

    // Reset score details
    scoreDetails.innerHTML = '';

    // Reset Timer Bar
    if (timerInterval) clearInterval(timerInterval);
    timerBar.style.width = "100%";
    timerBar.style.backgroundColor = '#ccc';
});

function investChoice(invested) {
    myInvested = invested;
    socket.emit('submit_invest', invested);

    // Show waiting state within invest screen
    hideAllScreens();
    waitingScreen.classList.remove('hidden');
    document.querySelector('#waiting-screen h2').innerText = invested
        ? '📈 Invested! Waiting for timer...'
        : '🛡️ Passed! Waiting for timer...';
    document.querySelector('#waiting-screen p').innerText = 'Host will start the round soon.';
}

// ========== TIMER STARTED ==========
socket.on('timer_started', (data) => {
    console.log('Event received: timer_started', data);

    hideAllScreens();
    gameScreen.classList.remove('hidden');

    // Update Question (for late joiners too)
    if (data.question) {
        jumbledWord.innerText = data.question;
    }

    // Enable inputs
    answerInput.value = "";
    answerInput.disabled = false;
    answerInput.placeholder = "Your Answer";
    answerInput.focus();
    document.getElementById('submit-btn').disabled = false;

    jumbledWord.style.opacity = "1";

    // Start Timer Anim
    const remaining = data.endTime - Date.now();
    startTimer(remaining);
});

// ========== TIME UP ==========
socket.on('time_up', () => {
    hideAllScreens();
    feedbackScreen.classList.remove('hidden');
    document.getElementById('feedback-msg').innerText = "⏰ Time's Up!";
    scoreDetails.innerHTML = '<p style="color: #ff9800;">No answer submitted in time.</p>';
});

// ========== ANSWER SUBMISSION ==========
function submitAnswer() {
    const answer = answerInput.value.trim();
    if (!answer) return;

    socket.emit('submit_answer', answer);

    // Disable further input
    answerInput.disabled = true;
    document.getElementById('submit-btn').disabled = true;

    // Show immediate feedback (will be updated when answer_result arrives)
    hideAllScreens();
    feedbackScreen.classList.remove('hidden');
    document.getElementById('feedback-msg').innerText = "Answer Submitted!";
    scoreDetails.innerHTML = '<div class="loader" style="width:30px;height:30px;margin:1rem auto;"></div>';
}

// ========== ANSWER RESULT (from server) ==========
socket.on('answer_result', (data) => {
    hideAllScreens();
    feedbackScreen.classList.remove('hidden');

    if (data.isCorrect) {
        document.getElementById('feedback-msg').innerText = "✅ Correct!";
        let details = `<p class="score-earned">+${data.score} pts</p>`;
        if (data.invested && data.multiplier) {
            details += `<p class="score-multiplier">📈 Invested · ${data.multiplier}× multiplier · Position #${data.position}</p>`;
        } else {
            details += `<p class="score-multiplier">🛡️ Safe play · Flat 10 pts</p>`;
        }
        scoreDetails.innerHTML = details;
    } else {
        document.getElementById('feedback-msg').innerText = "❌ Wrong!";
        if (data.invested) {
            scoreDetails.innerHTML = '<p class="score-lost">📈 Invested · 0 pts (wrong answer)</p>';
        } else {
            scoreDetails.innerHTML = '<p class="score-lost">🛡️ Passed · 0 pts (wrong answer)</p>';
        }
    }
});

// ========== GAME OVER ==========
socket.on('game_over', (data) => {
    hideAllScreens();
    leaderboardScreen.classList.remove('hidden');

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

// ========== TIMER ANIMATION ==========
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
