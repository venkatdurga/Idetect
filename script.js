let model, classifier, canvas, ctx, videoWidth, videoHeight;
let blinkCount = 0;
let smileCounter = 0;
let isSpoofingChecked = false;
let isGenuine = false;
let eyesClosed = 0;
let maxSmileCount = 5;
const maxSpoofChecks = 15;
const minRealChecks = 8;
let realFaceCount = 0;
let spoofFaceCount = 0;
let totalChecks = 0;
let facemeshModel; // Declare variables outside the setupPage function
let messageElement = document.getElementById("matchMessage");
const continueButton = document.getElementById('proceedButton');
let faceapivideo;
let labeledFaceDescriptors;
let faceMatcher;
let isLabeledImagesLoaded = false;
let isModelsLoaded = false;
let localstream;
let messageToShown;
let authenticate;
let faceauthMdl;
let videoForSFMatch;
let canvasForSFMatch;
let displaySizeForSFMatch;
var naturalExp = true;
var smileExp = true;
var matchCount = 0;
let maxTimeCount = 0;
let maxTime;
const returnObject = { isMatch: false, message: ``, nextExp: `Show your face for authentication` };
let distanceThreshold = 60;
let pythonServerApi;
var apiSwitchFlag;
const xhttpSync = new XMLHttpRequest();
let originalBase64Image;
let userDetailsFA;
let lastSpoofCheckTime = 0;
let spoofInferenceRunning = false;
let referenceDescriptor;
let matchInProgress = false;
let authMultipleFaceAlertShown = false;
let blinkAnimationId;
let matchingStarted = false;
var returnPhoto;

function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
        promise,
        new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error(message)), timeoutMs);
        })
    ]);
}

async function loadModels(faceauthmodel) {
    faceauthMdl = faceauthmodel;
    console.log("faceapi ::: " + faceauthmodel + "    " + faceauthMdl);
    await waitToLoadFaceApi();
    await Promise.all([
        faceapi.nets.faceLandmark68Net.loadFromUri(faceauthmodel),
        faceapi.nets.faceRecognitionNet.loadFromUri(faceauthmodel),
        faceapi.nets.faceExpressionNet.loadFromUri(faceauthmodel),
        faceapi.nets.tinyFaceDetector.loadFromUri(faceauthmodel)
    ]);
    isModelsLoaded = true;
}

function waitToLoadFaceApi() {
    return new Promise((resolve, reject) => {
        let waitToLoadFaceApiInterval = setInterval(() => {
            if (typeof faceapi !== 'undefined') {
                clearInterval(waitToLoadFaceApiInterval);
                resolve();
            }
        }, 100)
    })
}

