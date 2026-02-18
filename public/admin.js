const socket = io();

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('admin-password');
const questionsContainer = document.getElementById('questions-container');
const answersList = document.getElementById('answers-list');
const teamCountSpan = document.getElementById('team-count');
const timerDisplay = document.getElementById('timer-display');
const investStats = document.getElementById('invest-stats');

function login() {
    const password = passwordInput.value;
    localStorage.setItem('adminPass', password);
    socket.emit('admin_login', password, (response) => {
        if (response.success) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });
}

// Auto-Login on page load
window.addEventListener('load', () => {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        const storedPass = localStorage.getItem('adminPass');
        if (storedPass) {
            passwordInput.value = storedPass;
            login();
        }
    }
});

// ========== GAME OVER ==========
socket.on('game_over', (data) => {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('leaderboard-screen').classList.remove('hidden');

    // Render Leaderboard
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    data.leaderboard.forEach((entry, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${entry.team}</td>
            <td>${entry.score}</td>
        `;
        tbody.appendChild(tr);
    });

    // Render Detailed History
    const detailsBody = document.getElementById('details-body');
    if (detailsBody && data.history) {
        detailsBody.innerHTML = '';
        data.history.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #444;">${item.time}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444;">${item.team}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444;">${item.question}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: ${item.invested ? '#ff9800' : '#888'};">
                    ${item.invested ? '📈 Yes' : '🛡️ No'}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #444;">${item.answer}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: #aaa;">${item.correctAnswer}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: #ff9800;">${item.multiplier}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; font-weight: bold;">${item.score}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: ${item.isCorrect ? '#4CAF50' : '#f44336'};">
                    ${item.isCorrect ? 'Correct' : 'Wrong'}
                </td>
            `;
            detailsBody.appendChild(tr);
        });
    }
});

// ========== DASHBOARD INIT ==========
function initDashboard() {
    questionsContainer.innerHTML = '';
    questionsList.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'q-card';
        div.innerHTML = `<strong>Q${index + 1}</strong><br>${q.jumbled}`;
        div.onclick = () => startQuestion(q.id);
        questionsContainer.appendChild(div);
    });
}

const startBtn = document.getElementById('start-btn');
const currentQDisplay = document.getElementById('current-question-display');
let currentQuestionId = null;
const doneQuestions = new Set(); // track completed question IDs

function startQuestion(id) {
    // Set question on server (triggers invest phase)
    socket.emit('set_question', id);
    currentQuestionId = id;

    const q = questionsList.find(q => q.id === id);
    if (q && currentQDisplay) currentQDisplay.innerText = `Selected: ${q.jumbled}`;

    if (startBtn) {
        startBtn.disabled = false;
        startBtn.style.backgroundColor = '#4CAF50';
    }

    // Highlight active question card
    document.querySelectorAll('.q-card').forEach(card => card.classList.remove('active'));
    const cardIndex = questionsList.findIndex(q => q.id === id);
    if (cardIndex !== -1) {
        questionsContainer.children[cardIndex].classList.add('active');
    }

    // Clear previous answers and reset invest stats
    answersList.innerHTML = '';
    timerDisplay.innerText = '01:00';
    timerDisplay.style.color = '#e0e0e0';
    if (investStats) investStats.innerText = '📊 Invested: 0 / 0';
}

function startTimerNow() {
    socket.emit('start_timer_now');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.backgroundColor = '#555';
    }
    // Timer display is driven by the 'timer_started' socket event below
}

function stopTimer() {
    socket.emit('stop_timer');
    if (startBtn) {
        startBtn.disabled = false;
    }
}

function finishTest() {
    if (confirm("Are you sure you want to finish the test? This will show the leaderboard.")) {
        socket.emit('finish_test');
    }
}

// ========== SOCKET EVENTS ==========
socket.on('update_teams', (teams) => {
    teamCountSpan.innerText = teams.length;
});

// Timer started — run admin countdown
socket.on('timer_started', (data) => {
    startAdminTimer(data.endTime);
});

// Time up — mark question as done and reset timer
socket.on('time_up', () => {
    if (adminTimerInterval) clearInterval(adminTimerInterval);
    timerDisplay.innerText = '00:00';
    timerDisplay.style.color = '#f44336';

    // Mark current question as done
    if (currentQuestionId !== null) {
        doneQuestions.add(currentQuestionId);
        const cardIndex = questionsList.findIndex(q => q.id === currentQuestionId);
        if (cardIndex !== -1 && questionsContainer.children[cardIndex]) {
            const card = questionsContainer.children[cardIndex];
            card.classList.remove('active');
            card.classList.add('done');
            // Add checkmark if not already present
            if (!card.querySelector('.done-check')) {
                card.innerHTML += '<span class="done-check"> ✓</span>';
            }
        }
    }

    // Re-enable start button for next question
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.backgroundColor = '#555';
    }
});

// Invest updates
socket.on('admin_invest_update', (data) => {
    if (investStats) {
        investStats.innerText = `📊 Invested: ${data.investCount} / ${data.totalTeams} (${data.totalDecided} decided)`;
    }
});

// Live answer feed
socket.on('admin_answer_update', (data) => {
    console.log('Event received: admin_answer_update', data);
    const li = document.createElement('li');
    const investTag = data.invested ? '📈' : '🛡️';
    const scoreText = data.isCorrect ? `+${data.score}` : '0';
    const multiplierText = data.invested && data.isCorrect ? `(${data.multiplier}×)` : '';

    li.innerHTML = `
        <span>${investTag} ${data.teamName}</span>
        <span class="${data.isCorrect ? 'correct' : 'incorrect'}">
            ${data.answer} ${data.isCorrect ? '✔' : '✘'} ${scoreText}pts ${multiplierText}
        </span>
    `;
    answersList.prepend(li);
});

// Tab switch warnings
socket.on('admin_tab_warning', (data) => {
    const li = document.createElement('li');
    li.style.backgroundColor = '#440000';
    li.style.border = '1px solid red';
    li.innerHTML = `
        <span style="color: red; font-weight: bold;">⚠️ CHEAT WARNING</span>
        <span style="color: #ffcccc;">${data.teamName} switched tabs!</span>
    `;
    answersList.prepend(li);
});

// Admin state restore on reconnect
socket.on('admin_restore_state', (data) => {
    if (data.answers) {
        data.answers.forEach(item => {
            const li = document.createElement('li');
            const investTag = item.invested ? '📈' : '🛡️';
            li.innerHTML = `
                <span>${investTag} ${item.teamName}</span>
                <span class="${item.isCorrect ? 'correct' : 'incorrect'}">
                    ${item.answer} ${item.isCorrect ? '✔' : '✘'} +${item.score || 0}pts
                </span>
            `;
            answersList.prepend(li);
        });
    }
});

// Admin timer display
let adminTimerInterval;
function startAdminTimer(endTime) {
    if (adminTimerInterval) clearInterval(adminTimerInterval);
    timerDisplay.style.color = '#4CAF50';

    adminTimerInterval = setInterval(() => {
        const now = Date.now();
        const left = Math.ceil((endTime - now) / 1000);

        if (left <= 0) {
            clearInterval(adminTimerInterval);
            timerDisplay.innerText = "00:00";
            timerDisplay.style.color = '#f44336';
            return;
        }

        // Color-code: green > 20s, orange > 10s, red <= 10s
        if (left <= 10) timerDisplay.style.color = '#f44336';
        else if (left <= 20) timerDisplay.style.color = '#ff9800';
        else timerDisplay.style.color = '#4CAF50';

        const mins = Math.floor(left / 60);
        const secs = left % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 500);
}
