// Setup
let timeline = [];

const keyLeftCode = 70;
const keyRightCode = 74;
const rcStimulusCount = 120;
const rcTrialsPerParticipant = 120;
const rcBlockTrialCount = 30;
const rcTotalBlocks = 4;
const rcResponseWaitMs = 1000;
const rcStimulusDir = 'images/rc_stimuli';
const rcStimulusPrefix = 'rcic_neutral_1_';

// Task instructions
let rcInstructionScreenOne = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>In this experiment, we're interested in your general impressions of people and what they're feeling. In particular, we are interested in <strong>loneliness</strong> &mdash; with loneliness as <strong>a specific feeling of being disconnected or isolated from others</strong>, as opposed to just a broad or <strong>general sadness.</strong></p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subjName, test_part: 'rc_instruction_1' },
  on_finish: function () {
    if (typeof setExperimentProgress === 'function') {
      setExperimentProgress(0.04);
    }
  }
};

let rcInstructionScreenTwo = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>Each time, you will be shown two faces. In some sections, you simply have select which of the two people looks more lonely<br>&mdash; and in other sections, you simply have select which of the two people looks more sad.</p>" +
    "<p>When presented with the pair of faces, press the <strong>F</strong> key to choose the face on the left and the <strong>J</strong> key for the right.</p>",
  prompt: "Press SPACE to continue.",
  data: { subj_id: subjName, test_part: 'rc_instruction_2' },
  on_finish: function () {
    if (typeof setExperimentProgress === 'function') {
      setExperimentProgress(0.07);
    }
  }
};

let rcInstructionScreenThree = {
  type: 'demo-html-keyboard-response',
  wait_duration: 4000,
  choices: ['space'],
  stimulus: "<p>Of course, this task might seem a bit odd, since you don't know these people and we're asking you to determine who looks more lonely or more sad by just looking at their faces. And while the lonely face might often look like the sadder face<br>&mdash; <strong>note that even happy faces can be lonely too.</strong><br>So when making your responses, don't think about it too much: we're really just interested in your gut intuitions.</p>",
  prompt: "Press SPACE to begin.",
  data: { subj_id: subjName, test_part: 'rc_instruction_3' },
  on_finish: function () {
    if (typeof setExperimentProgress === 'function') {
      setExperimentProgress(0.1);
    }
  }
};

// Stimulus helpers
function padRcStimulusId(noiseId) {
  return ("00000" + noiseId).slice(-5);
}

function getRcStimulusPath(noiseId, noiseSign) {
  const suffix = noiseSign === 1 ? 'ori' : 'inv';
  return rcStimulusDir + '/' + rcStimulusPrefix + padRcStimulusId(noiseId) + '_' + suffix + '.png';
}

function getRcPromptText(traitCondition) {
  if (traitCondition === 'sad') {
    return "Which of the two people looks more <span class='rc-trait-word rc-trait-sad'>sad</span>?";
  }
  return "Which of the two people looks more <span class='rc-trait-word rc-trait-lonely'>lonely</span>?";
}

function getRcDefinitionText(traitCondition) {
  if (traitCondition === 'sad') {
    return '<span class="rc-definition-term">sadness</span> as a generally negative emotion (in response to grief or disappointment), often as opposed to happiness or other positive emotions';
  }
  return '<span class="rc-definition-term">loneliness</span> as a specific feeling of being disconnected or isolated from others, as opposed to just a broad or general sadness';
}

function getRcTraitLabel(traitCondition) {
  return traitCondition === 'sad' ? 'sad' : 'lonely';
}

function renderRcBlockIntro(traitCondition, blockIndex, totalBlocks) {
  const trait = getRcTraitLabel(traitCondition);
  return "<div class='rc-block-intro'>" +
    "<div class='rc-block-count'>" + blockIndex + " out of " + totalBlocks + " blocks</div>" +
    "<p>In this block, you will be asked about which of two people looks <span class='rc-trait-word rc-trait-" + trait + "'>more " + trait + "</span>&mdash;</p>" +
    "<p><em>with " + getRcDefinitionText(traitCondition) + "</em></p>" +
    "</div>";
}

