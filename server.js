const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const questions = require('./questions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game State
let currentQuestionIndex = -1;
let isTimerRunning = false;
let timerEndTime = 0;
let participantAnswers = {}; // { socketId: { teamName, answer, time } }
let teams = {}; // { socketId: teamName }
let fullAnswerHistory = []; // [ { team, question, answer, isCorrect, time } ]
let teamScores = {}; // { socketId: score }

const PASSWORD = "123@123";

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Participant joins
    socket.on('join_game', (teamName) => {
        teams[socket.id] = teamName;
        io.emit('update_teams', Object.values(teams));
        // Send current state to new participant
        if (currentQuestionIndex !== -1) {
            if (isTimerRunning) {
                socket.emit('timer_started', {
                    question: questions[currentQuestionIndex].jumbled,
                    endTime: timerEndTime
                });
            } else {
                socket.emit('question_ready', {
                    question: questions[currentQuestionIndex].jumbled
                });
            }
        }
    });

    // Admin Login
    socket.on('admin_login', (password, callback) => {
        if (password === PASSWORD) {
            callback({ success: true });

            // Restore Admin State (Live Answers)
            const currentAnswers = Object.values(participantAnswers);
            socket.emit('admin_restore_state', {
                answers: currentAnswers
            });
        } else {
            callback({ success: false });
        }
    });

    // Admin starts question
    // Admin sets question (Get Ready)
    socket.on('set_question', (questionId) => {
        console.log(`Command received: set_question(${questionId})`);
        const index = questions.findIndex(q => q.id === questionId);
        if (index !== -1) {
            currentQuestionIndex = index;
            participantAnswers = {};
            isTimerRunning = false; // Reset timer state

            console.log(`Question set to Index: ${index}, Word: ${questions[index].jumbled}`);

            // Broadcast "Get Ready" state
            io.emit('question_ready', {
                question: questions[index].jumbled
            });
        } else {
            console.error(`Question ID ${questionId} not found!`);
        }
    });

    // Admin manually starts timer
    socket.on('start_timer_now', () => {
        console.log('Command received: start_timer_now');
        if (currentQuestionIndex !== -1) {
            const index = currentQuestionIndex;

            // Start Timer (60 seconds)
            const duration = 60 * 1000;
            timerEndTime = Date.now() + duration;
            isTimerRunning = true;

            console.log(`Starting timer for Question Index: ${index}`);

            io.emit('timer_started', {
                question: questions[index].jumbled,
                endTime: timerEndTime
            });

            // Server-side timeout to enforce end
            setTimeout(() => {
                if (currentQuestionIndex === index && isTimerRunning) {
                    isTimerRunning = false;
                    console.log(`Timer ended for Question Index: ${index}`);
                    io.emit('time_up');
                }
            }, duration);
        } else {
            console.warn('Attempted to start timer without selected question');
        }
    });

    // Participant submits answer
    socket.on('submit_answer', (answer) => {
        if (!isTimerRunning) {
            console.log(`[REJECTED] Answer from ${socket.id} - Timer NOT running`);
            return;
        }

        const teamName = teams[socket.id];
        if (!teamName) {
            console.log(`[REJECTED] Answer from ${socket.id} - No Team Name found`);
            socket.emit('error', 'Please rejoin with a team name');
            return;
        }

        if (teamName && !participantAnswers[socket.id]) {
            // Case Insensitive Check (User Request Update)
            const isCorrect = answer.toUpperCase() === questions[currentQuestionIndex].answer.toUpperCase();
            const timestamp = new Date().toLocaleTimeString();

            participantAnswers[socket.id] = {
                teamName: teamName,
                answer: answer,
                time: Date.now(),
                isCorrect: isCorrect
            };

            // Track History
            fullAnswerHistory.push({
                team: teamName,
                question: questions[currentQuestionIndex].jumbled,
                answer: answer,
                correctAnswer: questions[currentQuestionIndex].answer,
                isCorrect: isCorrect,
                time: timestamp
            });

            // Update Score
            if (isCorrect) {
                if (!teamScores[socket.id]) teamScores[socket.id] = 0;
                teamScores[socket.id] += 1; // 1 Mark per question
            }

            // Send to Admin only
            io.emit('admin_answer_update', {
                teamName: teamName,
                answer: answer,
                isCorrect: isCorrect
            });
        }
    });

    // Admin Finishes Test
    socket.on('finish_test', () => {
        // Calculate Leaderboard
        const leaderboard = Object.keys(teams).map(socketId => ({
            team: teams[socketId],
            score: teamScores[socketId] || 0
        })).sort((a, b) => b.score - a.score);

        io.emit('game_over', {
            leaderboard: leaderboard,
            history: fullAnswerHistory
        });
    });

    // Admin Stop Timer Manually
    socket.on('stop_timer', () => {
        isTimerRunning = false;
        io.emit('time_up');
    });

    // Handle Tab Switching Warning
    socket.on('tab_switch_alert', () => {
        const teamName = teams[socket.id];
        console.log(`Tab switch detected from: ${teamName} (${socket.id})`); // Debug log
        if (teamName) {
            io.emit('admin_tab_warning', { teamName: teamName });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (teams[socket.id]) {
            delete teams[socket.id];
            io.emit('update_teams', Object.values(teams));
        }
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Host Access: http://localhost:${PORT}/admin.html`);

    // Get Local IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIP = 'localhost';

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                localIP = net.address;
                console.log(`Participant Access: http://${localIP}:${PORT}`);
            }
        }
    }
});
