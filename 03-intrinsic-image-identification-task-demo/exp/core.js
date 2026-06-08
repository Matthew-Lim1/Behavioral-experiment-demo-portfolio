// Experiment functions

const JSPSYCH_DISPLAY_ID = 'jspsych-target';

function ensureJsPsychDisplayElement() {
    if (typeof document === 'undefined') {
        return null;
    }
    let displayElement = document.getElementById(JSPSYCH_DISPLAY_ID);
    if (!displayElement) {
        displayElement = document.createElement('div');
        displayElement.id = JSPSYCH_DISPLAY_ID;
        displayElement.style.width = '100%';
        displayElement.style.height = '100%';
        displayElement.style.minHeight = '100vh';
        displayElement.style.margin = '0';
        displayElement.style.padding = '0';
        document.body.insertBefore(displayElement, document.body.firstChild);
    }
    return displayElement;
}

// Start experiment
function startExpt() {
    let startClock = performance.now();
    if (typeof window !== 'undefined') {
        window.__expStartTime = startClock;
    }
    const isRtDebugEnabled = (typeof showRtDebug !== 'undefined' && showRtDebug);
    const displayElement = isRtDebugEnabled ? ensureJsPsychDisplayElement() : null;
    jsPsych.init({
        timeline: timeline,
        display_element: displayElement || undefined,
        show_progress_bar: true,
        auto_update_progress_bar: false,
        on_trial_start: function () {
            ensureProgressBreakMarkers();
            if (isRtDebugEnabled && typeof setupRtDebugPanel === 'function') {
                setTimeout(function () {
                    setupRtDebugPanel();
                }, 0);
            }
        },
        preload_images: (typeof window !== 'undefined' && window.__rcPreloadImages) ? window.__rcPreloadImages : [],
        on_interactionData_update: function (data) {
            viewportWidth = get_viewport_size().width;
            viewportHeight = get_viewport_size().height;
            data.subj_id = subjName;
            data.screen_width = viewportWidth;
            data.screen_height = viewportHeight;
            console.log(JSON.stringify(data));
            if (forceFullscreen) {
                if (JSON.stringify(data).includes('blur') & data.trial > 1 & data.event!='fullscreenexit') {
                    if (confirm("Oops, you may have switched tabs, clicked outside of the browser, or exited full screen mode -- as a result, the experiment will now end.  You can refresh the browser to try again.")) {
                        location.reload();
                    }
                }
            }
        },
        on_finish: function () {
            let endClock = performance.now();
            let totalTime = endClock - startClock;
            console.log("Total time:", totalTime / 60000);
        }
    });
    if (!isRtDebugEnabled) {
        const panel = (typeof document !== 'undefined')
            ? document.getElementById(RT_DEBUG_PANEL_ID)
            : null;
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    } else if (typeof setupRtDebugPanel === 'function') {
        setTimeout(function () {
            setupRtDebugPanel();
        }, 0);
    }
    if (typeof jsPsych.setProgressBar === 'function') {
        jsPsych.setProgressBar(0);
    }
    scheduleProgressBreakMarkers();
}

function scheduleProgressBreakMarkers(attempt) {
    const currentAttempt = attempt || 0;
    if (ensureProgressBreakMarkers() || currentAttempt >= 20) {
        return;
    }
    setTimeout(function () {
        scheduleProgressBreakMarkers(currentAttempt + 1);
    }, 50);
}

function ensureProgressBreakMarkers() {
    if (typeof document === 'undefined') {
        return false;
    }
    const outer = document.getElementById('jspsych-progressbar-outer');
    if (!outer) {
        return false;
    }
    if (outer.querySelector('.progress-break-marker')) {
        return true;
    }
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (value, index) {
        const marker = document.createElement('div');
        marker.className = 'progress-break-marker';
        marker.style.left = (value * 100) + '%';
        marker.title = index === 0 ? 'Start of block 1' : (index < 4 ? 'Break after block ' + index : 'End of block 4');
        outer.appendChild(marker);
    });
    return true;
}

function setExperimentProgress(value) {
    ensureProgressBreakMarkers();
    if (typeof jsPsych !== 'undefined' && typeof jsPsych.setProgressBar === 'function') {
        jsPsych.setProgressBar(Math.max(0, Math.min(value, 1)));
    }
}

