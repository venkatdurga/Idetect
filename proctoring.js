const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultElement = document.getElementById('result');
const messageElement = document.getElementById('message');
const questionElement = document.getElementById('question');
const optionsElement = document.getElementById('options');
const nextButton = document.getElementById('nextButton');
const exportButton = document.getElementById('exportButton');
const exitButton = document.getElementById('exitButton');
const questionBank = [
    ["What does a red traffic light mean?", ["Stop", "Speed up", "Turn only", "Reverse"], 0],
    ["What should you do at a stop sign?", ["Stop completely", "Slow slightly", "Sound the horn", "Park"], 0],
    ["Who has priority at a pedestrian crossing?", ["Pedestrians", "The fastest vehicle", "Parked cars", "Nobody"], 0],
    ["What is the safest following distance?", ["Enough space to stop safely", "One metre", "No gap", "Half a car length"], 0],
    ["What should you do when an ambulance approaches?", ["Give way safely", "Race it", "Block the lane", "Stop in the middle"], 0],
    ["What does a yellow traffic light usually tell you?", ["Stop if safe", "Accelerate", "Turn around", "Park"], 0],
    ["What is the purpose of a speed limit?", ["Set the maximum legal speed", "Set a minimum", "Suggest a race speed", "Mark parking"], 0],
    ["When should you use a seat belt?", ["Every trip", "Only highways", "Only at night", "Only in rain"], 0],
    ["What should you check before changing lanes?", ["Mirrors and blind spot", "Only the radio", "Fuel colour", "Horn volume"], 0],
    ["What does a no-entry sign mean?", ["Do not enter", "Enter quickly", "Parking allowed", "One-way toward you"], 0],
    ["What is defensive driving?", ["Anticipating hazards", "Driving aggressively", "Ignoring signs", "Following closely"], 0],
    ["Why should phones not be used while driving?", ["They distract the driver", "They save fuel", "They improve vision", "They cool the engine"], 0],
    ["What should you do in heavy rain?", ["Slow down and increase distance", "Use high speed", "Turn off lights", "Follow closely"], 0],
    ["What does a broken lane line generally allow?", ["Lane change when safe", "Immediate stopping", "U-turn anywhere", "Pedestrian crossing"], 0],
    ["What should you do near a school zone?", ["Slow down and watch for children", "Overtake buses", "Ignore crossings", "Use the horn continuously"], 0],
    ["What is a blind spot?", ["An area not visible in mirrors", "A broken headlight", "A dark road", "A parking sign"], 0],
    ["When is overtaking unsafe?", ["Near a blind bend", "On a clear straight road", "When fully visible", "When legal and safe"], 0],
    ["What should you do if dazzled by headlights?", ["Slow down and look toward the edge", "Look directly at them", "Accelerate", "Turn off all lights"], 0],
    ["What does a roundabout sign indicate?", ["Circular intersection", "Dead end", "Railway only", "No vehicles"], 0],
    ["What should you do before opening a roadside door?", ["Check for traffic and cyclists", "Open immediately", "Sound the horn", "Leave engine running"], 0],
    ["What is aquaplaning?", ["Tyres losing contact on water", "Engine overheating", "A broken mirror", "A parking method"], 0],
    ["What should you do if a tyre bursts?", ["Hold the wheel and slow gradually", "Brake hard", "Jump out", "Accelerate sharply"], 0],
    ["What does a blue parking sign provide?", ["Parking information", "A speed limit", "An animal warning", "No entry"], 0],
    ["Why adjust mirrors before driving?", ["To improve visibility", "To increase speed", "To reduce fuel", "To change route"], 0],
    ["What should you do at a railway crossing?", ["Stop if signals warn you", "Drive around barriers", "Park on tracks", "Race the train"], 0],
    ["What is safest when tired?", ["Stop and rest", "Open a window", "Drive faster", "Ignore it"], 0],
    ["What should a cyclist be given?", ["Safe space when passing", "No space", "A close warning", "Priority to the horn"], 0],
    ["What does a triangular warning sign indicate?", ["A hazard ahead", "Parking", "Mandatory direction", "A service station"], 0],
    ["What should you do if traffic lights are out?", ["Proceed cautiously and follow signs", "Assume green", "Speed through", "Park in the junction"], 0]
];
let referenceDescriptor, stream, monitorTimer, faceRunning = false;
let violations = [], questions, questionIndex = 0, score = 0, answered = false;
let lastNoFace = 0;
const MAX_VIOLATIONS = 5, TOTAL_QUESTIONS = 20;

const shuffle = list => [...list].sort(() => Math.random() - .5);

function prepareQuestions() {
    return shuffle(questionBank).slice(0, TOTAL_QUESTIONS).map(([text, options, correctIndex]) => {
        const correctAnswer = options[correctIndex];
        const shuffledOptions = shuffle(options);
        return [text, shuffledOptions, shuffledOptions.indexOf(correctAnswer)];
    });
}

function evidence() {
    if (!video.videoWidth) return '';
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .65);
}

function recordViolation(type, details) {
    const now = Date.now();
    if (violations.some(v => v.type === type && now - v.time < 3000)) return;
    const item = { type, details, time: now, image: evidence() };
    violations.push(item);
    document.getElementById('violationCount').textContent = violations.length;
    const row = document.createElement('li');
    row.textContent = `${new Date(now).toLocaleTimeString()} - ${details}`;
    document.getElementById('violations').prepend(row);
    if (item.image) {
        const evidenceImage = document.createElement('img');
        evidenceImage.src = item.image;
        evidenceImage.alt = `${type} evidence`;
        evidenceImage.width = 180;
        evidenceImage.className = 'evidence-image';
        document.getElementById('evidenceGallery').prepend(evidenceImage);
    }
    messageElement.textContent = `Violation ${violations.length}/${MAX_VIOLATIONS}: ${details}`;
    if (violations.length >= MAX_VIOLATIONS) finish(false, 'Exam failed due to multiple violations.');
}

