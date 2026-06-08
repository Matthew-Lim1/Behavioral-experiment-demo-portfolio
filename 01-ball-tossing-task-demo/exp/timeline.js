let timeline = [];

let instructions1 = {
    type: 'demo-html-keyboard-response',
    wait_duration: 1500,
    choices: ['space'],
    stimulus: "<div style='margin: auto 0'>"+
      "<p>In this experiment, you will be playing multiple rounds of a virtual ball passing game.</p>"+
      "<p>Each round, there will be 5 other participants joining the game.</p>"+
      "<p>Your goal as a group is to <b>work together and to get as many passes per round</b> as possible.</p>"+
      "<p>Below is a sample of what the game will look like:</p>"+
      "<div style='margin: 10px 0'><img src='images/image.png' alt='game demo' onerror=\"this.src='images/demo image.jpg'\" style='max-width:70%; border:1px solid #ddd'></div>"+
      "<p>The purple disk is you.<br>The yellow disk is the ball.<br>To pass the ball, <b>press the number key</b> corresponding to the number associated with that player.</p>"+
      "</div>",
    prompt: "Press SPACE to continue.",
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    }
};

let instructions2 = {
    type: 'demo-html-keyboard-response',
    wait_duration: 1500,
    choices: ['space'],
    stimulus: "<div style='margin: auto 0'>"+
      "<p>Because the goal is to make as many passes possible,</p><p>it may be beneficial to keep track of other players' speed and pass the ball to <b>the fastest player.</b></p>"+
      "<p>Similarly, if you are too slow to pass the ball, others may be noting this and not pass the ball to you.</p><p> Try your best to pass the ball <b>as fast as you can.</b></p>"+
      "</div>",
    prompt: "Press SPACE to continue.",
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    }
};

let begin_expt_prompt = {
    type: 'demo-html-keyboard-response',
    wait_duration: 1500,
    choices: ['space'],
    stimulus: "<div style='margin: auto 0'>"+
      "<p>If you feel that others are too slow, press the <b>0 key</b> to express a <b>sad face.</b> Other players will be evaluating your performance as well. At the end of each round, you will be asked <b>which players you thought were negatively evaluating you</b>.</p>"+
      "<p>There will be <b>two shortened demo rounds</b> in total, and you will be given the opportunity to practice this task before we begin. </p>"+
      "<p>But first, we want to get a sense of how you are feeling right now.</p>"+
      "</div>",
    prompt: "Press SPACE to continue.",
    data: {
      subj_id: subj_name,
      test_part: 'instruct_prompt'
    }
};

const name_pool = [
  'PlayerA','PlayerB','PlayerC','PlayerD','PlayerE','Riley','Jordan','Taylor','Casey','Morgan',
  'Avery','Sam','Quinn','Parker','Alex','Jamie','Drew','Sky','Kai','Rowan'
];

let key_trial = function(trial_num, condition, numerosity){
  var block = {
    type: 'demo-ball-tossing-task',
    condition: condition,
    numerosity: numerosity,
    total_passes_override: demo_passes_per_round,
    other_names: jsPsych.randomization.sampleWithoutReplacement(name_pool, 5),

    player_name: function(){
      return player_name_global || 'you';
    },
    data: {
        subj_id: subj_name,
        test_part: 'key_trial',
        trial_num: trial_num,
        condition: condition,
        numerosity: numerosity
    },
    on_finish: function () {
        saveData(subj_name, jsPsych.data.get().csv());
    }
  }
  return block;
};

var packet_a4_intro = { // State loneliness
  type: 'demo-html-keyboard-response',
  wait_duration: 1500,
  choices: ['space'],
  stimulus: "<p>Please use the scales to describe yourself RIGHT NOW.  Do not spend too much time on any one item.  Be sure to read each scale carefully. </p></div>",
  prompt: "Press SPACE to continue.",
  data: {
    subj_id: subj_name,
    test_part: 'instruct_prompt'
  }
};

