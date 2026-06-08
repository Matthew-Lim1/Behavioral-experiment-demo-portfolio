// Timeline setup
if (forceFullscreen) {
timeline.push({
    type: 'fullscreen',
    fullscreen_mode: true,
    button_label: 'Enter Fullscreen',
    message: "<p>This demo can optionally run in full-screen mode. Once in full-screen mode, please stay in the task window until the demo is complete.</p><br><br>",
    on_finish: function (data) {
        viewport_width = get_viewport_size().width;
        viewport_height = get_viewport_size().height;
        data.screen_width = viewport_width;
        data.screen_height = viewport_height;
        console.log("ID", subj_name, "W", viewport_width, "H", viewport_height)
    }
});
}
if (show_boilerplate) {
    timeline.push(demo_notice);
    timeline.push(welcome_prompt);
    timeline.push(instructions1);
    timeline.push(instructions2);
    timeline.push(begin_expt_prompt);
    timeline.push(packet_a4_intro);
    for (i = 1; i < num_packet_a4+1; i++) {
      timeline.push(packet_a4_q(packet_a4_qs[i], i));
    };
    
    // Practice round
    timeline.push({
      type: 'demo-ball-tossing-task',
      condition: 'practice',
      numerosity: 1,
      total_passes_override: demo_practice_passes,
      practice_label:true,
      player_name: 'Practice',
      data: {test_part: 'practice'},
      on_start: function() {
        document.body.style.cursor = 'none';
      },
      on_finish: function(){
        saveData(subj_name, jsPsych.data.get().csv());
      }
    });
    timeline.push(blank);
}

// USERNAME & WAITING ROOM
timeline.push(enter_name_trial);
timeline.push(waiting_room);

// Main experiment
const postOopsBlocks = [['post-oops', 0],['post-oops', 1],['post-oops', 2],['post-oops', 3],['post-oops', 4]];
const postExclBlocks = [['post-exclusion', 0],['post-exclusion', 1],['post-exclusion', 2],['post-exclusion', 3],['post-exclusion', 4]];

const assignedGroup = 'post-exclusion';
jsPsych.data.addProperties({ assignedGroup });
console.log(assignedGroup);

const blocks = (assignedGroup === 'post-oops')
  ? jsPsych.randomization.shuffle(postOopsBlocks.slice())
  : jsPsych.randomization.shuffle(postExclBlocks.slice());
const demoBlocks = blocks.slice(0, demo_rounds);