const PHASE_BADGE_ID = 'phase-indicator-badge';

// Phase badge
function updatePhaseBadge(phase) {
    if (typeof document === 'undefined') {
        return;
    }
    const existing = document.getElementById(PHASE_BADGE_ID);
    if (phase === null) {
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
        return;
    }
    const label = phase === 'practice' ? 'Practice' : (phase === 'main' ? 'Main Task' : phase || '');
    let badge = existing;
    if (!badge) {
        badge = document.createElement('div');
        badge.id = PHASE_BADGE_ID;
        badge.style.position = 'fixed';
        badge.style.top = '70px';
        badge.style.left = '10px';
        badge.style.zIndex = '9999';
        badge.style.padding = '10px 14px';
        badge.style.background = 'rgba(55, 55, 55, 0.9)';
        badge.style.color = '#fff';
        badge.style.fontFamily = 'Helvetica, Arial, sans-serif';
        badge.style.fontSize = '12px';
        badge.style.borderRadius = '10px';
        badge.style.pointerEvents = 'none';
        badge.style.lineHeight = '1.5';
        badge.style.minWidth = '150px';
        document.body.appendChild(badge);
    }
    const showLegend = phase === 'practice' || phase === 'main';
    if (showLegend) {
        badge.innerHTML = "<div class='phase-badge-label'>" + label + "</div>" +
            "<div class='phase-key-legend'>" +
            "<div class='phase-key-row'><span class='phase-keycap'>F</span><span>Left face</span></div>" +
            "<div class='phase-key-row'><span class='phase-keycap'>J</span><span>Right face</span></div>" +
            "</div>";
    } else {
        badge.textContent = label;
    }
}

// Rt debug
const RT_DEBUG_PANEL_ID = 'rt-debug-panel';
const RT_DEBUG_TIMER_ID = 'rt-debug-timer';

function setupRtDebugPanel() {
    if (typeof document === 'undefined' || !showRtDebug) {
        return;
    }
    let panel = document.getElementById(RT_DEBUG_PANEL_ID);
    if (panel) {
        return;
    }
    panel = document.createElement('div');
    panel.id = RT_DEBUG_PANEL_ID;
    panel.style.position = 'fixed';
    panel.style.top = '50px';
    panel.style.left = '10px';
    panel.style.zIndex = '10000';
    panel.style.background = 'rgba(255,255,255,0.95)';
    panel.style.border = '1px solid #333';
    panel.style.padding = '8px';
    panel.style.fontFamily = 'Helvetica, Arial, sans-serif';
    panel.style.fontSize = '12px';
    panel.style.maxHeight = '45vh';
    panel.style.overflow = 'auto';
    panel.innerHTML =
        "<div id='" + RT_DEBUG_TIMER_ID + "' style='font-weight:600; margin-bottom:6px;'>Total time elapsed: 0.000s</div>" +
        "<table style='border-collapse:collapse; width:100%;'>" +
        "<thead><tr>" +
        "<th style='text-align:left; padding-right:8px;'>Start (s)</th>" +
        "<th style='text-align:left; padding-right:8px;'>End (s)</th>" +
        "<th style='text-align:left;'>Delta (s)</th>" +
        "</tr></thead><tbody></tbody></table>";
    document.body.appendChild(panel);
    window.__rtDebugRows = {};
}

function getRtElapsedSeconds(nowMs) {
    const start = typeof window !== 'undefined' ? window.__expStartTime : null;
    if (typeof start !== 'number') {
        return 0;
    }
    const current = typeof nowMs === 'number' ? nowMs : performance.now();
    return (current - start) / 1000;
}

function updateRtDebugTimer(nowMs) {
    if (typeof document === 'undefined') {
        return;
    }
    const timer = document.getElementById(RT_DEBUG_TIMER_ID);
    if (!timer) {
        return;
    }
    timer.textContent = "Total time elapsed: " + getRtElapsedSeconds(nowMs).toFixed(3) + "s";
}