var packet_a4_qs = { // State loneliness
  1: 'relaxed',
  2: 'tensed',
  3: 'sad',
  4: 'worried',
  5: 'lonely',
  6: 'bored',
  7: 'angry',
  8: 'hostile',
  9: 'alert',
  10: 'happy',
};

let num_packet_a4 = Object.keys(packet_a4_qs).length; // Count survey items

var packet_a4_q = function (item, id) { // State loneliness
  var trial_prompt = {
    type: 'demo-html-button-response',
    stimulus: '',
    on_start: function (trial) {
      document.body.style.cursor = 'default'; // Show cursor
      trial.stimulus = "<p>" + id + "/" + num_packet_a4 + "</p><p>To what extent do you feel like this:<br><b>" + item + "</b></p>";
      trial.choices = ['1 - Not at All', '2 - A Little', '3 - Moderately', '4 - Quite a Bit', '5 - Extremely'];
    },
    wait_duration: 500,
    data: {
      subj_id: subj_name,
      test_part: 'MOOD1',
      id: id
    },
    on_finish: function (data) {
        var file_name = 'partial_' + subj_name
        saveData(file_name, jsPsych.data.get().csv());
    }
  };
  return trial_prompt;
};

var player_name_global = 'You';

var enter_name_trial = {
  type: 'survey-html-form',
  html: `
    <div style="width: 60%; margin: 0 auto; text-align: center;">
      <p><b>Choose the name other players will see:</b></p>
      <input name="pname" type="text" maxlength="15"
        style="width: 60%; border-radius: 4px; padding: 10px; border: 1px solid #ccc; font-size: 16px"
        placeholder="e.g., Player A" />
    </div>
  `,
  button_label: 'Continue',
  on_start: function() {
    document.body.style.cursor = 'default'; // Show cursor for username
  },
  check_blanks: true,
  on_finish: function(d){
    const resp = JSON.parse(d.responses);
    player_name_global = (resp.pname || 'You').trim() || 'You';
  },
  data: { test_part: 'enter_name' }
};

var waiting_room = {
  type: 'demo-html-keyboard-response',
  choices: jsPsych.NO_KEYS,
  stimulus: `
    <div style="margin: 0 auto; width: 100%;">
      <p><b>Connecting to the lobby</b></p>
      <p id="match-msg">Waiting for other players<span id="dots"></span></p>
      <p style="margin-top: 20px; color: #555; font-size: 90%">
        Your display name will be <b id="pname-slot"></b>
      </p>
    </div>
  `,
  trial_duration: 8000,
  on_load: function(){
    const dotsEl = document.getElementById('dots');
    const nameEl = document.getElementById('pname-slot');
    if (nameEl) nameEl.textContent = player_name_global;
    let tick = 0;
    const id = setInterval(()=>{
      tick = (tick+1)%4;
      if (dotsEl) dotsEl.textContent = '.'.repeat(tick);
    }, 300);
  }
};

var postblock_waitroom = {
  type: 'demo-html-keyboard-response',
  choices: jsPsych.NO_KEYS,
  stimulus: `
    <div style="margin: 0 auto; width: 100%;">
      <p id="match-msg">Waiting for others to finish responding<span id="dots"></span></p>
    </div>
  `,
  trial_duration: jsPsych.randomization.sampleWithoutReplacement([2000, 3000, 4000, 5000, 6000], 1)[0],
  on_load: function(){
    const dotsEl = document.getElementById('dots');
    let tick = 0;
    const id = setInterval(()=>{
      tick = (tick+1)%4;
      if (dotsEl) dotsEl.textContent = '.'.repeat(tick);
    }, 300);
  }
};

