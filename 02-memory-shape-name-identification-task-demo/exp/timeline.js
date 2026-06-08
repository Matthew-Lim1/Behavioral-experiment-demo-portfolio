let timeline = []; // Main jsPsych timeline

var friend_name = 'Friend'; // Default friend label
const keyMatchCode = 74; // 'J' key; consumed by memory_shape_name_trial for match judgments
const keyMismatchCode = 70; // 'F' key; consumed by memory_shape_name_trial for mismatch judgments
let practice_should_repeat = false; // Controls practice retries

var identityOrder = ['you', 'friend', 'stranger']; // Shared identity list
const practiceProgressTarget = 0.25; // Practice progress target
const totalMainBlocks = 3;
const blockProgressBase = practiceProgressTarget;
const blockProgressWeight = 1 - blockProgressBase; // Progress left for main blocks

function shuffleWithConstraint(trials, keyFn, maxConsecutive) {
  // Shuffle with a repeat limit
  // Prevent too many identical trials in a row
  const attempts = 500;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const shuffled = jsPsych.randomization.shuffle(trials.slice());
    let consecutive = 0;
    let lastKey = null;
    let valid = true;
    for (let i = 0; i < shuffled.length; i++) {
      const currentKey = keyFn(shuffled[i]);
      if (currentKey === lastKey) {
        consecutive += 1;
      } else {
        consecutive = 1;
        lastKey = currentKey;
      }
      if (consecutive > maxConsecutive) {
        valid = false;
        break;
      }
    }
    if (valid) {
      return shuffled;
    }
  }
  console.warn('Unable to satisfy ordering constraint after multiple attempts.');
  return jsPsych.randomization.shuffle(trials.slice());
}

function formatFriendLabel() {
  // Uppercases the participant-supplied friend name; falls back to "FRIEND".
  const trimmed = (friend_name || '').trim();
  if (!trimmed) {
    return 'FRIEND';
  }
  return trimmed.toUpperCase();
}

function formatIdentityLabel(identity) {
  // Normalize identity labels
  if (identity === 'you') {
    return 'YOU';
  }
  if (identity === 'friend') {
    return formatFriendLabel();
  }
  return 'STRANGER';
}

function getShapeForIdentity(identity) {
  // Map identities to randomized shapes
  if (identity === 'you') {
    return typeof your_shape !== 'undefined' ? your_shape : 'circle';
  }
  if (identity === 'friend') {
    return typeof friend_shape !== 'undefined' ? friend_shape : 'square';
  }
  return typeof stranger_shape !== 'undefined' ? stranger_shape : 'triangle';
}

function renderShape(shape_name) {
  // Render a shape
  if (shape_name === 'circle') {
    return '<div class="shape-figure"><div class="shape-circle"></div></div>';
  }
  if (shape_name === 'square') {
    return '<div class="shape-figure"><div class="shape-square"></div></div>';
  }
  if (shape_name === 'triangle') {
    return '<div class="shape-figure"><div class="shape-triangle"></div></div>';
  }
  return "<div class='shape-figure'><img src='images/" + shape_name + ".png' width='170' height='170'></div>";
}

function buildStimulusHTML(shape_owner, label_owner) {
  // Builds the two-row structure (top/bottom) that gets injected per trial.
  const label_html = "<div class='memory-shape-name-text'>" + formatIdentityLabel(label_owner) + "</div>";
  const shape_html = renderShape(getShapeForIdentity(shape_owner));
  const shape_on_top = Math.random() < 0.5;
  const top_html = shape_on_top ? shape_html : label_html;
  const bottom_html = shape_on_top ? label_html : shape_html;
  return "<div class='memory-shape-name-trial stimulus-container'>" +
    "<div class='memory-shape-name-row top-row'>" + top_html + "</div>" +
    "<div class='memory-shape-name-row bottom-row'>" + bottom_html + "</div>" +
    "</div>";
}

function buildMappingHTML() {
  // Renders the instruction cards that remind participants of the current mapping.
  let cards = identityOrder.map(function (identity) {
    const title = identity === 'you' ? 'You' : (identity === 'friend' ? 'Friend' : 'Stranger');
    return "<div class='mapping-card'><h3>" + title + "</h3>" +
      renderShape(getShapeForIdentity(identity)) +
      "<p class='memory-shape-name-text' style='margin-top: 16px; font-size: 28px;'>" +
      formatIdentityLabel(identity) + "</p></div>";
  }).join('');
  return "<div><p>Please memorize these memory-shape-name associations:</p><div class='mapping-grid'>" + cards + "</div></div>";
}

