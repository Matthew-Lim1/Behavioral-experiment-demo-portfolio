/*
 * Example plugin template
 */

jsPsych.plugins["demo-animate-discs"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "demo-animate-discs",
    parameters: {
      rhythm_condition: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'natural' // countdown or stopwatch
      },
    }
  }

  plugin.trial = function(display_element, trial) {

    // Setup size of canvas
    var canvas_w = window.innerWidth*.8;
    var canvas_h = window.innerHeight*.8;

    // Draw canvas
    document.body.style.cursor = 'none';
    display_element.innerHTML = "<div>"+"<canvas id='myCanvas' width='"+canvas_w+"' height='"+canvas_h+"'></canvas>"+"</div>";
    var canvas = display_element.querySelector('#myCanvas');
    var context = canvas.getContext('2d');

    // Setup disc parameters
    var disc_radius = canvas_w*.05;
    var disc_outline = 'black';
    var disc_distance = canvas_w*.05;

    var disc_pair_A = {};
    disc_pair_A.color = '#A9A9A9';
    disc_pair_A.neutral = 'white';
    disc_pair_A.pos_x1 = 50;
    disc_pair_A.pos_y1 = 50;
    disc_pair_A.pos_x2 = disc_pair_A.pos_x1 + disc_radius*2 + disc_distance;
    disc_pair_A.pos_y2 = disc_pair_A.pos_y1;
    disc_pair_A.phase = 0;
    disc_pair_A.frame_num = 0;
    disc_pair_A.tempo = 20;

    var disc_pair_B = {};
    disc_pair_B.color = '#808080';
    disc_pair_B.neutral = '#D3D3D3';
    disc_pair_B.pos_x1 = 300;
    disc_pair_B.pos_y1 = 250;
    disc_pair_B.pos_x2 = disc_pair_B.pos_x1 + disc_radius*2 + disc_distance;
    disc_pair_B.pos_y2 = disc_pair_B.pos_y1;
    disc_pair_B.phase = 0;
    disc_pair_B.frame_num = 0;
    disc_pair_B.tempo = 40;

    // Setup time variables
    var start_time = performance.now();
    var current_time = performance.now();
    var time_elapsed = 0;
    var percent_time = 0;
    var trial_duration = 30;

    // Draw disc
    function draw_disc(disc_x, disc_y, shade){
      context.beginPath();
      context.arc(disc_x, disc_y, disc_radius, 0, 2*Math.PI);
      context.fillStyle = shade;
      context.fill();
      context.strokeStyle = disc_outline;
      context.stroke();
      context.closePath();
    }

    // Check phase
    function check_phase(disc_pair, range_min, range_max){
      if (disc_pair.frame_num == disc_pair.tempo){
        if (trial.rhythm_condition=='natural'){
          disc_pair.tempo = get_random_value(range(range_min, range_max), 1);
        }
        
        disc_pair.frame_num = 0;
        if (disc_pair.phase == 0){
          disc_pair.phase = 1
        } else {
          disc_pair.phase = 0
        }
      } else {
        disc_pair.frame_num++;
      }
    }

    // Draw and animate disc pair
    function draw_discs(disc_pair){
      if (disc_pair.phase == 0) {
        draw_disc(disc_pair.pos_x1, disc_pair.pos_y1, disc_pair.color);
        draw_disc(disc_pair.pos_x2, disc_pair.pos_y2, disc_pair.neutral);
      } else {
        draw_disc(disc_pair.pos_x1, disc_pair.pos_y1, disc_pair.neutral);
        draw_disc(disc_pair.pos_x2, disc_pair.pos_y2, disc_pair.color);
      }
    }

    draw_discs(0);

    function animate_discs(){
      current_time = performance.now();
      time_elapsed = parseFloat(current_time - start_time)/1000;
      percent_time = time_elapsed / parseFloat(trial_duration);

      context.clearRect(0, 0, canvas_w, canvas_h);
      draw_discs(disc_pair_A);
      draw_discs(disc_pair_B);

      myReq = requestAnimationFrame(function(){animate_discs()});

      check_phase(disc_pair_A, 15, 25);
      check_phase(disc_pair_B, 35, 45);
      
      if (percent_time >= 0.999){
        context.clearRect(0, 0, canvas_w, canvas_h);
        window.cancelAnimationFrame(myReq);
        setTimeout(end_trial, 250);
      };
    }

    setTimeout(function(){
      start_time = performance.now();
      animate_discs();
    }, 250)

    function end_trial(){
    

      // gather the data to store for the trial
      let trial_data = {
        "rhythm_condition": trial.rhythm_condition,
        "duration": trial_duration,
      };

      // clear the display
      display_element.innerHTML = '';

      // move on to the next trial
      jsPsych.finishTrial(trial_data);
    }

  };

  return plugin;
})();