function renderQuestion() {
    if (questionIndex >= TOTAL_QUESTIONS) return finish(score >= 10, score >= 10 ? 'Exam passed.' : 'Exam failed: minimum score is 10/20.');
    const [text, options] = questions[questionIndex];
    document.getElementById('progress').textContent = `Question ${questionIndex + 1} of ${TOTAL_QUESTIONS}`;
    questionElement.textContent = text; optionsElement.innerHTML = ''; document.getElementById('quizFeedback').textContent = '';
    nextButton.disabled = true; answered = false;
    options.forEach((text, index) => {
        const button = document.createElement('button'); button.className = 'option'; button.textContent = text;
        button.onclick = () => answer(index); optionsElement.appendChild(button);
    });
}

function answer(selected) {
    if (answered) return; answered = true;
    const correct = questions[questionIndex][2]; const buttons = [...optionsElement.children];
    buttons[selected].classList.add('selected');
    buttons.forEach(button => button.disabled = true); buttons[correct].classList.add('correct');
    if (selected === correct) { score++; document.getElementById('quizFeedback').textContent = 'Correct'; }
    else { buttons[selected].classList.add('wrong'); document.getElementById('quizFeedback').textContent = 'Wrong'; }
    document.getElementById('score').textContent = `Score: ${score}`; nextButton.disabled = false;
}
nextButton.onclick = () => { questionIndex++; renderQuestion(); };

function finish(passed, title) {
    if (monitorTimer) clearInterval(monitorTimer);
    document.getElementById('quizPanel').style.display = 'none';
    document.getElementById('finalResult').style.display = 'block';
    document.getElementById('finalTitle').textContent = title;
    document.getElementById('finalSummary').textContent = `Score: ${score}/${TOTAL_QUESTIONS}. Violations: ${violations.length}.`;
    exportButton.hidden = false; resultElement.textContent = passed ? 'Exam completed successfully.' : 'Exam failed.';
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    sessionStorage.removeItem('referenceImage');
    sessionStorage.removeItem('referenceCaptureActive');
}

function exportReport() {
    const rows = violations.map(v => `<tr><td>${new Date(v.time).toLocaleString()}</td><td>${v.type}</td><td>${v.details}</td><td>${v.image ? `<img src="${v.image}" width="180">` : ''}</td></tr>`).join('');
    const html = `<html><body><h1>Proctoring Report</h1><p>Score: ${score}/${TOTAL_QUESTIONS}</p><p>Result: ${score >= 10 && violations.length < MAX_VIOLATIONS ? 'PASS' : 'FAIL'}</p><table border="1"><tr><th>Time</th><th>Type</th><th>Details</th><th>Evidence</th></tr>${rows}</table></body></html>`;
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
    link.download = `proctoring-report-${Date.now()}.xls`; link.click(); URL.revokeObjectURL(link.href);
}
exportButton.onclick = exportReport;
exitButton.onclick = () => {
    if (monitorTimer) clearInterval(monitorTimer);
    if (stream) stream.getTracks().forEach(track => track.stop());
    sessionStorage.removeItem('referenceImage');
    sessionStorage.removeItem('referenceCaptureActive');
    window.location.href = 'index.html';
};

async function checkFaces() {
    if (faceRunning || !video.videoWidth) return; faceRunning = true;
    try {
        const faces = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: .5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        if (faces.length === 0) { if (!lastNoFace || Date.now() - lastNoFace > 8000) { recordViolation('no_face', 'No face detected'); lastNoFace = Date.now(); } }
        else if (faces.length > 1) { alert(`${faces.length} people are in the video frame.`); recordViolation('multiple_people', `${faces.length} people detected`); }
        else {
            lastNoFace = 0;
            const distance = faceapi.euclideanDistance(referenceDescriptor, faces[0].descriptor);
            if (distance > .6) recordViolation('other_person', 'A different person was detected');
        }
    } finally { faceRunning = false; }
}

async function start() {
    if (!sessionStorage.getItem('referenceImage')) {
        resultElement.textContent = 'Reference image is missing.';
        messageElement.textContent = 'Return to the capture page before starting proctoring.';
        return;
    }
    questions = prepareQuestions(); renderQuestion();
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;
        await video.play();
        resultElement.textContent = 'Camera ready. Loading proctoring models...';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        const referenceImage = new Image();
        referenceImage.src = sessionStorage.getItem('referenceImage');
        await new Promise((resolve, reject) => {
            referenceImage.onload = resolve;
            referenceImage.onerror = () => reject(new Error('Reference image could not be loaded.'));
        });
        const referenceFace = await faceapi.detectSingleFace(referenceImage, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        if (!referenceFace) throw new Error('No face found in the reference image.');
        referenceDescriptor = referenceFace.descriptor;
        resultElement.textContent = 'Identity monitoring active';
        monitorTimer = setInterval(checkFaces, 1200);
    } catch (error) { resultElement.textContent = 'Proctoring could not start.'; messageElement.textContent = error.message; }
}
window.addEventListener('beforeunload', () => { if (stream) stream.getTracks().forEach(track => track.stop()); });
start();