var aware = {
    reStart: async () => {
        return new Promise(async (resolve, reject) => {
            smileExp = true;
            matchCount = 0;
            maxTimeCount = 0;
            returnObject.isMatch = false;
            returnObject.message = ``;
            returnObject.nextExp = `Show your face for authentication.`;
            startCamera().catch((error) => {
                messageToShown.innerText = `Camera access failed: ${error.message}`;
                reject(error);
            });
            resolve();
        })
    },
    match: () => {
        return new Promise(async (resolve, reject) => {
            try {
                if (matchInProgress) {
                    reject(new Error("Face matching is already in progress."));
                    return;
                }
                matchInProgress = true;
                console.log("Starting face match function");

                // Retrieve the reference image only from this browser session.
                const referenceImageBase64 = sessionStorage.getItem("referenceImage");
                if (!referenceImageBase64) {
                    reject("No reference image found. Please capture a reference image first.");
                    return;
                }

                // Convert base64 to image object
                if (!referenceDescriptor) {
                    const referenceImage = new Image();
                    referenceImage.src = referenceImageBase64;
                    await new Promise((resolveImage, rejectImage) => {
                        referenceImage.onload = resolveImage;
                        referenceImage.onerror = () => rejectImage(new Error("Reference image could not be loaded."));
                    });

                    const referenceDetections = await faceapi
                        .detectSingleFace(referenceImage, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptor();
                    if (!referenceDetections) {
                        throw new Error("No face detected in the reference image.");
                    }
                    referenceDescriptor = referenceDetections.descriptor;
                }

                // Process video feed for face descriptor
                const videoDetections = await withTimeout(faceapi
                    .detectAllFaces(videoForSFMatch, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors(), 15000, "Face matching timed out. Please try again.");
                if (videoDetections.length !== 1) {
                    throw new Error(videoDetections.length === 0
                        ? "No face detected in the video feed."
                        : `${videoDetections.length} people detected in the video feed.`);
                }
                const videoDescriptor = videoDetections[0].descriptor;

                // Match the descriptors using face-api's FaceMatcher
                const faceMatcher = new faceapi.FaceMatcher(referenceDescriptor, 0.6); // 0.6 is the threshold
                const matchResult = faceMatcher.findBestMatch(videoDescriptor);

                console.log("Matching result:", matchResult);

                if (matchResult.label === "person 1") {
                    // Set message in green

                    messageElement.textContent = "Face matched! Click on Proceed to validate your credentials.";
                    messageElement.style.color = "green"; // Green color for success
                    resolve({
                        isMatch: true,
                        message: "Face matched! Click on Proceed to validate your credentials.",
                    });
                } else {
                    // Set message in red
                    messageElement.textContent = "Face not matched. Sorry, no match detected, please retry again.";
                    messageElement.style.color = "red"; // Red color for failure
                    resolve({
                        isMatch: false,
                        message: "Face not matched. Sorry, no match detected, please retry again.",
                    });
                }
            } catch (error) {
                messageElement.textContent = error.message;
                messageElement.style.color = "#fb7185";
                reject(`An error occurred: ${error.message}`);
            } finally {
                matchInProgress = false;
            }
        });
    },
    clearCanvas: () => {
        canvasForSFMatch.getContext('2d').clearRect(0, 0, canvasForSFMatch.offsetWidth, canvasForSFMatch.offsetHeight);
    },
    start: (base64Image, videoId, message, maxTimeParams, distanceThresholdPercentage, pythonServerApiPM, userDetailsFAPM, apiSwitchFlag) => {
        if (window.location.protocol === 'file:') {
            const errorMessage = 'Please open this demo through http://localhost:8000, not directly from a file.';
            const statusElement = document.getElementById(message);
            if (statusElement) {
                statusElement.innerText = errorMessage;
            }
            return Promise.reject(new Error(errorMessage));
        }

        console.log("face-awre ffile " + pythonServerApiPM);
        console.log("face-awre ffile");
        return new Promise((resolve, reject) => {
            videoForSFMatch = document.getElementById(videoId);
            messageToShown = document.getElementById(message);
            canvas = document.getElementById('output');
            maxTime = maxTimeParams;
            pythonServerApi = pythonServerApiPM;
            originalBase64Image = base64Image;
            console.log("originalBase64Image ::: " + originalBase64Image);
            userDetailsFA = userDetailsFAPM;
            apiSwitchFlag = apiSwitchFlag;
            let minPer = 50;
            distanceThreshold = (minPer + (distanceThresholdPercentage / 10));
            loadModels('./models').catch((error) => {
                console.error('Face model loading failed:', error);
                messageToShown.innerText = 'Could not load face models. Check the local server and models folder.';
            });
            startCamera();
            let waitToLoadModel = setInterval(async () => {
                if (isModelsLoaded) {
                    clearInterval(waitToLoadModel);
                }
            }, 10);

            videoForSFMatch.addEventListener('loadeddata', async () => {
                console.log('Video data loaded');
                videoWidth = videoForSFMatch.width || 640;
                videoHeight = videoForSFMatch.height || 480;
                videoForSFMatch.width = videoWidth;
                videoForSFMatch.height = videoHeight;

                canvas = document.getElementById('output');
                canvas.width = videoWidth
                canvas.height = videoHeight
                ctx = canvas.getContext('2d');

                // Load all models and wait for them to finish loading
                const modelLoadPromises = [
                    blazeface.load(), // Load BlazeFace for face detection
                    tf.loadLayersModel('./new_spoof/newmod/model.json'), // Load spoof detection model
                ];

                // Wait until all models are loaded
                const [blazeFaceModel, classifierModel] = await Promise.all(modelLoadPromises);

                // Assign models after loading
                model = blazeFaceModel
                console.log('face detection model is loaded')
                classifier = classifierModel;
                console.log('Spoof detection model is loaded')
                facemeshModel = await loadFaceLandmarkDetectionModel();
                // Start the prediction loop after all models are loaded
                document.getElementById('message').innerHTML = "Spoof Detection Started. Please Stay still";
                startSpoofDetection();  // Start with spoof detection first
            });
        })
    },
    stop: () => {
        stopCamera();
    }
}


function enableButton(button) {
    button.disabled = false;
    button.classList.remove('disabled');
    button.classList.add('enabled');
}

function disableButton(button) {
    button.disabled = true;
    button.classList.remove('enabled');
    button.classList.add('disabled');
}


const startCamera = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return Promise.reject(new Error('Camera access requires a secure HTTPS connection.'));
    }

    return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            localstream = stream;
            videoForSFMatch.srcObject = stream;
            return stream;
        })
        .catch(err => {
            console.error(err);
            throw err;
        });
}