function logRtStart(trialId, startAtMs) {
    if (!showRtDebug || typeof document === 'undefined') {
        return;
    }
    setupRtDebugPanel();
    const panel = document.getElementById(RT_DEBUG_PANEL_ID);
    const tbody = panel ? panel.querySelector('tbody') : null;
    if (!tbody) {
        return;
    }
    const startMs = (typeof startAtMs === 'number') ? startAtMs : performance.now();
    const startSeconds = getRtElapsedSeconds(startMs);
    updateRtDebugTimer(startMs);

    const row = document.createElement('tr');
    const startCell = document.createElement('td');
    const endCell = document.createElement('td');
    const deltaCell = document.createElement('td');
    startCell.textContent = startSeconds.toFixed(3);
    endCell.textContent = '';
    deltaCell.textContent = '';
    startCell.style.paddingRight = '8px';
    endCell.style.paddingRight = '8px';

    row.appendChild(startCell);
    row.appendChild(endCell);
    row.appendChild(deltaCell);
    tbody.appendChild(row);

    if (typeof window !== 'undefined') {
        window.__rtDebugRows = window.__rtDebugRows || {};
        window.__rtDebugRows[trialId] = {
            startMs: startMs,
            startCell: startCell,
            endCell: endCell,
            deltaCell: deltaCell
        };
    }
}

function logRtEnd(trialId, keyPress) {
    if (!showRtDebug || typeof document === 'undefined') {
        return;
    }
    const record = (typeof window !== 'undefined' && window.__rtDebugRows) ? window.__rtDebugRows[trialId] : null;
    const endMs = performance.now();
    updateRtDebugTimer(endMs);
    if (!record) {
        return;
    }
    if (keyPress === null || typeof keyPress === 'undefined') {
        record.endCell.textContent = 'no response';
        record.deltaCell.textContent = '';
        return;
    }
    record.endCell.textContent = getRtElapsedSeconds(endMs).toFixed(3);
    record.deltaCell.textContent = ((endMs - record.startMs) / 1000).toFixed(3);
}

if (typeof window !== 'undefined') {
    window.updatePhaseBadge = updatePhaseBadge;
    window.setExperimentProgress = setExperimentProgress;
    window.ensureProgressBreakMarkers = ensureProgressBreakMarkers;
    window.scheduleProgressBreakMarkers = scheduleProgressBreakMarkers;
    window.setupRtDebugPanel = setupRtDebugPanel;
    window.logRtStart = logRtStart;
    window.logRtEnd = logRtEnd;
}

// Data saving
function saveData(name, data) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'write_data.php');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
        filename: name,
        filedata: data
    }));
}


// Demo notice
let demoNotice = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: "<h1>Portfolio demo</h1><p>This public demo omits the private study materials and research contact information.</p><p>Press SPACE to continue.</p>",
    data: {
        subj_id: subjName,
        test_part: 'demo_notice'
    }
};