let trial_num = 0;
for (let b = 0; b < demoBlocks.length; b++) {
  const [cond, num] = demoBlocks[b];
  const currentBlock = b + 1;
  // Ball Tossing Task
  timeline.push(key_trial(trial_num, cond, num));
  timeline.push(blank);
  // POST-ROUND SURVEY
  timeline.push({
    type: 'survey-multi-select',
    preamble: `<style>
      .jspsych-survey-multi-select-question { text-align:center; }
      .jspsych-survey-multi-select-option { display:inline-block; margin:8px; }
      .jspsych-survey-multi-select-option input[type=checkbox]{ display:none; }
      .jspsych-survey-multi-select-option label.jspsych-survey-multi-select-text{
        width:56px; height:56px; display:inline-flex; align-items:center; justify-content:center;
        border:2px solid #888; border-radius:10px; font-weight:700; font-family:Arial, sans-serif;
        background:#fff; color:#333; cursor:pointer; user-select:none;
      }
      .jspsych-survey-multi-select-option input[type=checkbox]:checked + label{
        background:#5b82f7; border-color:#5b82f7; color:#fff;
      }
      /* Make only the first option (No One) wider to fit the text */
      #jspsych-survey-multi-select-response-0-0 + label.jspsych-survey-multi-select-text{
        width:auto; min-width:110px; padding:0 12px;
      }
    </style>`,
    questions: [{
      prompt: `<p>Round ${currentBlock} complete.</p><p>Do you think some players stopped passing the ball to you by the end?</p><p>If so, indicate <b>which player(s)</b> you think rated you negatively.</p>` +
              `<div style="margin:10px 0"><img src="images/image.png" alt="game layout" onerror="this.src='images/demo image.jpg'" style="max-width:70%; border:1px solid #ddd"></div>`,
      options: ['No One','1','2','3','4','5'],
      required: false,
      horizontal: true,
      name: 'neg_raters'
    }],
    on_start: function(){ document.body.style.cursor = 'default'; },
    on_finish: function(data){
      try {
        const resp = JSON.parse(data.responses) || {};
        let picks = resp['neg_raters'] || [];
        if (!Array.isArray(picks)) { picks = [picks]; }
        // Normalize selections: if 'No One' present, treat as empty selection
        const hasNoOne = picks.indexOf('No One') !== -1;
        const selected_indices = hasNoOne ? [] : picks.map(v => parseInt(v, 10)).filter(n => !isNaN(n));

        // Get the immediately preceding key_trial row for ground truth
        const lastKey = jsPsych.data.get().filter({ test_part: 'key_trial' }).last(1).values()[0] || {};
        const true_idx = Array.isArray(lastKey.true_excluder_indices) ? lastKey.true_excluder_indices : [];
        const other_names = Array.isArray(lastKey.other_names) ? lastKey.other_names : ['1','2','3','4','5'];
        const selected_names = selected_indices.map(i => other_names[i-1]).filter(Boolean);
        const true_names = Array.isArray(lastKey.true_excluder_names) ? lastKey.true_excluder_names : true_idx.map(i => other_names[i-1]);

        // Compute set metrics
        const setA = new Set(selected_indices);
        const setB = new Set(true_idx);
        let tp = 0; setA.forEach(x => { if (setB.has(x)) tp++; });
        const fp = Math.max(0, setA.size - tp);
        const fn = Math.max(0, setB.size - tp);
        const precision = (tp + fp) > 0 ? (tp / (tp + fp)) : (setA.size === 0 ? 1 : 0);
        const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : (setB.size === 0 ? 1 : 0);
        const f1 = (precision + recall) > 0 ? (2 * precision * recall / (precision + recall)) : 0;
        const exact_match = (fp === 0 && fn === 0);

        // Attach to survey row
        data.subj_id = subj_id ;
        data.neg_raters_raw = picks;
        data.selected_indices = selected_indices;
        data.selected_names = selected_names;
        data.number_selected = selected_indices.length;
        data.true_excluder_indices = true_idx;
        data.true_excluder_names = true_names;
        data.true_num_excluders = lastKey.true_num_excluders;
        data.correct_exact_match = exact_match;
        data.tp = tp;
        data.precision = precision; data.recall = recall; data.f1 = f1;
      } catch(e) {
        console.warn('postround scoring error', e);
      }
      let file_name = 'partial_' + subj_name;
      saveData(file_name, jsPsych.data.get().csv());
    },
    data: {
      test_part: 'postround_survey',
      round: currentBlock,
      assignedGroup: assignedGroup,
      condition: cond,
      numerosity: num
    }
  });
  if (currentBlock < demoBlocks.length) {
    timeline.push(postblock_waitroom);
    timeline.push(postblock_waitroom2);
  }

  trial_num++;
}



// Debriefing section
timeline.push(packet_a4_wrapup_2);
    for (i = 1; i < num_packet_a4_2+1; i++) {
      timeline.push(packet_a4_q_2(packet_a4_qs_2[i], i));
    };
timeline.push(ucla_intro);
    for (i = 1; i < num_ucla+1; i++) {
      timeline.push(ucla_item(ucla_qs[i], i));
    };
if (forceFullscreen) {
timeline.push({
    type: 'fullscreen',
    fullscreen_mode: false,
    button_label: 'Exit Fullscreen',
    message: '<p>You can now exit full screen mode.</p>',
    on_finish: function (data) {
        viewport_width = get_viewport_size().width;
        viewport_height = get_viewport_size().height;
        data.screen_width = viewport_width;
        data.screen_height = viewport_height;
        console.log("ID", subj_name, "W", viewport_width, "H", viewport_height)
    }
});
}
timeline.push(check_debrief_response);
timeline.push(get_code_prompt);
timeline.push(show_code_prompt);
timeline.push(close_prompt);
console.log(timeline);


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