const stopCamera = () => {
    if (localstream) {
        localstream.getTracks().forEach(track => track.stop());
        localstream = null;
    }
    if (videoForSFMatch) {
        videoForSFMatch.srcObject = null;
        videoForSFMatch.pause();
    }
}
function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, time);
    })
}

async function loadFaceLandmarkDetectionModel() {
    return faceLandmarksDetection.load(faceLandmarksDetection.SupportedPackages.mediapipeFacemesh, { maxFaces: 1 });
}

let spoofDetectionInterval; // To store interval ID

const startSpoofDetection = async () => {
    spoofDetectionInterval = setInterval(async () => {
        if (spoofInferenceRunning) {
            return;
        }
        spoofInferenceRunning = true;
        try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const predictions = await model.estimateFaces(videoForSFMatch, false);

            if (predictions.length !== 1) {
                isGenuine = false;
                totalChecks = 0;
                realFaceCount = 0;
                spoofFaceCount = 0;
                spoofCheckResults = [];
                clearInterval(spoofDetectionInterval);
                spoofDetectionInterval = null;
                document.getElementById('message').innerHTML = predictions.length === 0
                    ? "No face detected. Verification stopped."
                    : "Multiple faces detected. Verification stopped.";
                if (predictions.length > 1 && !authMultipleFaceAlertShown) {
                    authMultipleFaceAlertShown = true;
                    alert(`${predictions.length} people are in the video frame. Authentication stopped.`);
                }
                return;
            }

            // Exactly one face is required for spoof detection.
            if (predictions.length === 1) {
                for (const prediction of predictions) {
                    const videoWidth = videoForSFMatch.videoWidth;
                    const videoHeight = videoForSFMatch.videoHeight;

                    // Normalize coordinates
                    const normalize = (coords, videoSize, canvasSize) => {
                        return coords.map((coord, i) => (coord / videoSize[i]) * canvasSize[i]);
                    };

                    // Face coordinates based on video resolution
                    const start = normalize(prediction.topLeft, [videoWidth, videoHeight], [640, 480]);
                    const end = normalize(prediction.bottomRight, [videoWidth, videoHeight], [640, 480]);

                    // Get the original face width and height
                    const faceWidth = end[0] - start[0];
                    const faceHeight = end[1] - start[1];

                    // Calculate face area
                    const faceArea = faceWidth * faceHeight;
                    const videoArea = videoWidth * videoHeight;
                    const faceOccupancy = faceArea / videoArea;
                    console.log(faceOccupancy);
                    // Use scaling for cropping
                    const mid = [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
                    const scale = 1.1;
                    const sizeNew = Math.max(faceWidth, faceHeight) * scale;
                    const startNew = [mid[0] - (sizeNew * 0.5), mid[1] - (sizeNew * 0.5)];

                    // Spoof detection based on face size (40% threshold)
                    let label = 'Spoof'; // Default to 'Spoof' unless proven otherwise
                    if (faceOccupancy >= 0.08 && faceOccupancy <= 0.16) {
                        // If the face occupies 40% or more, proceed with further checks
                        const videoCrop = getImage(videoForSFMatch, sizeNew, startNew);
                        const logits = tf.tidy(() => {
                            return classifier.predict(tf.image.resizeBilinear(
                                tf.browser.fromPixels(videoCrop),
                                [224, 224]
                            ).expandDims(0).toFloat().div(255));
                        });

                        const prediction = (await logits.data())[0];
                        logits.dispose();
                        label = prediction < 0.90 ? 'Spoof' : 'Real';
                        document.getElementById('message').innerHTML = "Spoof detection is under processing";
                    } else {
                        if (faceOccupancy > 0.16) {
                            console.log("Face too large, considered Spoof based on size. Occupancy: ", faceOccupancy);
                            document.getElementById('message').innerHTML = "Face is too close to the camera. Please move back a little.";
                        } else {
                            console.log("Face too small, considered Spoof based on size. Occupancy: ", faceOccupancy);
                            document.getElementById('message').innerHTML = "Face is too far from the camera. Please move closer.";
                        }
                    }

                    // Update box color based on label
                    if (label === 'Real') {
                        ctx.strokeStyle = "green"; // Green for real face
                        realFaceCount++;
                    } else {
                        ctx.strokeStyle = "red"; // Red for spoof
                        spoofFaceCount++;
                    }

                    totalChecks++;
                    ctx.lineWidth = "4";

                    // Draw the original bounding box based on face width and height (not sizeNew)
                    ctx.strokeRect(start[0], start[1], faceWidth, faceHeight);

                    // Display the label on the bounding box
                    ctx.fillStyle = "red";
                    const fontSize = "24px sans-serif";
                    ctx.font = fontSize;
                    ctx.fillRect(start[0], start[1] - 30, 80, 30);
                    ctx.fillStyle = "white";
                    ctx.fillText(label, start[0], start[1] - 5);

                    // Stop the process after 20 checks
                    if (totalChecks >= maxSpoofChecks) {
                        if (realFaceCount >= minRealChecks) {
                            // If enough real detections, proceed to smile detection
                            isGenuine = true;
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            // clearInterval(spoofDetectionInterval);
                            document.getElementById('message').innerHTML = "Genuine face detected. Please Stay still, Smile Detection is in process..";
                            console.log("Spoof detection completed.");
                            clearInterval(spoofDetectionInterval);
                            startSmileDetection();
                        } else {
                            // If less than 15 real detections or more spoofs than real, stop and flag as spoof
                            isGenuine = false;
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            clearInterval(spoofDetectionInterval);
                            document.getElementById('message').innerHTML = "Spoof detected. Face verification failed.";
                            console.log("Spoof detected, stopping further process.");
                        }
                    }
                }
            } else {
                document.getElementById('message').innerHTML = "No face detected.";
            }

        } finally {
            spoofInferenceRunning = false;
        }
    }, 500);
};