let warning_screen = { //!!! finish this
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p><b>This portfolio demo records interaction data while you complete the task.</b></p>" +
    "<p>Please respond normally so the sample CSV output is meaningful.</p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subj_name, test_part: 'warning_screen' }
  ,
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

let friend_name_prompt = {
  type: 'survey-html-form',
  html: [
    "<div style='width: 70%; margin: 0 auto; text-align: center;'>",
    "<p><strong>Think about a friend in your life. What is their name?</strong></p>",
    "<input name='pname' type='text' maxlength='20' style='width: 60%; border-radius: 4px; padding: 10px; ",
    "border: 1px solid #ccc; font-size: 18px' placeholder='e.g., John' />",
    "</div>"
  ].join(''),
  button_label: 'Continue',
  on_start: function () {
    document.body.style.cursor = 'default';
  },
  check_blanks: true,
  on_finish: function (data) {
    const resp = JSON.parse(data.responses || '{}');
    const entered = (resp.pname || '').trim();
    friend_name = entered || 'Friend';
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  },
  data: { test_part: 'enter_friend_name' }
};


let instruction_screen_one = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>In this experiment, you will be presented with a set of shapes and labels.</p>" +
    "<p>Each shape stands for a different identity: <b>you</b>, your <b>friend</b>, or a <b>stranger</b>.</p>" +
    "<p>These <b>true</b> memory-shape-name pairings will <b>stay the same for the entire experiment</b>, so please memorize them carefully.</p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subj_name, test_part: 'instruction_1' }
  ,
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

let instruction_screen_two = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>On each trial, you will see a shape and a label (YOU, " + formatIdentityLabel('friend') + ", STRANGER).</p>" +
    "<p><b>Your task is to judge whether the shape matches the associated identity you learned.</b></p>" +
    "<p>Decide as quickly and accurately as possible:</p>" +
    "<p>Press <b>J</b> if the shape and label <b>match</b>.</p>" +
    "<p>Press <b>F</b> if they <b>do not match</b>.</p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subj_name, test_part: 'instruction_2' },
  on_start: function (trial) {
    trial.stimulus = "<p>On each trial, you will see a shape and a label (YOU, " + formatIdentityLabel('friend') + ", STRANGER).</p>" +
      "<p><b>Your task is to judge whether the shape matches the associated identity you learned.</b></p>" + "" +
      "<p>Decide as quickly and accurately as possible:</p>" +
      "<p>Press <b>J</b> if the shape and label <b>match</b>.</p>" +
      "<p>Press <b>F</b> if they <b>do not match</b>.</p>";
  },
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

let instruction_screen_three = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>You will first complete a short <b>practice session</b> with these associations.</p>" +
    "<p>If your accuracy in the practice block is too low, you will be asked to <b>repeat the practice</b> before moving on to the main task.</p>" +
    "<p>Each trial will include:</p>" +
    "<p>&bull; A fixation cross</p>" +
    "<p>&bull; A memory-shape-name pair</p>" +
    "<p>&bull; A blank response window</p>" +
    "<p>The shape and label will appear on opposite sides of the fixation cross, and their positions will change from trial to trial.</p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subj_name, test_part: 'instruction_3' },
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

let mapping_prompt = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: '',
  prompt: "Press SPACE to start practice.",
  trial_duration: 60000,
  data: { subj_id: subj_name, test_part: 'mapping_prompt' },
  on_start: function (trial) {
    trial.stimulus = buildMappingHTML() +
      "<p><strong>Remember:</strong> Press <b>J</b> for a <b>match</b>, <b>F</b> for a <b>mismatch</b>.</p>" +
      "<p>Please memorize these associations before starting the practice session.</p>" +
      "<p>This page will advance automatically after 60 seconds.</p>";
  },
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

let memory_shape_name_trial = { // Records one matching-task trial
  type: 'html-keyboard-response',
  stimulus: '',
  choices: [keyMatchCode, keyMismatchCode],
  stimulus_duration: 100, // Shape and Label presentation time
  trial_duration: 1000, // Max responding time
  response_ends_trial: true,
  data: {},
  on_start: function (trial) {
    const shape_owner = jsPsych.timelineVariable('shape_owner', true);
    const label_owner = jsPsych.timelineVariable('label_owner', true);
    const phase = jsPsych.timelineVariable('phase', true);
    const block_index = jsPsych.timelineVariable('block_index', true);
    const trial_index = jsPsych.timelineVariable('trial_index', true);
    const condition = jsPsych.timelineVariable('condition', true);
    const is_match = jsPsych.timelineVariable('is_match', true);
    if (typeof window !== 'undefined' && typeof window.updatePhaseBadge === 'function') {
      window.updatePhaseBadge(phase);
    }
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('Trial start:', phase, shape_owner, 'label', label_owner, 'match?', is_match);
    }
    trial.stimulus = buildStimulusHTML(shape_owner, label_owner);
    trial.data = {
      subj_id: subj_name,
      phase: phase,
      test_part: phase === 'practice' ? 'practice_trial' : 'main_trial',
      block_index: block_index,
      trial_index: trial_index,
      stimulus_duration: trial.stimulus_duration,
      shape_owner_shape: getShapeForIdentity(shape_owner),
      condition: condition,
      is_match: is_match,
      shape_owner: shape_owner,
      label_owner: label_owner
    };
    const debugTrialId = [phase, block_index, trial_index].join('-');
    trial.data.debug_trial_id = debugTrialId;
    // Data timing debug
    if (typeof show_rt_debug !== 'undefined' && show_rt_debug) {
      const trialId = debugTrialId;
      const trialStartMs = performance.now();
      if (typeof window !== 'undefined') {
        window.__rtDebugTrialStart = window.__rtDebugTrialStart || {};
        window.__rtDebugTrialStart[trialId] = trialStartMs;
        window.__rtDebugStimulusDuration = window.__rtDebugStimulusDuration || {};
        window.__rtDebugStimulusDuration[trialId] = trial.stimulus_duration;
        window.__rtDebugTimeouts = window.__rtDebugTimeouts || {};
        const delay = typeof trial.stimulus_duration === 'number' ? trial.stimulus_duration : 0;
        window.__rtDebugTimeouts[trialId] = setTimeout(function () {
          if (typeof window.logRtStart === 'function') {
            window.logRtStart(trialId);
          }
          if (window.__rtDebugTimeouts) {
            delete window.__rtDebugTimeouts[trialId];
          }
        }, delay);
      }
    }
  },
  on_finish: function (data) {
    const expected_match = !!data.is_match;
    const expected_key = expected_match ? keyMatchCode : keyMismatchCode;
    const expected_type = expected_match ? 'match' : 'mismatch';
    let response_type = null;
    if (typeof jsPsych !== 'undefined' && jsPsych.pluginAPI && typeof jsPsych.pluginAPI.convertKeyCodeToKeyCharacter === 'function') {
      const keyChar = jsPsych.pluginAPI.convertKeyCodeToKeyCharacter(data.key_press);
      if (keyChar === 'j') {
        response_type = 'match';
      } else if (keyChar === 'f') {
        response_type = 'mismatch';
      }
    }
    data.correct_response = expected_key;
    data.correct_response_type = expected_type;
    data.response_type = response_type;
    data.no_response = data.key_press === null || typeof data.key_press === 'undefined';
    data.correct = !data.no_response && response_type === expected_type;
    const shouldAdjustRt = (data.phase === 'main' || data.test_part === 'main_trial') && typeof data.rt === 'number' && typeof data.stimulus_duration === 'number';
    if (shouldAdjustRt) {
      data.rt_raw = data.rt;
      data.rt = Math.max(0, data.rt - data.stimulus_duration);
    }
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('Response summary:', {
        response_key: data.key_press,
        response_type: response_type,
        expected_key: expected_key,
        expected_type: expected_type,
        correct: data.correct
      });
    }
    // Data timing debug
    if (typeof show_rt_debug !== 'undefined' && show_rt_debug && typeof window !== 'undefined') {
      const trialId = data.debug_trial_id || [data.phase, data.block_index, data.trial_index].join('-');
      if (trialId && window.__rtDebugTimeouts && window.__rtDebugTimeouts[trialId]) {
        clearTimeout(window.__rtDebugTimeouts[trialId]);
        delete window.__rtDebugTimeouts[trialId];
        const trialStartMs = (window.__rtDebugTrialStart && typeof window.__rtDebugTrialStart[trialId] === 'number')
          ? window.__rtDebugTrialStart[trialId]
          : null;
        const stimDuration = (window.__rtDebugStimulusDuration && typeof window.__rtDebugStimulusDuration[trialId] === 'number')
          ? window.__rtDebugStimulusDuration[trialId]
          : 0;
        if (typeof window.logRtStart === 'function') {
          const startAtMs = (typeof trialStartMs === 'number') ? trialStartMs + stimDuration : null;
          window.logRtStart(trialId, startAtMs);
        }
      }
      if (trialId && typeof window.logRtEnd === 'function') {
        window.logRtEnd(trialId, data.key_press);
      }
    }
  }
};

