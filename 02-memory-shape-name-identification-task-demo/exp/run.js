const defaultMainBlockTrials = 18;
// Set mainBlockTrials = defaultMainBlockTrials for production. During debugging you can temporarily assign 10 (or another small number)
const mainBlockTrials = defaultMainBlockTrials;
if (typeof window !== 'undefined') {
    window.__mainBlockTrialTarget = mainBlockTrials;
    window.__testingShortBlock = false;
}

// Pick a different identity for mismatch trials
function pickDifferentIdentity(identity) {
    let options = identityOrder.filter(function (id) { return id !== identity; }); // Use the shared identity list
    return jsPsych.randomization.sampleWithoutReplacement(options, 1)[0];
}

// Build one trial record
// The match flag grades F and J responses
function createTrialSpec(shape_owner, label_owner, condition, phase, block_index, trial_index) {
    let is_match = true;
    if (typeof condition === 'string' && condition.toLowerCase().includes('mismatch')) {
        is_match = false;
    } else if (shape_owner !== label_owner) {
        is_match = false;
    }
    return {
        shape_owner: shape_owner,
        label_owner: label_owner,
        condition: condition,
        phase: phase,
        block_index: block_index,
        trial_index: trial_index,
        is_match: is_match
    };
}

// Build the practice set
function buildPracticeTrials() {
    let specs = [];
    let counter = 0;
    for (let rep = 0; rep < 2; rep++) {
        specs.push(createTrialSpec('you', 'you', 'self_match', 'practice', 0, ++counter));
        specs.push(createTrialSpec('you', 'friend', 'self_mismatch', 'practice', 0, ++counter));
        specs.push(createTrialSpec('friend', 'friend', 'friend_match', 'practice', 0, ++counter));
        specs.push(createTrialSpec('friend', 'you', 'friend_mismatch', 'practice', 0, ++counter));
        specs.push(createTrialSpec('stranger', 'stranger', 'stranger_match', 'practice', 0, ++counter));
        specs.push(createTrialSpec('stranger', 'friend', 'stranger_mismatch', 'practice', 0, ++counter));
    }
    return specs;
}

// Build one full main block
// Short demo blocks can slice this list

function buildBlockTrials(block_index) {
    let specs = [];
    let counter = 0;
    for (let rep = 0; rep < 20; rep++) {
        specs.push(createTrialSpec('you', 'you', 'self_match', 'main', block_index, ++counter));
        const youMismatch = rep % 2 === 0 ? 'friend' : 'stranger';
        specs.push(createTrialSpec('you', youMismatch, 'self_mismatch', 'main', block_index, ++counter));

        specs.push(createTrialSpec('friend', 'friend', 'friend_match', 'main', block_index, ++counter));
        const friendMismatch = rep % 2 === 0 ? 'you' : 'stranger';
        specs.push(createTrialSpec('friend', friendMismatch, 'friend_mismatch', 'main', block_index, ++counter));

        specs.push(createTrialSpec('stranger', 'stranger', 'stranger_match', 'main', block_index, ++counter));
        const strangerMismatch = rep % 2 === 0 ? 'you' : 'friend';
        specs.push(createTrialSpec('stranger', strangerMismatch, 'stranger_mismatch', 'main', block_index, ++counter));
    }
    return specs;
}

// Load Timeline
if (forceFullscreen) {
    timeline.push({
        type: 'fullscreen',
        fullscreen_mode: true,
        button_label: 'Enter Fullscreen',
        message: "<p>This demo can run in full-screen mode.</p><p>Press the button below to begin.</p>",
        on_finish: function (data) {
            viewport_width = get_viewport_size().width;
            viewport_height = get_viewport_size().height;
            data.screen_width = viewport_width;
            data.screen_height = viewport_height;
            console.log("ID", subj_name, "W", viewport_width, "H", viewport_height)
        }
    });
}
var shapes = ['circle', 'square', 'triangle'];
shuffle(shapes);

var your_shape = shapes[0];
var friend_shape = shapes[1];
var stranger_shape = shapes[2];

if (show_boilerplate) {
    timeline.push(demo_notice);
    timeline.push(welcome_prompt);
}

timeline.push(friend_name_prompt);

timeline.push(instruction_screen_one);
timeline.push(instruction_screen_two);
timeline.push(instruction_screen_three);
timeline.push(mapping_prompt);

let practice_trials = [];
const practice_block = {
    timeline: [fixation, memory_shape_name_trial, feedback_trial],
    timeline_variables: [],
    randomize_order: false
};

function regeneratePracticeTrials() {
    const generator = (typeof shuffleWithConstraint === 'function')
        ? shuffleWithConstraint
        : function (arr) { return jsPsych.randomization.shuffle(arr); };
    practice_trials = generator(
        buildPracticeTrials(),
        function (trial) { return trial.shape_owner; },
        2
    );
    practice_block.timeline_variables = practice_trials;
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log('Practice trial order:',
            practice_trials.map(function (t) {
                return t.shape_owner + '-' + t.label_owner;
            }).join(', ')
        );
    }
}