var postblock_waitroom2= {
  type: 'demo-html-keyboard-response',
  choices: jsPsych.NO_KEYS,
  stimulus: `
    <div style="margin: 0 auto; width: 100%;">
      <p><b>Beginning next round</b></p>
      <p id="match-msg">Waiting for other players<span id="dots"></span></p>
    </div>
  `,
  trial_duration: jsPsych.randomization.sampleWithoutReplacement([2000, 3000, 4000, 5000, 6000], 1)[0],
  on_load: function(){
    const dotsEl = document.getElementById('dots');
    let tick = 0;
    const id = setInterval(()=>{
      tick = (tick+1)%4;
      if (dotsEl) dotsEl.textContent = '.'.repeat(tick);
    }, 300);
  }
};

var packet_a4_wrapup_2 = { // State loneliness (WRAP UP)
  type: 'demo-html-keyboard-response',
  wait_duration: 1500,
  choices: ['space'],
  stimulus: "<p>Please use the scales to describe yourself RIGHT NOW.  Do not spend too much time on any one item.  Be sure to read each scale carefully. </p></div>",
  prompt: "Press SPACE to continue.",
  data: {
    subj_id: subj_name,
    test_part: 'instruct_prompt'
  }
};

var packet_a4_qs_2 = { // State loneliness
  1: 'relaxed',
  2: 'tensed',
  3: 'sad',
  4: 'worried',
  5: 'lonely',
  6: 'bored',
  7: 'angry',
  8: 'hostile',
  9: 'alert',
  10: 'happy',
};

let num_packet_a4_2 = Object.keys(packet_a4_qs_2).length; // Count survey items

var packet_a4_q_2 = function (item, id) { // State loneliness
  var trial_prompt = {
    type: 'demo-html-button-response',
    stimulus: '',
    on_start: function (trial) {
      document.body.style.cursor = 'default'; // Show cursor
      trial.stimulus = "<p>" + id + "/" + num_packet_a4_2 + "</p><p>To what extent do you feel like this:<br><b>" + item + "</b></p>";
      trial.choices = ['1 - Not at All', '2 - A Little', '3 - Moderately', '4 - Quite a Bit', '5 - Extremely'];
    },
    wait_duration: 500,
    data: {
      subj_id: subj_name,
      test_part: 'MOOD2',
      id: id
    },
    on_finish: function (data) {
        var file_name = 'partial_' + subj_name
        saveData(file_name, jsPsych.data.get().csv());
    }
  };
  return trial_prompt;
};

var ucla_intro = { // UCLA intro
  type: 'demo-html-keyboard-response',
  wait_duration: 3000,
  choices: ['space'],
  stimulus: "<p>The following statements describe how people sometimes feel. For each statement, please indicate <b>how often</b> you feel the way described.</p><p>Example: If you never feel happy, choose <em>Never</em>. If you always feel happy, choose <em>Always</em>.</p>",
  prompt: "Press SPACE to continue.",
  data: {
    subj_id: subj_name,
    test_part: 'instruct_prompt'
  }
};

var ucla_qs = { // UCLA questions
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
  20: 'feel that there are people you can turn to?',
};

let num_ucla = Object.keys(ucla_qs).length; // Count survey items

var ucla_item = function (item, id) { // UCLA item
  var trial_prompt = {
    type: 'demo-html-button-response',
    stimulus: '',
    on_start: function (trial) {
      document.body.style.cursor = 'default'; // Show cursor
      trial.stimulus = "<p>" + id + "/" + num_ucla + "</p><p><b>Please indicate what you generally do, not what you think you should do.</b></p><p>How often do you...<br>" + item + "</p>"; 
      trial.choices = ['Never', 'Rarely', 'Sometimes', 'Always'];
    },
    wait_duration: 1500,
    data: {
      subj_id: subj_name,
      test_part: 'UCLA',
      id: id
    },
    on_finish: function (data) {
        var file_name = 'partial_' + subj_name
        saveData(file_name, jsPsych.data.get().csv());
    }
  };
  return trial_prompt;
};