// Smile Detection after Spoof Detection
const startSmileDetection = async () => {
    const smileDetectionInterval = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(videoForSFMatch, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
        document.getElementById('message').innerHTML = "Smile Detection is in process, Please smile for 10 Secs";
        const displaySize = { width: videoWidth, height: videoHeight };
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        detections.forEach(detection => {
            if (detection.expressions.happy > 0.5) { // Adjust threshold as needed
                smileCounter++;
                document.getElementById('message').innerHTML = "# of times smile detected: " + smileCounter;
            }
        });

        // Stop smile detection after reaching max count or timeout
        if (smileCounter >= maxSmileCount) {
            clearInterval(smileDetectionInterval);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            console.log("Smile detection completed.");
            document.getElementById('message').innerHTML = "Eye Blink Detection is in process, Please blink your eyes 5 times.";
            startBlinkDetection();  // Start eye blink detection after smile detection
        }
    }, 500);
};

const startBlinkDetection = async () => {
    if (matchingStarted) {
        return;
    }
    if (blinkCount <= 5) {
        if (facemeshModel) {
            const predictions = await facemeshModel.estimateFaces({ input: videoForSFMatch });
            ctx.drawImage(videoForSFMatch, 0, 0, videoWidth, videoHeight, 0, 0, videoWidth, videoHeight);
            detectBlinkingEyes(predictions);
        } else {
            console.error('FaceMesh model not loaded yet.');
        }
        blinkAnimationId = requestAnimationFrame(startBlinkDetection); // Continue checking for blinks
    } else {
        // Blink detection completed
        document.getElementById('message').innerText = "Eye blink process is finished.";
        // Check conditions to proceed to face matching
        if (blinkCount >= 5 && smileCounter >= maxSmileCount && isGenuine) {

            console.log("Starting face matching...");
            document.getElementById('message').innerText = "Starting face matching...";
            matchingStarted = true;
            if (blinkAnimationId) {
                cancelAnimationFrame(blinkAnimationId);
            }
            await aware.match().then((result) => {
                // document.getElementById('message').innerHTML = result.message;
                document.getElementById('message').innerText = "Matching Finished";
                if (result.isMatch) {
                    console.log("Face matched successfully!");
                    document.getElementById('message').innerText = "Face matched. Click Proceed to start proctoring.";
                    enableButton(proceedButton);
                } else {
                    console.error("Face matching failed.");
                }
            }).catch((error) => {
                console.error("Error during face matching:", error);
                matchingStarted = false;
                document.getElementById('message').innerText = error.message || String(error);
            });
        } else {
            console.log("Conditions for face matching not met.");
        }
    }

};


