// Trial order
function createRcTrialSpec(noiseId, traitCondition, blockIndex, blockTrialIndex, trialIndex, originalLeft) {
    const leftNoiseSign = originalLeft ? 1 : -1;
    const rightNoiseSign = originalLeft ? -1 : 1;
    return {
        phase: 'main',
        trait_condition: traitCondition,
        block_index: blockIndex,
        trial_index: trialIndex,
        block_trial_index: blockTrialIndex,
        noise_id: noiseId,
        original_side: originalLeft ? 'left' : 'right',
        left_noise_sign: leftNoiseSign,
        right_noise_sign: rightNoiseSign,
        left_image: getRcStimulusPath(noiseId, leftNoiseSign),
        right_image: getRcStimulusPath(noiseId, rightNoiseSign)
    };
}

function createSeededRandom(seed) {
    let state = seed % 2147483647;
    if (state <= 0) {
        state += 2147483646;
    }
    return function () {
        state = state * 16807 % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function createFixedNoiseOrder(count, seed) {
    const random = createSeededRandom(seed);
    const ids = Array.from({ length: count }, function (_, index) {
        return index + 1;
    });
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const current = ids[i];
        ids[i] = ids[j];
        ids[j] = current;
    }
    return ids;
}

function buildRcTrialSpecs() {
    const conditionBlocks = jsPsych.randomization.shuffle(['lonely', 'lonely', 'sad', 'sad']);
    const noiseIds = createFixedNoiseOrder(rcTrialsPerParticipant, 20260527);
    let specs = [];
    let trialIndex = 0;
    for (let blockIndex = 1; blockIndex <= rcTotalBlocks; blockIndex++) {
        const traitCondition = conditionBlocks[blockIndex - 1];
        const blockNoiseIds = noiseIds.slice((blockIndex - 1) * rcBlockTrialCount, blockIndex * rcBlockTrialCount);
        let sideOrder = [];
        for (let i = 0; i < rcBlockTrialCount; i++) {
            sideOrder.push(i % 2 === 0);
        }
        sideOrder = jsPsych.randomization.shuffle(sideOrder);
        for (let blockTrialIndex = 1; blockTrialIndex <= rcBlockTrialCount; blockTrialIndex++) {
            trialIndex++;
            specs.push(createRcTrialSpec(
                blockNoiseIds[blockTrialIndex - 1],
                traitCondition,
                blockIndex,
                blockTrialIndex,
                trialIndex,
                sideOrder[blockTrialIndex - 1]
            ));
        }
    }
    return specs;
}

// Fullscreen setup
if (forceFullscreen) {
    timeline.push({
        type: 'fullscreen',
        fullscreen_mode: true,
        button_label: 'Enter fullscreen',
        message: "<p>This demo can run in full-screen mode.</p><p>Press the button below to begin.</p>",
        on_finish: function (data) {
            viewportWidth = get_viewport_size().width;
            viewportHeight = get_viewport_size().height;
            data.screen_width = viewportWidth;
            data.screen_height = viewportHeight;
            console.log("ID", subjName, "W", viewportWidth, "H", viewportHeight);
        }
    });
}

// Intro screens
if (showBoilerplate) {
    timeline.push(demoNotice);
    timeline.push(welcomePrompt);
}

timeline.push(rcInstructionScreenOne);
timeline.push(rcInstructionScreenTwo);
timeline.push(rcInstructionScreenThree);

if (typeof window !== 'undefined') {
    window.__mainBlockTrialTarget = rcBlockTrialCount;
    window.__mainBlockCount = rcTotalBlocks;
}

// Main task
const rcTrialSpecs = buildRcTrialSpecs();
if (typeof window !== 'undefined') {
    window.__rcPreloadImages = rcTrialSpecs.reduce(function (paths, trial) {
        paths.push(trial.left_image, trial.right_image);
        return paths;
    }, []);
}

for (let blockIndex = 1; blockIndex <= rcTotalBlocks; blockIndex++) {
    const blockTrials = rcTrialSpecs.filter(function (trial) {
        return trial.block_index === blockIndex;
    });
    const traitCondition = blockTrials[0].trait_condition;
    timeline.push({
        type: 'demo-html-keyboard-response',
        wait_duration: 1000,
        choices: ['space'],
        stimulus: renderRcBlockIntro(traitCondition, blockIndex, rcTotalBlocks),
        prompt: "Press SPACE to start this block.",
        data: {
            subj_id: subjName,
            test_part: 'rc_block_intro',
            block_index: blockIndex,
            trait_condition: traitCondition
        },
        on_start: function () {
            if (typeof updatePhaseBadge === 'function') {
                updatePhaseBadge(null);
            }
        }
    });

    timeline.push({
        timeline: [rcFaceTrial],
        timeline_variables: blockTrials,
        randomize_order: false
    });

    if (blockIndex < rcTotalBlocks) {
        timeline.push(breakPrompt(blockIndex, rcTotalBlocks));
    }
}

timeline.push(rcCompletePrompt);
timeline.push(recordRcSummary);

// UCLA survey
if (!skipUcla) {
    timeline.push(uclaIntro);
    for (let i = 1; i <= numUcla; i++) {
        timeline.push(uclaItem(uclaQuestions[i], i));
    }
} else if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('Skipping UCLA survey for testing. Set skipUcla to false to include it.');
}

// Debrief form
if (forceFullscreen) {
    timeline.push({
        type: 'fullscreen',
        fullscreen_mode: false,
        button_label: 'Exit fullscreen',
        message: '<p>You can now exit full-screen mode.</p>',
        on_finish: function (data) {
            viewportWidth = get_viewport_size().width;
            viewportHeight = get_viewport_size().height;
            data.screen_width = viewportWidth;
            data.screen_height = viewportHeight;
            console.log("ID", subjName, "W", viewportWidth, "H", viewportHeight);
        }
    });
}

timeline.push(checkDebriefResponse);
timeline.push(getCodePrompt);
timeline.push(showCodePrompt);
timeline.push(closePrompt);
console.log('Timeline ready', timeline);

// Browser checks
if (limitToGoogle) {
    let browserInfo = getBrowserInfo();
    if (browserInfo.browser !== 'Chrome') {
      Message = "This experiment is only supported by Google Chrome. Please reopen the experiment in Google Chrome.";
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
            "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.";
          let wrong_browser = {
            type: 'html-keyboard-response',
            stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
            choices: jsPsych.NO_KEYS,
          };
          jsPsych.init({
            timeline: [wrong_browser]
          });
        } else {
          startExpt();
        }
      } else {
        startExpt();
      }
    }
} else {
    if (limitToDesktop) {
      let mobileCheck = mobileAndTabletCheck();
      if (mobileCheck) {
        Message =
          "This experiment is only supported by desktop browsers, and cannot be run on a tablet or a phone. Please reopen the experiment in a desktop browser.";
        let wrong_browser = {
          type: 'html-keyboard-response',
          stimulus: ['<p style="font-size: 26px;">' + Message + '</p>'],
          choices: jsPsych.NO_KEYS,
        };
        jsPsych.init({
          timeline: [wrong_browser]
        });
      } else {
        startExpt();
      }
    } else {
      startExpt();
    }
}

