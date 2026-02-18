// Ideally this comes from server, but for Admin UI display we can share it or fetch it.
// For simplicity, let's duplicate the static list here for Admin UI rendering. 
// Participants receive question text via Socket.

const questionsList = [
    { id: 1, jumbled: "SISROER", answer: "RESISTOR" },
    { id: 2, jumbled: "CAPOTAICR", answer: "CAPACITOR" },
    { id: 3, jumbled: "IDDOE", answer: "DIODE" },
    { id: 4, jumbled: "TRNASISTOR", answer: "TRANSISTOR" },
    { id: 5, jumbled: "INUDCOTR", answer: "INDUCTOR" },
    { id: 6, jumbled: "AMLFIEIRP", answer: "AMPLIFIER" },
    { id: 7, jumbled: "OSICLLATOR", answer: "OSCILLATOR" },
    { id: 8, jumbled: "MICORPRCSSEOR", answer: "MICROPROCESSOR" },
    { id: 9, jumbled: "FRQNUCEY", answer: "FREQUENCY" },
    { id: 10, jumbled: "VOTLGXE", answer: "VOLTAGE" },
    { id: 11, jumbled: "CURRNET", answer: "CURRENT" },
    { id: 12, jumbled: "MODUATLIN", answer: "MODULATION" },
    { id: 13, jumbled: "NANETAN", answer: "ANTENNA" },
    { id: 14, jumbled: "SGNIAL", answer: "SIGNAL" },
    { id: 15, jumbled: "CIRCIUT", answer: "CIRCUIT" },
    { id: 16, jumbled: "DIGITLA", answer: "DIGITAL" },
    { id: 17, jumbled: "GAOLAN", answer: "ANALOG" },
    { id: 18, jumbled: "BAWDIDTH", answer: "BANDWIDTH" },
    { id: 19, jumbled: "COMMUNICAITON", answer: "COMMUNICATION" },
    { id: 20, jumbled: "ELCETRONICS", answer: "ELECTRONICS" }
];