// Debriefing form
let debriefText =
    "<div style='width: 50%; text-align: left; margin: 0 auto'><p style='text-align: center'>(You should have been returned to the normal size of your browser.)<br>Finally, we just have a couple questions for you!<br>Please note that you must answer <strong>ALL</strong> the questions before pressing the CONTINUE button below.</p>" +
    '<p>Age: <br><input name="age" type="number" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>What is your gender identity?<br><input type="radio" id="man" name="gender" value="man"><label for="man">Man</label><br><input type="radio" id="woman" name="gender" value="woman"><label for="woman">Woman</label><br><input type="radio" id="non" name="gender" value="non"><label for="non">Non-binary person</label><br><input type="radio" id="NA" name="gender" value="NA"><label for="NA">Prefer not to answer</label><br>' +
    '<p>Do you have lived experience as a trans person (meaning your gender identity does not align with your gender assigned at birth)?<br><input type="radio" id="trans_yes" name="trans_experience" value="yes"><label for="trans_yes">Yes</label><br><input type="radio" id="trans_no" name="trans_experience" value="no"><label for="trans_no">No</label><br><input type="radio" id="trans_na" name="trans_experience" value="NA"><label for="trans_na">Prefer not to answer</label><br>' +
    '<p>In 1-2 sentences, what do you think the experiment is about?<br><input name="what_about" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>Have you ever, to your knowledge, participated in an experiment similar to this one?  If yes, please describe this experiment in 1-2 sentences.  If no, please just type "No" in the text box.<br><input name="prev_exp" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>From the scale of 1-100, with 1 being "Not at all" and 100 being "Absolutely", how well do you think you were able to identify the more <b>lonely</b> face?<br><input name="lonely_identify" type="number" min="1" max="100" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>From the scale of 1-100, with 1 being "Not at all" and 100 being "Absolutely", how well do you think you were able to identify the more <b>sad</b> face?<br><input name="sad_identify" type="number" min="1" max="100" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>In 1-2 sentences, what do you think were the defining features you would look for when it came to detecting loneliness?<br><textarea name="lonely_features" rows="3" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></textarea>' +
    '<p>In 1-2 sentences, what do you think were the defining features you would look for when it came to detecting sadness?<br><textarea name="sad_features" rows="3" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></textarea>' +
    '<p>Did you find that your strategies might have changed over the course of the experiment?<br><textarea name="strategy_change" rows="3" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></textarea>' +
    '<p>Did you have any other strategies in the task?<br><textarea name="other_strategies" rows="3" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></textarea>' +
    '<p>Did you encounter any problems in the experiment? <br><input name="problems" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/></p>' +
    '<p>Anything else to share? <br><input name="addl" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/></p>' +
    '<p>On a scale of 1-100 (with 1 being not tired at all, and 100 being extremely tired), how tired do you feel right now?<br><input name="tired" type="number" min="1" max="100" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></p>' +
    '<p>We know it is generally difficult to stay focused in these online experiments.  On a scale of 1-100 (with 1 being very distracted, and 100 being very focused), how well did you pay attention to the experiment?  (This is only used for demo-quality checks.) <br><input name="attn" type="number" max="100" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></p></div>';

let debriefPrompt = [{
    html: debriefText,
    data: {
        subj_id: subjName,
        test_part: 'debrief'
    },
}];

let checkDebriefResponse = {
    type: 'survey-html-form',
    data: {
        subj_id: subjName,
        test_part: 'debrief',
        completion_code: completionCode
    },
    check_blanks: true,
    on_finish: function (data) {
        console.log("Responses:", data.responses);
        let respObj = JSON.parse(data.responses);
        data.resp_age = respObj["age"];
        data.resp_gender = respObj["gender"];
        data.resp_expt = respObj["what_about"];
        data.resp_experience = respObj["prev_exp"];
        data.resp_lonely_identify = respObj["lonely_identify"];
        data.resp_sad_identify = respObj["sad_identify"];
        data.resp_lonely_features = respObj["lonely_features"];
        data.resp_sad_features = respObj["sad_features"];
        data.resp_strategy_change = respObj["strategy_change"];
        data.resp_other_strategies = respObj["other_strategies"];
        data.resp_problems = respObj["problems"];
        data.resp_final = respObj["addl"];
        data.resp_attention = respObj["attn"];
        data.resp_tired = respObj["tired"];
        let interactionFileName = 'interactions_' + subjName;
        saveData(interactionFileName, jsPsych.data.getInteractionData().csv());
        saveData(subjName, jsPsych.data.get().csv());
        if (typeof setExperimentProgress === 'function') {
            setExperimentProgress(1);
        }
    },
    timeline: debriefPrompt
};


// Standard elements
let fixation = {
    type: 'html-keyboard-response',
    stimulus: '<div style="font-size:60px;">+</div>',
    choices: jsPsych.NO_KEYS,
    trial_duration: 500,
    data: {
        subj_id: subjName,
        test_part: 'fixation'
    }
};

let blank = {
    type: 'html-keyboard-response',
    stimulus: '<div style="font-size:60px;"></div>',
    choices: jsPsych.NO_KEYS,
    trial_duration: 500,
    data: {
        subj_id: subjName,
        test_part: 'blank'
    }
};

