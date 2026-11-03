# iDetect: AI based FA & Proctoring System

iDetect is a browser-based face authentication and online traffic-rules
proctoring demo. It uses client-side TensorFlow.js and face-api.js models,
so the camera and verification data stay in the user's browser session.

## Flow

1. Capture one reference face image.
2. Run authentication checks for spoofing, smiling, and blinking.
3. Start the traffic-rules proctoring exam after authentication succeeds.
4. Answer 20 randomized questions selected from a 30-question bank.
5. Pass with at least 10 correct answers.

## Proctoring checks

During the exam, iDetect checks:

- Absence or no face
- Multiple people in the camera frame
- Identity mismatch against the captured reference

Five violations fail the exam. Evidence frames are shown in the page and can
be exported with the score and violation details as an Excel-compatible report.

Blink monitoring, spoof monitoring, and voice monitoring are intentionally
disabled during proctoring. The exam checks only absence, identity mismatch,
and multiple people.

## Run locally

The browser must load model files over HTTP or HTTPS. Opening the HTML files
directly with `file://` will be blocked by browser security rules.

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/index.html`.

## Deploy to Netlify

Push the project to GitHub and connect the repository to Netlify. The project
is a static site; use the repository root as the publish directory and leave
the build command empty. The included `netlify.toml` configures the publish
directory, model caching, and camera/microphone permissions.

## Privacy

The reference image is stored in `sessionStorage` only for the active browser
session. It is cleared when the exam finishes or the user exits the exam.
Camera and microphone access are requested only when the relevant flow starts.

## Git commit message

```text
feat: add iDetect AI authentication and proctoring demo
```