function renderRcFacePair(leftImage, rightImage, traitCondition) {
  return "<div class='rc-choice-shell rc-response-locked'>" +
    "<div class='rc-trial-prompt'>" + getRcPromptText(traitCondition) + "</div>" +
    "<div class='rc-face-trial'>" +
    "<div class='rc-face-option'><img src='" + leftImage + "' alt=''></div>" +
    "<div class='rc-face-option'><img src='" + rightImage + "' alt=''></div>" +
    "</div>" +
    "<div class='rc-definition'><em>" + getRcDefinitionText(traitCondition) + "</em></div>" +
    "</div>";
}

// Progress helpers
function updateRcTrialProgress(blockIndex, blockTrialIndex) {
  const numericBlockIndex = Number(blockIndex);
  const numericBlockTrialIndex = Number(blockTrialIndex);
  if (!Number.isFinite(numericBlockIndex) || !Number.isFinite(numericBlockTrialIndex)) {
    return;
  }
  if (numericBlockTrialIndex % 10 !== 0 && numericBlockTrialIndex !== rcBlockTrialCount) {
    return;
  }
  const blockProgressSpan = 0.8 / rcTotalBlocks;
  const blockStart = 0.1 + (numericBlockIndex - 1) * blockProgressSpan;
  const completedInBlock = Math.min(numericBlockTrialIndex, rcBlockTrialCount);
  const progressValue = blockStart + blockProgressSpan * (completedInBlock / rcBlockTrialCount);
  if (typeof setExperimentProgress === 'function') {
    setExperimentProgress(progressValue);
  }
}

function getRcResponseSide(keyPress) {
  if (keyPress === keyLeftCode) {
    return 'left';
  }
  if (keyPress === keyRightCode) {
    return 'right';
  }
  return null;
}

// Face response plugin
jsPsych.plugins["rc-face-keyboard-response"] = (function () {
  let plugin = {};

  plugin.info = {
    name: 'rc-face-keyboard-response',
    parameters: {
      stimulus: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        default: undefined
      },
      choices: {
        type: jsPsych.plugins.parameterType.KEYCODE,
        array: true,
        default: jsPsych.ALL_KEYS
      },
      response_wait_ms: {
        type: jsPsych.plugins.parameterType.INT,
        default: 1000
      }
    }
  };

  plugin.trial = function (displayElement, trial) {
    displayElement.innerHTML = '<div id="jspsych-html-keyboard-response-stimulus">' + trial.stimulus + '</div>';

    let keyboardListener;
    let response = {
      rt: null,
      key: null
    };

    const endTrial = function () {
      jsPsych.pluginAPI.clearAllTimeouts();
      if (typeof keyboardListener !== 'undefined') {
        jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }

      const trialData = {
        rt: response.rt,
        stimulus: trial.stimulus,
        key_press: response.key,
        response_wait_ms: trial.response_wait_ms
      };

      displayElement.innerHTML = '';
      jsPsych.finishTrial(trialData);
    };

    const enableResponse = function () {
      const shell = displayElement.querySelector('.rc-choice-shell');
      if (shell) {
        shell.classList.remove('rc-response-locked');
        shell.classList.add('rc-response-ready');
      }
      keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: function (info) {
          if (response.key === null) {
            response = info;
          }
          endTrial();
        },
        valid_responses: trial.choices,
        rt_method: 'performance',
        persist: false,
        allow_held_key: false
      });
    };

    jsPsych.pluginAPI.setTimeout(enableResponse, trial.response_wait_ms);
  };

  return plugin;
})();