let feedback_trial = {
  type: 'html-keyboard-response',
  stimulus: function () {
    const last_trial = jsPsych.data.get().last(1).values()[0];
    if (!last_trial || last_trial.no_response) {
      return "<p style='color: #c0392b; font-size: 28px;'>No response</p>";
    }
    if (last_trial.correct) {
      return "<p style='color: #2e8b57; font-size: 28px;'>Correct</p>";
    }
    return "<p style='color: #c0392b; font-size: 28px;'>Incorrect</p>";
  },
  choices: jsPsych.NO_KEYS,
  trial_duration: 500, 
  data: { test_part: 'feedback' }
};

let practice_feedback_prompt = {
  type: 'demo-html-keyboard-response',
  wait_duration: 0,
  choices: ['space'],
  stimulus: '',
  prompt: "",
  data: { subj_id: subj_name, test_part: 'practice_feedback' },
  on_start: function (trial) {
    const recent_trials = jsPsych.data.get().filter({ phase: 'practice' }).last(12).values();
    const correct = recent_trials.filter(function (t) { return t.correct; }).length;
    const accuracy = recent_trials.length ? correct / recent_trials.length : 0;
    const pct = Math.round(accuracy * 100);
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('Practice accuracy', pct + '%', 'from', recent_trials.length, 'trials');
    }
    practice_should_repeat = accuracy <= 0.5;
    if (practice_should_repeat) {
      trial.stimulus = "<p>Your accuracy in the practice block was <b>too low</b> (" + pct + "%).</p>" +
        "<p>To make sure you understand the task and the associations, you will now repeat the practice trials.</p>" +
        "<p>Please pay close attention to the shapes and their associated identities, and respond as accurately as you can.</p>" +
        buildMappingHTML() +
        "<p><strong>Review the associations and press SPACE to try again.</strong></p>";
      if (typeof regeneratePracticeTrials === 'function') {
        regeneratePracticeTrials();
      }
      if (typeof jsPsych !== 'undefined' && typeof jsPsych.setProgressBar === 'function') {
        const instructionValue = (typeof getInstructionProgressValue === 'function') ? getInstructionProgressValue() : 0;
        jsPsych.setProgressBar(instructionValue);
      }
    } else {
      trial.stimulus = "<p style='color:#2ecc71; font-weight:700;'>Great job!</p>" +
        "<p><b>Your accuracy in the practice block was sufficient (" + pct + "%).</b></p>" +
        "<p>You will now move on to the main experiment. There will a total of be 3 blocks.</p>" +
        "<p>Your accuracy will be displayed at the end per block.</p>" +
        "<p><b>Remember:</b> Your task is to judge whether the shape matched the associated identity you learned.</p>" +
        "<p><strong>Press SPACE to begin the main task.</strong></p>";
      if (typeof jsPsych !== 'undefined' && typeof jsPsych.setProgressBar === 'function') {
        jsPsych.setProgressBar(practiceProgressTarget);
      }
    }
    saveData('partial_' + subj_name, jsPsych.data.get().csv());
  }
};