regeneratePracticeTrials();

const practice_procedure = {
    timeline: [practice_block, practice_feedback_prompt],
    loop_function: function () {
        return practice_should_repeat;
    }
};

timeline.push(practice_procedure);

const NUM_BLOCKS = 3;
for (let block = 1; block <= NUM_BLOCKS; block++) {
    let block_trials = shuffleWithConstraint(
        buildBlockTrials(block),
        function (trial) { return trial.shape_owner; },
        3
    );
    if (mainBlockTrials < block_trials.length) {
        block_trials = block_trials.slice(0, mainBlockTrials);
    }
    const main_block = {
        timeline: [fixation, memory_shape_name_trial, feedback_trial],
        timeline_variables: block_trials,
        randomize_order: false
    };
    timeline.push(main_block);
    timeline.push(block_summary_prompt);
}
// Save a final accuracy summary
timeline.push(record_main_accuracy);

if (!skip_ucla) {
    timeline.push(ucla_intro);
    for (let i = 1; i <= num_ucla; i++) {
        timeline.push(ucla_item(ucla_qs[i], i));
    }
} else if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('Skipping UCLA survey for testing. Set skipUcla to false to include it.'); // Reminder for testing
}

// Debriefing Section
if (forceFullscreen) {
    timeline.push({
        type: 'fullscreen',
        fullscreen_mode: false,
        button_label: 'Exit Fullscreen',
        message: '<p>You can now exit full-screen mode.</p>',
        on_finish: function (data) {
            viewport_width = get_viewport_size().width;
            viewport_height = get_viewport_size().height;
            data.screen_width = viewport_width;
            data.screen_height = viewport_height;
            console.log("ID", subj_name, "W", viewport_width, "H", viewport_height);
        }
    });
}
timeline.push(check_debrief_response);
timeline.push(get_code_prompt);
timeline.push(show_code_prompt);
timeline.push(close_prompt);
console.log('Timeline ready', timeline);


// Start experiment
if (limitToGoogle) {
    let browserInfo = getBrowserInfo();
    if (browserInfo.browser !== 'Chrome') {
      Message = "This experiment is only supported by Google Chrome. Please reopen the experiment in Google Chrome."
      let wrong_browser = {
        type: 'html-keyboard-response',
        stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
        choices: jsPsych.NO_KEYS,
      };
      jsPsych.init({
        timeline: [wrong_browser]
      });
    } else {
      if (limitToDesktop) {
        let mobileCheck = mobileAndTabletCheck();
        if (mobileCheck) {
          Message =
            "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.  If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser."
          let wrong_browser = {
            type: 'html-keyboard-response',
            stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
            choices: jsPsych.NO_KEYS,
          };
          jsPsych.init({
            timeline: [wrong_browser]
          });
        } else if (
          /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i
            .test(navigator.userAgent) ||
          /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
            .test(navigator.userAgent.substr(0, 4))) {
          Message =
            "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.  If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser."
          let wrong_browser = {
            type: 'html-keyboard-response',
            stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
            choices: jsPsych.NO_KEYS,
          };
          jsPsych.init({
            timeline: [wrong_browser]
          });
        } else {
          let mobile_prompt = {
            type: 'html-keyboard-response',
            choices: ['space'],
            stimulus: '<p>This experiment requires you to be using a desktop browser. The program should have automatically detected whether you are using a phone or a tablet.<p><strong>If you are using a phone or tablet and it has still allowed you to continue, please reopen the experiment in a desktop browser now.</strong><p>If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser.</p><p>If you are on a desktop browser -- great!  Press the spacebar to continue.</p>'
          };
          startExpt();
        };
      } else {
        startExpt();
      };
    }
  } else {
    if (limitToDesktop) {
      let mobileCheck = mobileAndTabletCheck();
      if (mobileCheck) {
        Message =
          "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.  If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser."
        let wrong_browser = {
          type: 'html-keyboard-response',
          stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
          choices: jsPsych.NO_KEYS,
        };
        jsPsych.init({
          timeline: [wrong_browser]
        });
      } else if (
        /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i
          .test(navigator.userAgent) ||
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
          .test(navigator.userAgent.substr(0, 4))) {
        Message =
          "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.  If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser."
        let wrong_browser = {
          type: 'html-keyboard-response',
          stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
          choices: jsPsych.NO_KEYS,
        };
        jsPsych.init({
          timeline: [wrong_browser]
        });
      } else {
        let mobile_prompt = {
          type: 'html-keyboard-response',
          choices: ['space'],
          stimulus: '<p>This experiment requires you to be using a desktop browser. The program should have automatically detected whether you are using a phone or a tablet.<p><strong>If you are using a phone or tablet and it has still allowed you to continue, please reopen the experiment in a desktop browser now.</strong><p>If you can only use a tablet or a phone, and are unable to switch to a desktop browser, please reopen this demo on a desktop browser.</p><p>If you are on a desktop browser -- great!  Press the spacebar to continue.</p>'
        };
        startExpt();
      };
    } else {
      startExpt();
    };
  }