// Welcome prompt
let welcomePrompt = {
    type: 'demo-html-keyboard-response',
    wait_duration: 5000,
    choices: ['space'],
    stimulus: "<p>Hi! Thank you for volunteering to help out with our study.  Please take a moment to adjust your seating so that you can comfortably watch the monitor and use the keyboard.  Feel free to dim the lights as well.</p><p>Close the door or do whatever is necessary to minimize disturbance during the experiment.  Please also take a moment to silence your phone so that you are not interrupted by any messages mid-experiment.</p><p>Throughout this experiment, you will see greyed out text as in the last line below.</p><p>And a quick note: This text will contain the instructions for how to move to the next page -- which will typically involve pressing the spacebar.  You will not be able to press the spacebar until after a brief period of time has elapsed.  Please use that time to read the instructions on the given page.  Once the greyed out text has turned black, and you have finished reading the instructions, you will then be able to proceed by pressing the relevant key.",
    prompt: "Press SPACE to continue.",
    data: {
        subj_id: subjName,
        test_part: 'instruct_prompt'
    },
    on_finish: function () {
    }
};

let breakPrompt = function (progress, totalBlocks) {
    let block = {
        type: 'html-keyboard-response',
        choices: ['space'],
        stimulus: "You have completed " + progress +
            " out of " + totalBlocks + " blocks.<p>Take a break! But don't leave.<br>You can use this time to adjust your seat, stretch, etc.</p><p><strong>Press the spacebar to continue.</strong></p>",
        response_ends_trial: true,
        data: {
            subj_id: subjName,
            test_part: 'break_prompt'
        },
        on_start: function () {
            if (typeof setExperimentProgress === 'function') {
                const progressValue = 0.1 + (progress / totalBlocks) * 0.8;
                setExperimentProgress(progressValue);
            }
        },
        on_finish: function () {
            let fileName = 'partial_' + subjName;
            saveData(fileName, jsPsych.data.get().csv());
        }
    };
    return block;
};

let getCodePrompt = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: '<p>Great, you have completed this experiment.  Please press spacebar to proceed to the next page, and get your code.</p>',
    data: {
        subj_id: subjName,
        test_part: 'instruct_prompt'
    },
    on_finish: function (data) {
        saveData(subjName, jsPsych.data.get().csv());
    }
};

let showCodePrompt = {
    type: 'demo-html-keyboard-response',
    choices: ['space'],
    wait_duration: 3000,
    stimulus: '<div class="completion-code-screen"><p>Here is your completion code:</p><p class="completion-code-value">' + completionCode +
        '</p><p class="completion-email">Sent to: <a href="mailto:research-demo@example.com">research-demo@example.com</a></p>' +
        '<p class="completion-note">If you would like to see the results from your individual experiment, including what your internal representations of a sad face and a lonely face look like, please mention that in your email.</p></div>',
    prompt: 'Press SPACE to continue.',
    data: {
        subj_id: subjName,
        test_part: 'instruct_prompt'
    }
};

let closePrompt = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: '<p>Thank you for helping!  You are all set.  You can now close the window!</p>',
    data: {
        subj_id: subjName,
        test_part: 'instruct_prompt'
    },
    on_finish: function (data) {
        let interactionFileName = 'interactions_' + subjName;
        saveData(interactionFileName, jsPsych.data.getInteractionData().csv());
        saveData(subjName, jsPsych.data.get().csv());
    }
};


// Browser check
let check = false;

function getBrowserInfo() {
    let ua = navigator.userAgent,
        tem,
        M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return 'IE ' + (tem[1] || '');
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
        if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null)
        M.splice(1, 1, tem[1]);
    return {
        'browser': M[0],
        'version': M[1]
    };
};

function mobileAndTabletCheck() {
    (function (a) {
        if (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i
                .test(a) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
                .test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};


// Helper Functions
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function range(start, end) {
    return Array(end - start + 1).fill().map((_, idx) => start + idx)
};

function get_random_value(array) {
    return jsPsych.randomization.sampleWithoutReplacement(array, 1)[0]
};

function get_viewport_size() {
    let test = document.createElement("div");

    test.style.cssText = "position: fixed;top: 0;left: 0;bottom: 0;right: 0;";
    document.documentElement.insertBefore(test, document.documentElement.firstChild);

    let dims = {
        width: test.offsetWidth,
        height: test.offsetHeight
    };
    document.documentElement.removeChild(test);

    return dims;
};