// Face choice trial
let rcFaceTrial = {
  type: 'rc-face-keyboard-response',
  stimulus: '',
  choices: [keyLeftCode, keyRightCode],
  response_wait_ms: rcResponseWaitMs,
  data: {},
  on_start: function (trial) {
    const noiseId = jsPsych.timelineVariable('noise_id', true);
    const phase = jsPsych.timelineVariable('phase', true);
    const blockIndex = jsPsych.timelineVariable('block_index', true);
    const trialIndex = jsPsych.timelineVariable('trial_index', true);
    const blockTrialIndex = jsPsych.timelineVariable('block_trial_index', true);
    const leftNoiseSign = jsPsych.timelineVariable('left_noise_sign', true);
    const rightNoiseSign = jsPsych.timelineVariable('right_noise_sign', true);
    const leftImage = jsPsych.timelineVariable('left_image', true);
    const rightImage = jsPsych.timelineVariable('right_image', true);
    const originalSide = jsPsych.timelineVariable('original_side', true);
    const traitCondition = jsPsych.timelineVariable('trait_condition', true);
    if (typeof window !== 'undefined' && typeof window.updatePhaseBadge === 'function') {
      window.updatePhaseBadge(phase);
    }
    trial.stimulus = renderRcFacePair(leftImage, rightImage, traitCondition);
    trial.data = {
      subj_id: subjName,
      phase: phase,
      test_part: 'main_trial',
      task: 'intrinsic_image_identification',
      trait_condition: traitCondition,
      prompt_text: getRcPromptText(traitCondition),
      block_index: blockIndex,
      trial_index: trialIndex,
      block_trial_index: blockTrialIndex,
      noise_id: noiseId,
      original_side: originalSide,
      left_image: leftImage,
      right_image: rightImage,
      left_noise_sign: leftNoiseSign,
      right_noise_sign: rightNoiseSign,
      rcicr_stimulus: noiseId,
      response_wait_ms: rcResponseWaitMs
    };
  },
  on_finish: function (data) {
    const responseSide = getRcResponseSide(data.key_press);
    const rcicrResponse = responseSide === 'left'
      ? data.left_noise_sign
      : (responseSide === 'right' ? data.right_noise_sign : null);
    data.response_side = responseSide;
    data.no_response = responseSide === null;
    data.rcicr_response = rcicrResponse;
    data.selected_image_type = rcicrResponse === 1
      ? 'original'
      : (rcicrResponse === -1 ? 'inverted' : null);
    updateRcTrialProgress(data.block_index, data.block_trial_index);
  }
};

// Task wrapup
let rcCompletePrompt = {
  type: 'html-keyboard-response',
  choices: ['space'],
  stimulus: "<p><strong>Congratulations on finishing all blocks!</strong></p><p>Press SPACE to proceed.</p>",
  data: { subj_id: subjName, test_part: 'main_task_complete' },
  on_start: function () {
    if (typeof updatePhaseBadge === 'function') {
      updatePhaseBadge(null);
    }
    if (typeof setExperimentProgress === 'function') {
      setExperimentProgress(0.9);
    }
    saveData('partial_' + subjName, jsPsych.data.get().csv());
  }
};

let recordRcSummary = {
  type: 'html-keyboard-response',
  choices: jsPsych.NO_KEYS,
  stimulus: '',
  trial_duration: 0,
  data: { subj_id: subjName, test_part: 'rc_summary' },
  on_start: function (trial) {
    const mainTrials = jsPsych.data.get().filter({ task: 'intrinsic_image_identification' });
    const total = mainTrials.count();
    const originalSelected = mainTrials.filter({ rcicr_response: 1 }).count();
    const invertedSelected = mainTrials.filter({ rcicr_response: -1 }).count();
    trial.data.rc_trials = total;
    trial.data.rc_original_selected = originalSelected;
    trial.data.rc_inverted_selected = invertedSelected;
  }
};

// UCLA survey
var uclaIntro = {
  type: 'demo-html-keyboard-response',
  wait_duration: 3000,
  choices: ['space'],
  stimulus: "<p>The following statements describe how people sometimes feel. For each statement, indicate <strong>how often</strong> you feel the way described.</p>" +
    "<p>Example: If you never feel happy, choose <em>Never</em>. If you always feel happy, choose <em>Always</em>.</p>",
  prompt: "Press SPACE to continue.",
  data: {
    subj_id: subjName,
    test_part: 'ucla_intro'
  },
  on_finish: function () {
    if (typeof advanceInstructionProgress === 'function') {
      advanceInstructionProgress();
    }
  }
};

var uclaQuestions = {
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

let numUcla = Object.keys(uclaQuestions).length;

var uclaItem = function (item, id) {
  return {
    type: 'demo-html-button-response',
    stimulus: '',
    on_start: function (trial) {
      document.body.style.cursor = 'default';
      trial.stimulus = "<p>" + id + " / " + numUcla + "</p>" +
        "<p><strong>Please indicate how often you generally feel this way.</strong></p>" +
        "<p>How often do you...<br>" + item + "</p>";
      trial.choices = ['Never', 'Rarely', 'Sometimes', 'Always'];
    },
    wait_duration: 1500,
    data: {
      subj_id: subjName,
      test_part: 'UCLA',
      id: id
    },
    on_finish: function () {
      let fileName = 'partial_' + subjName;
      saveData(fileName, jsPsych.data.get().csv());
      if (id === numUcla && typeof setExperimentProgress === 'function') {
        setExperimentProgress(0.95);
      }
    }
  };
};

