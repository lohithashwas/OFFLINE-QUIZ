// Ideally this comes from server, but for Admin UI display we can share it or fetch it.
// For simplicity, let's duplicate the static list here for Admin UI rendering. 
// Participants receive question text via Socket.

const questionsList = [
    { id: 1, jumbled: "PIRELP", answer: "RIPPLE" },
    { id: 2, jumbled: "OOREM", answer: "MOORE" },
    { id: 3, jumbled: "GEED", answer: "EDGE" },
    { id: 4, jumbled: "TICAST", answer: "STATIC" },
    { id: 5, jumbled: "EREPAM", answer: "AMPERE" },
    { id: 6, jumbled: "UPLOCER", answer: "COUPLER" },
    { id: 7, jumbled: "SIGNDEUN", answer: "UNSIGNED" },
    { id: 8, jumbled: "SACCOED", answer: "CASCODE" },
    { id: 9, jumbled: "GNIOEVRTIFT", answer: "OVERFITTING" },
    { id: 10, jumbled: "SENSIORERG", answer: "REGRESSION" }
];

