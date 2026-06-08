/*
 * Example plugin template
 */

jsPsych.plugins["demo-ball-tossing-task"] = (function () {

  var plugin = {};

  plugin.info = {
    name: "demo-ball-tossing-task",
    parameters: {
      condition: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'post-oops' // countdown or stopwatch
      },
      numerosity: {
        type: jsPsych.plugins.parameterType.INT,
        default: 1
      },
      player_name: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'you'
      },
      total_passes_override: {
        type: jsPsych.plugins.parameterType.INT,
        default: null
      },
      practice_label: {
        type: jsPsych.plugins.parameterType.BOOL,
        default: false // If true, show 'Practice Demo' label at top of screen
      }
    }
  }

  plugin.trial = function (display_element, trial) {

    // Setup size of canvas
    var canvas_w = window.innerWidth * .9;
    var canvas_h = window.innerHeight * .9;

    // Draw canvas
    document.body.style.cursor = 'none';
    display_element.innerHTML = "<div>" + "<canvas id='myCanvas' width='" + canvas_w + "' height='" + canvas_h + "'></canvas>" + "</div>";
    var canvas = display_element.querySelector('#myCanvas');
    var context = canvas.getContext('2d');

    // Draw practice_label if true, add text at top
    if (trial.practice_label) {
      const label = document.createElement("div");
      label.textContent = "PRACTICE DEMO";
      label.style.position = "absolute";
      label.style.top = "60px";
      label.style.left = "5%";
      label.style.fontSize = "24px";
      label.style.fontWeight = "bold";
      label.style.color = "purple";
      label.style.fontFamily = "Arial, sans-serif";
      display_element.appendChild(label);
    }


    // Setup disc parameters
    var disc_radius = canvas_w * .05;
    var disc_outline = 'black';
    var ball_distance = disc_radius + disc_radius / 8;
    
    let other_names;

    if (trial.other_names && trial.other_names.length === 5) {
      other_names = trial.other_names;
    } else if (trial.condition === 'practice') {
      other_names = ['A','B','C','D','E'];
    } else {
      other_names = ['1','2','3','4','5'];
    }

    const centerNums = ['1','2','3','4','5'];

    const usernameHoverOffset = (r) => (r + 12);

    var disc_A = {};
    disc_A.color = 'purple';
    disc_A.pos_x1 = canvas_w / 2;
    disc_A.pos_y1 = canvas_h - disc_radius - 1;
    disc_A.radius = disc_radius;
    disc_A.name = trial.player_name || 'you';

    var disc_B = {};
    disc_B.color = '#A9A9A9';
    disc_B.pos_x1 = canvas_w / 3 - disc_radius + 4;
    disc_B.pos_y1 = 2 * canvas_h / 3 + disc_radius - 10;
    disc_B.radius = disc_radius;
    disc_B.name = other_names[0];
    disc_B.name_offset_y = -usernameHoverOffset(disc_B.radius);
    disc_B.center_text = centerNums[0];

    var disc_C = {};
    disc_C.color = '#A9A9A9';
    disc_C.pos_x1 = canvas_w / 3 - disc_radius + 4;
    disc_C.pos_y1 = canvas_h / 3 + 15;
    disc_C.radius = disc_radius;
    disc_C.name = other_names[1];
    disc_C.name_offset_y = -usernameHoverOffset(disc_C.radius);
    disc_C.center_text = centerNums[1];

    var disc_D = {};
    disc_D.color = '#A9A9A9';
    disc_D.pos_x1 = canvas_w / 2;
    disc_D.pos_y1 = 35 + disc_radius;
    disc_D.radius = disc_radius;
    disc_D.name = other_names[2];
    disc_D.name_offset_y = -usernameHoverOffset(disc_D.radius);
    disc_D.center_text = centerNums[2];


    var disc_E = {};
    disc_E.color = '#A9A9A9';
    disc_E.pos_x1 = 2 * canvas_w / 3 + disc_radius - 4;
    disc_E.pos_y1 = canvas_h / 3 + 15;
    disc_E.radius = disc_radius;
    disc_E.name = other_names[3];
    disc_E.name_offset_y = -usernameHoverOffset(disc_E.radius);
    disc_E.center_text = centerNums[3];

    var disc_F = {};
    disc_F.color = '#A9A9A9';
    disc_F.pos_x1 = 2 * canvas_w / 3 + disc_radius - 4;
    disc_F.pos_y1 = 2 * canvas_h / 3 + disc_radius - 10;
    disc_F.radius = disc_radius;
    disc_F.name = other_names[4];
    disc_F.name_offset_y = -usernameHoverOffset(disc_F.radius);
    disc_F.center_text = centerNums[4];
    
    var ball = {
    color : '#edba54ff',
    radius : disc_radius / 4,
    name : ''
    };
    const pos = ball_near_disc(disc_A);
    ball.pos_x1 = pos.x;
    ball.pos_y1 = pos.y;
    
    // Setup ball pos in relative to disc pos
    function ball_near_disc(disc) {
      const cx = canvas_w / 2;
      const cy = canvas_h / 2;

      const dx = cx - disc.pos_x1;
      const dy = cy - disc.pos_y1;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      return {
        x: disc.pos_x1 + nx * (disc.radius + ball.radius - ball.radius/2),
        y: disc.pos_y1 + ny * (disc.radius + ball.radius - ball.radius/2)
      };
    }
    // Setup time variables
    var choices = [];
    var response_times = [];
    var start_time = performance.now();
    var response_time = 0;
    var start_response_clock = 0;
    var show_sad_time = 100; // show :( for 100ms
    const SLOW_RESPONSE_THRESHOLD_MS = 1050;
    const OOPS_MESSAGE_DURATION_MS = 1200;

    // Setup counters / switches
    var num_passes = 0;
    var start_exclusion = 0;
    var who_has_ball = 0;
    var self_sad_until = 0;   // when > now, show :( on self (0-key emote)
    var user_emote_count = 0; // count of 0-key presses
    var oops_text_until = 0;

    // Setup parameters
    var total_passes = trial.total_passes_override != null
    ? trial.total_passes_override
    : 300;

    const trigger_oops_msg = get_random_value(range(38, 42)); 

    var number_of_players_excluding_you = trial.numerosity; //get_random_value(range(1, 5));
    console.log(trial.condition, total_passes)

    // Draw disc
    function draw_disc(disc, trigger) {
      context.beginPath();
      context.arc(disc.pos_x1, disc.pos_y1, disc.radius, 0, 2 * Math.PI);
      context.fillStyle = disc.color;
      context.fill();
      context.strokeStyle = disc_outline;
      context.stroke();
      context.closePath();

      context.font = "bold 20px Arial";
      context.fillStyle = '#580c0cff';
      context.textAlign = 'center';
      context.textBaseline =  'middle';

      if (disc.center_text) {
        context.font = `bold 24px Arial`;
        context.textBaseline = 'middle';
        context.fillStyle = 'black';
        context.fillText(disc.center_text, disc.pos_x1, disc.pos_y1);
      } else if (disc.name && !(trigger === 1 && disc === disc_A)) {
        context.font = 'bold 20px Arial';
        context.textBaseline = 'middle';
        context.fillStyle = '#d6d6dbff';
        context.fillText(disc.name, disc.pos_x1, disc.pos_y1);
      }

      if (disc.name && typeof disc.name_offset_y === 'number' && !(trigger === 1 && disc === disc_A)) {
        context.font = 'bold 20px Arial';
        context.textBaseline = 'alphabetic';
        context.fillStyle = '#580c0cff';
        const labelY = disc.pos_y1 + disc.name_offset_y;
        context.fillText(disc.name, disc.pos_x1, labelY);
      }

      if (trigger === 1 && disc === disc_A) {
        context.font = `bold 24px Arial`;
        context.textBaseline = 'middle';
        context.fillStyle = '#d6d6dbff';
        context.fillText(':(', disc.pos_x1, disc.pos_y1);
      }
    }

    // Draw and animate disc pair
function render_scene() {
      context.clearRect(0, 0, canvas_w, canvas_h);
      const now = performance.now();
      const selfSad = now < self_sad_until ? 1 : 0;
      draw_disc(disc_A, selfSad);
      draw_disc(disc_B, 0);
      draw_disc(disc_C, 0);
      draw_disc(disc_D, 0);
      draw_disc(disc_E, 0);
      draw_disc(disc_F, 0);
      draw_disc(ball);
      if (now < oops_text_until) {
        context.save();
        context.font = 'bold 25px Arial';
        context.fillStyle = '#d3222a';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Oops! You were too slow.', canvas_w / 2, canvas_h / 2);
        context.restore();
      }
}

function draw_discs() {
      render_scene();
      play_round();
}

    // Add 0-key emote hint UI
    (function(){
      const hint = document.createElement('div');
      hint.textContent = "Press [0] to :(";
      hint.style.position = 'fixed';
      hint.style.right = '6%';
      hint.style.bottom = '6%';
      hint.style.fontFamily = 'Arial, sans-serif';
      hint.style.fontSize = '16px';
      hint.style.color = '#444';
      hint.style.fontWeight = 'bold';
      display_element.appendChild(hint);
    })();

    // Allow emote (0-key) at any time
    function handleZero(e){
      if (!e) return;
      const k = e.key;
      if (k === '0' || k === 0) {
        user_emote_count += 1;
        self_sad_until = performance.now() + 200;
        try { render_scene(); } catch(err){}
        try { setTimeout(render_scene, 210); } catch(err){}
      }
    }
    document.addEventListener('keydown', handleZero);

    draw_discs();
    function get_choice(event) {
      const youHadBall = (who_has_ball === 0);
      const key = event.key;
      const numericKey = (typeof key === 'string') ? parseInt(key, 10) : key;
      const isEmoteKey = (numericKey === 0);
      const isPassKey = (numericKey >= 1 && numericKey <= 5);
      if (!isEmoteKey && !isPassKey) {
        // Ignore non-game keys (e.g., Shift) while waiting for a valid pass/emote.
        return;
      }
      response_time = performance.now() - start_response_clock;
      if (youHadBall && isPassKey){
        const isPractice = (trial.condition === 'practice') || (trial.practice_label === true);
        if (response_time > SLOW_RESPONSE_THRESHOLD_MS) {
          oops_text_until = performance.now() + OOPS_MESSAGE_DURATION_MS;
          try { render_scene(); } catch(e){}
          try { setTimeout(render_scene, OOPS_MESSAGE_DURATION_MS + 50); } catch(e){}
        }
        if (!isPractice && response_time > SLOW_RESPONSE_THRESHOLD_MS) {
          try { console.log('slow response', Math.round(response_time), 'ms'); } catch(e){}
        }
      }
      document.removeEventListener('keydown', get_choice);
      if (isEmoteKey) {
        // Emote spam doesn't pass the ball
        user_emote_count += 1;
        self_sad_until = performance.now() + 200;
        // keep waiting for an actual pass
        document.addEventListener('keydown', get_choice);
        try { render_scene(); } catch(e){}
        try { setTimeout(render_scene, 210); } catch(e){}
        return;
      } else if (numericKey == 1) {
        const pos = ball_near_disc(disc_B);
        ball.pos_x1 = pos.x; // Type 1, not for other people.
        ball.pos_y1 = pos.y;
        who_has_ball = 1;
      } else if (numericKey == 2) {
        const pos = ball_near_disc(disc_C);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 2;
      } else if (numericKey == 3) {
        const pos = ball_near_disc(disc_D);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 3;
      } else if (numericKey == 4) {
        const pos = ball_near_disc(disc_E);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 4;
      } else if (numericKey == 5) {
        const pos = ball_near_disc(disc_F);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 5;
      }
      response_times.push(response_time);
      choices.push(who_has_ball);
      draw_discs();
    }
    function get_next_player(choice) {
      if (who_has_ball === 0 && choice !== 0) {
        oops_text_until = 0;
      }
      if (choice == 1) {
        const pos = ball_near_disc(disc_B);
        ball.pos_x1 = pos.x; // Other people pass to 1
        ball.pos_y1 = pos.y;
        who_has_ball = 1;
      } else if (choice == 2) {
        const pos = ball_near_disc(disc_C);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 2;
      } else if (choice == 3) {
        const pos = ball_near_disc(disc_D);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 3;
      } else if (choice == 4) {
        const pos = ball_near_disc(disc_E);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 4;
      } else if (choice == 5) {
        const pos = ball_near_disc(disc_F);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 5;
      } else if (choice == 0) {
        const pos = ball_near_disc(disc_A);
        ball.pos_x1 = pos.x;
        ball.pos_y1 = pos.y;
        who_has_ball = 0;
      }
      response_times.push(response_time);
      choices.push(who_has_ball);
      draw_discs();
    }

    function setup_choices() {
      if (start_exclusion == 0) {
        if (who_has_ball == 1) {
          choices = [0, 0, 2, 3, 4, 5];
        } else if (who_has_ball == 2) {
          choices = [0, 0, 1, 3, 4, 5];
        } else if (who_has_ball == 3) {
          choices = [0, 0, 1, 2, 4, 5];
        } else if (who_has_ball == 4) {
          choices = [0, 0, 1, 2, 3, 5];
        } else if (who_has_ball == 5) {
          choices = [0, 0, 1, 2, 3, 4];
        }
      } else if (start_exclusion == 1) {
        if (number_of_players_excluding_you == 0) {
          if (who_has_ball == 1) {
            choices = [0, 2, 3, 4, 5];
          } else if (who_has_ball == 2) {
            choices = [0, 1, 3, 4, 5];
          } else if (who_has_ball == 3) {
            choices = [0, 1, 2, 4, 5];
          } else if (who_has_ball == 4) {
            choices = [0, 1, 2, 3, 5];
          } else if (who_has_ball == 5) {
            choices = [0, 1, 2, 3, 4];
          }
        } else if (number_of_players_excluding_you == 1) {
          if (who_has_ball == 1) {
            choices = [0, 2, 3, 4, 5];
          } else if (who_has_ball == 2) {
            choices = [0, 1, 3, 4, 5];
          } else if (who_has_ball == 3) {
            choices = [0, 1, 2, 4, 5];
          } else if (who_has_ball == 4) {
            choices = [0, 1, 2, 3, 5];
          } else if (who_has_ball == 5) { // Player 5 starts excluding you 
            choices = [1, 2, 3, 4];
          }
        } else if (number_of_players_excluding_you == 2) {
          if (who_has_ball == 1) {
            choices = [0, 2, 3, 4, 5];
          } else if (who_has_ball == 2) {
            choices = [0, 1, 3, 4, 5];
          } else if (who_has_ball == 3) { // Player 3 starts excluding you 
            choices = [1, 2, 4, 5];
          } else if (who_has_ball == 4) {
            choices = [0, 1, 2, 3, 5];
          } else if (who_has_ball == 5) { // Player 5 starts excluding you 
            choices = [1, 2, 3, 4];
          }
        } else if (number_of_players_excluding_you == 3) {
          if (who_has_ball == 1) {
            choices = [0, 2, 3, 4, 5];
          } else if (who_has_ball == 2) { // Player 2 starts excluding you
            choices = [1, 3, 4, 5];
          } else if (who_has_ball == 3) { // Player 3 starts excluding you 
            choices = [1, 2, 4, 5];
          } else if (who_has_ball == 4) {
            choices = [0, 1, 2, 3, 5];
          } else if (who_has_ball == 5) { // Player 5 starts excluding you 
            choices = [1, 2, 3, 4];
          }
        } else if (number_of_players_excluding_you == 4) {
          if (who_has_ball == 1) { // Player 1 starts excluding you
            choices = [2, 3, 4, 5];
          } else if (who_has_ball == 2) { // Player 2 starts excluding you
            choices = [1, 3, 4, 5];
          } else if (who_has_ball == 3) { // Player 3 starts excluding you 
            choices = [1, 2, 4, 5];
          } else if (who_has_ball == 4) {
            choices = [0, 1, 2, 3, 5];
          } else if (who_has_ball == 5) { // Player 5 starts excluding you 
            choices = [1, 2, 3, 4];
          }
        } else if (number_of_players_excluding_you == 5) {
          if (who_has_ball == 1) { // Player 1 starts excluding you
            choices = [2, 3, 4, 5];
          } else if (who_has_ball == 2) { // Player 2 starts excluding you
            choices = [1, 3, 4, 5];
          } else if (who_has_ball == 3) { // Player 3 starts excluding you 
            choices = [1, 2, 4, 5];
          } else if (who_has_ball == 4) { // Player 4 starts excluding you
            choices = [1, 2, 3, 5];
          } else if (who_has_ball == 5) { // Player 5 starts excluding you 
            choices = [1, 2, 3, 4];
          }
        }
      }
      
      if (who_has_ball == 0) {
        console.log('you have the ball');
        const isPractice = (trial.condition === 'practice') || (trial.practice_label === true);
        const isTriggerPass = (num_passes == trigger_oops_msg);
        const user_input_lock = isPractice
          ? 0
          : 0; 
        start_response_clock = performance.now();
        document.removeEventListener('keydown', get_choice);
        if (user_input_lock > 0) {
          setTimeout(() => {
            document.addEventListener('keydown', get_choice);
          }, user_input_lock);
        } else {
          document.addEventListener('keydown', get_choice);
        }
        
      } else {
        setTimeout(function () {
          if (num_passes == trigger_oops_msg - 1){
            get_next_player(0);
          } else {
            get_next_player(choices[Math.floor(Math.random() * choices.length)]);
          }
        }, get_random_value([350, 450, 550, 750, 1000]));
      }
    }
    
    function play_round() {
      num_passes += 1;
      if (num_passes > total_passes) {
        setTimeout(end_trial, show_sad_time);
        return;
      }
      if (num_passes === total_passes) {
        // End of round without any extra messaging or sad faces
        setTimeout(end_trial, show_sad_time);
        return;
      }
      if (num_passes === trigger_oops_msg) {
        if (start_exclusion === 0 && trial.condition === 'post-exclusion') {
          start_exclusion = 1;
          console.log('you are being excluded');
        }
        setup_choices();
        return;
      }
      setup_choices()
    }

    function get_true_excluder_indices(n){
      // returns array of player indices [1..5] who exclude the participant when exclusion starts
      if (n <= 0) return [];
      if (n === 1) return [5];
      if (n === 2) return [3,5];
      if (n === 3) return [2,3,5];
      if (n === 4) return [1,2,3,5];
      return [1,2,3,4,5];
    }

    function end_trial() {

      // gather the data to store for the trial
      const true_excluder_indices = get_true_excluder_indices(number_of_players_excluding_you);
      const other_names_arr = [disc_B.name, disc_C.name, disc_D.name, disc_E.name, disc_F.name];
      const true_excluder_names = true_excluder_indices.map(i => other_names_arr[i-1]);

      let trial_data = {
        choices: choices,
        response_times: response_times,
        trigger_oops_msg: trigger_oops_msg,
        true_num_excluders: number_of_players_excluding_you,
        other_names: other_names_arr,
        true_excluder_indices: true_excluder_indices,
        true_excluder_names: true_excluder_names,
        user_emote_count: user_emote_count
      };

      // remove listeners
      try { document.removeEventListener('keydown', get_choice); } catch(e){}
      try { document.removeEventListener('keydown', handleZero); } catch(e){}
      // clear the display
      try { document.body.style.cursor = 'default'; } catch(e){}
      display_element.innerHTML = '';

      // move on to the next trial
      jsPsych.finishTrial(trial_data);
    }

  };

  return plugin;
})();