let block_summary_prompt = {
  type: 'demo-html-keyboard-response',
  wait_duration: 1500,
  choices: ['space'],
  stimulus: '',
  prompt: "Press SPACE to continue.",
  data: { subj_id: subj_name, test_part: 'block_summary' },
  on_start: function (trial) {
    const main_trials = jsPsych.data.get().filter({ phase: 'main' });
    const completed = main_trials.values().length;
const block_target = (typeof window !== 'undefined' && window.__mainBlockTrialTarget) ? window.__mainBlockTrialTarget : 120; // Default block size
    const current_block_number = Math.max(1, Math.ceil(completed / block_target));
    const recent_trials = main_trials.last(block_target).values();
    const correct = recent_trials.filter(function (t) { return t.correct; }).length;
    const accuracy = recent_trials.length ? Math.round((correct / recent_trials.length) * 100) : 0;
    const remaining = Math.max(0, totalMainBlocks - current_block_number);
    const congratsText = remaining === 0
      ? "<p><strong>Congratulations on finishing all blocks!</strong></p>"
      : "<p>You have completed block " + current_block_number + " of 3.</p>";
    const followupText = remaining === 0
      ? "<p>Press SPACE to proceed.</p>"
      : "<p>You may take a brief break now if needed.</p>";
    const reminderText = remaining === 0
      ? ""
      : "<p style='margin-top: 12px; font-weight:600;'>Remember! <span style='text-transform:uppercase;'>J = Match, F = Mismatch.</span></p>";
    trial.stimulus = congratsText +
      "<p>Your accuracy in this block was " + accuracy + "%.</p>" +
      reminderText +
      followupText;
    if (typeof jsPsych !== 'undefined' && typeof jsPsych.setProgressBar === 'function') {
      const clampedBlock = Math.min(current_block_number, totalMainBlocks);
      const progressValue = blockProgressBase + blockProgressWeight * (clampedBlock / totalMainBlocks);
      jsPsych.setProgressBar(Math.min(progressValue, 1));
      if (remaining === 0 && typeof updatePhaseBadge === 'function') {
        updatePhaseBadge(null);
      }
    }
    saveData('partial_' + subj_name, jsPsych.data.get().csv());
  }
};

