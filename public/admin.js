const socket = io();

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('admin-password');
const questionsContainer = document.getElementById('questions-container');
const answersList = document.getElementById('answers-list');
const teamCountSpan = document.getElementById('team-count');
const timerDisplay = document.getElementById('timer-display');

function login() {
    const password = passwordInput.value;
    localStorage.setItem('adminPass', password); // Save for refresh persistence
    socket.emit('admin_login', password, (response) => {
        if (response.success) {
            sessionStorage.setItem('adminLoggedIn', 'true'); // Persist Login
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });
}

// Auto-Login
if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    // We need to re-authenticate socket to get state, even if UI is bypassed
    // Or just show dashboard and wait for updates? 
    // Better to re-emit login to get the "restore_state" event.
    // We don't have the password saved... assume we trust the client? 
    // No, let's just ask them to login again OR save password (insecure but fine for offline tool).
    // Actually, for this specific "Offline Quiz", saving password in session is fine.

    // Let's just prompt them or rely on them staying valid? 
    // The server doesn't "session" sockets. New socket = New login needed for state restore.
    // So we MUST re-login.
}

// Better Auto-Login: Save logic
window.addEventListener('load', () => {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        const storedPass = localStorage.getItem('adminPass'); // helper
        if (storedPass) {
            passwordInput.value = storedPass;
            login();
        }
    }
});

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
                <td style="padding: 8px; border-bottom: 1px solid #444;">${item.answer}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: #aaa;">${item.correctAnswer}</td>
                <td style="padding: 8px; border-bottom: 1px solid #444; color: ${item.isCorrect ? '#4CAF50' : '#f44336'};">
                    ${item.isCorrect ? 'Correct' : 'Wrong'}
                </td>
            `;
            detailsBody.appendChild(tr);
        });
    }
});

function initDashboard() {
    // Render Questions
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

function startQuestion(id) {
    // Set question on server (Get Ready)
    socket.emit('set_question', id);

    // UI Update
    const q = questionsList.find(q => q.id === id);
    if (q && currentQDisplay) currentQDisplay.innerText = `Selected: ${q.jumbled}`;

    if (startBtn) {
        startBtn.disabled = false;
        startBtn.style.backgroundColor = '#4CAF50';
    }

    // Clear previous answers
    answersList.innerHTML = '';
}

function startTimerNow() {
    socket.emit('start_timer_now');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.backgroundColor = '#555';
    }
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

// Socket Events
socket.on('update_teams', (teams) => {
    teamCountSpan.innerText = teams.length;
});

socket.on('new_question', (data) => {
    // Update active question styling
    // Find the question card and highlight it
    // Reset timer display
    startAdminTimer(data.endTime);
});

socket.on('admin_answer_update', (data) => {
    console.log('Event received: admin_answer_update', data);
    const li = document.createElement('li');
    li.innerHTML = `
        <span>${data.teamName}</span>
        <span class="${data.isCorrect ? 'correct' : 'incorrect'}">
            ${data.answer} ${data.isCorrect ? '✔' : '✘'}
        </span>
    `;
    answersList.prepend(li);
});

socket.on('admin_tab_warning', (data) => {
    const li = document.createElement('li');
    li.style.backgroundColor = '#440000'; // Dark red for warning
    li.style.border = '1px solid red';
    li.innerHTML = `
        <span style="color: red; font-weight: bold;">⚠️ CHEAT WARNING</span>
        <span style="color: #ffcccc;">${data.teamName} switched tabs!</span>
    `;
    answersList.prepend(li);
    // Optional: Play alert sound?
});

socket.on('admin_restore_state', (data) => {
    if (data.answers) {
        data.answers.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.teamName}</span>
                <span class="${item.isCorrect ? 'correct' : 'incorrect'}">
                    ${item.answer} ${item.isCorrect ? '✔' : '✘'}
                </span>
            `;
            answersList.prepend(li);
        });
    }
});

let adminTimerInterval;
function startAdminTimer(endTime) {
    if (adminTimerInterval) clearInterval(adminTimerInterval);

    adminTimerInterval = setInterval(() => {
        const now = Date.now();
        const left = Math.ceil((endTime - now) / 1000);

        if (left <= 0) {
            clearInterval(adminTimerInterval);
            timerDisplay.innerText = "00:00";
            return;
        }

        timerDisplay.innerText = `00:${left.toString().padStart(2, '0')}`;
    }, 500);
}