// Call this function to detect blinking eyes and update blink count
const detectBlinkingEyes = (predictions) => {
    ctx.fillStyle = "red";
    predictions.forEach(prediction => {
        const keypoints = prediction.keypoints;

        // Get key points for eyes
        const rightEyeUpper0 = prediction.annotations.rightEyeUpper0;
        const rightEyeLower0 = prediction.annotations.rightEyeLower0;
        const leftEyeUpper0 = prediction.annotations.leftEyeUpper0;
        const leftEyeLower0 = prediction.annotations.leftEyeLower0;

        // Calculate distances for eye closure
        const eyeOutlinePoints = rightEyeUpper0.concat(rightEyeLower0, leftEyeUpper0, leftEyeLower0);
        let rightEyeCenterPointDistance = Math.abs(rightEyeUpper0[3][1] - rightEyeLower0[4][1]);
        let leftEyeCenterPointDistance = Math.abs(leftEyeUpper0[3][1] - leftEyeLower0[4][1]);

        // Check if eyes are closed
        if (rightEyeCenterPointDistance < 7 || leftEyeCenterPointDistance < 7) {
            eyesClosed = 1;
        }
        if (eyesClosed === 1 && (rightEyeCenterPointDistance > 9 || leftEyeCenterPointDistance > 9)) {
            blinkCount++;
            document.getElementById('message').innerHTML = "# of times blinked: " + blinkCount;
            eyesClosed = 0; // Reset after a blink is detected
        }

        eyeOutlinePoints.forEach(point => {
            ctx.beginPath();
            ctx.rect(point[0], point[1], 2, 2);
            ctx.fill();
        });
    });
};

// Utility function to extract image from video
const getImage = (videoForSFMatch, sizeImg, startImg) => {
    const canvasTemp = document.createElement('canvas');
    canvasTemp.height = sizeImg;
    canvasTemp.width = sizeImg;
    const ctxTemp = canvasTemp.getContext("2d");
    ctxTemp.clearRect(0, 0, sizeImg, sizeImg);
    ctxTemp.drawImage(videoForSFMatch, startImg[0], startImg[1], sizeImg, sizeImg, 0, 0, sizeImg, sizeImg);
    return canvasTemp;
};

proceedButton.addEventListener('click', () => {
    stopCamera();
    window.location.href = 'proctoring.html';
});