let record_main_accuracy = {
  type: 'html-keyboard-response',
  choices: jsPsych.NO_KEYS,
  stimulus: '',
  trial_duration: 0,
  data: { subj_id: subj_name, test_part: 'main_accuracy_summary' },
  on_start: function (trial) {
    const main_trials = jsPsych.data.get().filter({ test_part: 'main_trial' });
    const total = main_trials.count();
    const correct = main_trials.filter({ correct: true }).count();
    trial.data.main_trials = total;
    trial.data.main_correct = correct;
    trial.data.main_accuracy = total > 0 ? correct / total : null;
  }
};

var ucla_intro = {
  type: 'demo-html-keyboard-response',
  wait_duration: 3000,
  choices: ['space'],
  stimulus: "<p>The following statements describe how people sometimes feel. For each statement, indicate <strong>how often</strong> you feel the way described.</p>" +
    "<p>Example: If you never feel happy, choose <em>Never</em>. If you always feel happy, choose <em>Always</em>.</p>",
  prompt: "Press SPACE to continue.",
  data: {
    subj_id: subj_name,
    test_part: 'ucla_intro'
  },
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

var ucla_qs = {
  1: 'feel that you are in tune with the people around you?',
  2: 'feel that you lack companionship?',
  3: 'feel that there is no one you can turn to?',
  4: 'feel alone?',
  5: 'feel part of a group of friends?',
  6: 'feel that you have a lot in common with the people around you?',
  7: 'feel that you are no longer close to anyone?',
  8: 'feel that your interests and ideas are not shared by those around you?',
  9: 'feel outgoing and friendly?',
  10: 'feel close to people?',
  11: 'feel left out?',
  12: 'feel that your relationships with others are not meaningful?',
  13: 'feel that no one really knows you well?',
  14: 'feel isolated from others?',
  15: 'feel that you can find companionship when you want it?',
  16: 'feel that there are people who really understand you?',
  17: 'feel shy?',
  18: 'feel that people are around you but not with you?',
  19: 'feel that there are people you can talk to?',
  20: 'feel that there are people you can turn to?'
};

let num_ucla = Object.keys(ucla_qs).length;

var ucla_item = function (item, id) {
  return {
    type: 'demo-html-button-response',
    stimulus: '',
    on_start: function (trial) {
      document.body.style.cursor = 'default';
      trial.stimulus = "<p>" + id + " / " + num_ucla + "</p>" +
        "<p><strong>Please indicate how often you generally feel this way.</strong></p>" +
        "<p>How often do you...<br>" + item + "</p>";
      trial.choices = ['Never', 'Rarely', 'Sometimes', 'Always'];
    },
    wait_duration: 1500,
    data: {
      subj_id: subj_name,
      test_part: 'UCLA',
      id: id
    },
    on_finish: function () {
      let file_name = 'partial_' + subj_name;
      saveData(file_name, jsPsych.data.get().csv());
      if (typeof advanceInstructionProgress === 'function') {
        advanceInstructionProgress();
      }
    }
  };
};




