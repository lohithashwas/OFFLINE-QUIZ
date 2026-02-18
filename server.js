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
let isInvestPhase = false;
let timerEndTime = 0;
let participantAnswers = {}; // { socketId: { teamName, answer, time } }
let teams = {}; // { socketId: teamName }
let fullAnswerHistory = []; // [ { team, question, answer, isCorrect, time, score } ]
let teamScores = {}; // { socketId: score }
let investedTeams = {}; // { socketId: true/false }
let submissionOrder = 0; // tracks answer submission position per question

// Scoring Config
const BASE_POINTS = 10;
const MAX_BONUS = 1; // A in the formula

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
            } else if (isInvestPhase) {
                socket.emit('invest_phase', {
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

    // Admin sets question (Invest Phase)
    socket.on('set_question', (questionId) => {
        console.log(`Command received: set_question(${questionId})`);
        const index = questions.findIndex(q => q.id === questionId);
        if (index !== -1) {
            currentQuestionIndex = index;
            participantAnswers = {};
            investedTeams = {};
            submissionOrder = 0;
            isTimerRunning = false;
            isInvestPhase = true;

            console.log(`Question set to Index: ${index}, Word: ${questions[index].jumbled}`);

            // Broadcast "Invest Phase" — participants choose invest or pass
            io.emit('invest_phase', {
                question: questions[index].jumbled
            });
        } else {
            console.error(`Question ID ${questionId} not found!`);
        }
    });

    // Participant submits invest/pass decision
    socket.on('submit_invest', (invested) => {
        const teamName = teams[socket.id];
        if (!teamName || !isInvestPhase) return;

        investedTeams[socket.id] = !!invested;
        console.log(`${teamName} chose to ${invested ? 'INVEST' : 'PASS'}`);

        const investCount = Object.values(investedTeams).filter(v => v).length;
        const totalDecided = Object.keys(investedTeams).length;
        const totalTeams = Object.keys(teams).length;

        io.emit('admin_invest_update', {
            investCount: investCount,
            totalDecided: totalDecided,
            totalTeams: totalTeams
        });
    });

    // Admin manually starts timer
    socket.on('start_timer_now', () => {
        console.log('Command received: start_timer_now');
        if (currentQuestionIndex !== -1) {
            const index = currentQuestionIndex;

            // End invest phase, reset submission order
            isInvestPhase = false;
            submissionOrder = 0;

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
            // Case Insensitive Check
            const isCorrect = answer.toUpperCase() === questions[currentQuestionIndex].answer.toUpperCase();
            const timestamp = new Date().toLocaleTimeString();
            const isInvested = !!investedTeams[socket.id];

            // Calculate score using stock multiplier
            let earnedScore = 0;
            let multiplier = 1;
            let position = 0;

            if (isCorrect) {
                submissionOrder++;
                position = submissionOrder;
                const N = Object.keys(teams).length;
                const T = Math.ceil(N / 2);

                if (isInvested) {
                    multiplier = 1 + MAX_BONUS * (1 - (position - 1) / T);
                    earnedScore = Math.round(BASE_POINTS * multiplier);
                } else {
                    earnedScore = BASE_POINTS;
                }
            }
            // Wrong answers = 0 points regardless

            participantAnswers[socket.id] = {
                teamName: teamName,
                answer: answer,
                time: Date.now(),
                isCorrect: isCorrect,
                invested: isInvested,
                score: earnedScore
            };

            // Track History
            fullAnswerHistory.push({
                team: teamName,
                question: questions[currentQuestionIndex].jumbled,
                answer: answer,
                correctAnswer: questions[currentQuestionIndex].answer,
                isCorrect: isCorrect,
                invested: isInvested,
                score: earnedScore,
                multiplier: isInvested ? multiplier.toFixed(2) : '-',
                position: position,
                time: timestamp
            });

            // Update cumulative score
            if (!teamScores[socket.id]) teamScores[socket.id] = 0;
            teamScores[socket.id] += earnedScore;

            // Send result back to the participant
            socket.emit('answer_result', {
                isCorrect: isCorrect,
                score: earnedScore,
                invested: isInvested,
                multiplier: isInvested ? multiplier.toFixed(2) : null,
                position: position
            });

            // Send to Admin
            io.emit('admin_answer_update', {
                teamName: teamName,
                answer: answer,
                isCorrect: isCorrect,
                invested: isInvested,
                score: earnedScore,
                multiplier: isInvested ? multiplier.toFixed(2) : '-',
                position: position
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
