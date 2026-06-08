/*
 * Example plugin template
 */

jsPsych.plugins["demo-animate-bars"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "demo-animate-bars",
    parameters: {
      bar_condition: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'stopwatch' // countdown or stopwatch
      },
      disc_condition: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'cont' // continuous or discrete
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

    // Setup time variables
    var start_time = performance.now();
    var current_time = performance.now();
    var time_elapsed = 0;
    var percent_time = 0;
    var trial_duration = 8;

    // Setup bar size
    var rect_width = canvas_w*.5;
    var rect_height = canvas_h*.15;
    var rect_starting_point_x = canvas_w/2 - rect_width/2;
    var rect_starting_point_y = canvas_h/2 - rect_height/2;

    // If discrete, setup the number and size of the 'ticks'
    var tick_width = 30;
    var interval_width = 10;
    var total_bin_width = tick_width + interval_width;
    var num_ticks = parseInt(rect_width/total_bin_width)+1;

    // Draw and animate bar
    function draw_bar(percent_time){
      // Draw empty bar
      context.beginPath();
      context.rect(rect_starting_point_x, rect_starting_point_y, rect_width, rect_height);
      context.strokeStyle = 'grey';
      context.stroke();
      context.closePath();

      // Fill in the bar
      if (trial.disc_condition=='cont'){
        if (trial.bar_condition=='stopwatch'){
          total_frames_so_far = parseInt(percent_time*rect_width);
        } else if (trial.bar_condition=='countdown'){
          total_frames_so_far = parseInt((1-percent_time)*rect_width);
        }
        context.beginPath();
        context.rect(rect_starting_point_x, rect_starting_point_y, total_frames_so_far, rect_height);
        context.fillStyle = 'purple';
        context.fill();
        context.closePath();
      } else if (trial.disc_condition=='disc'){
        if (trial.bar_condition=='stopwatch'){
          total_frames_so_far = parseInt(percent_time*num_ticks);
        } else if (trial.bar_condition=='countdown'){
          total_frames_so_far = parseInt((1-percent_time)*num_ticks);
        }
        curr_x = rect_starting_point_x;
        for (i=0; i<total_frames_so_far; i++){
          context.beginPath();
          context.rect(curr_x, rect_starting_point_y, tick_width, rect_height);
          context.fillStyle = 'purple';
          context.fill();
          context.closePath();
          curr_x += total_bin_width;
        }
      }

    }

    draw_bar(0);

    function animate_path(){
      current_time = performance.now();
      time_elapsed = parseFloat(current_time - start_time)/1000;
      percent_time = time_elapsed / parseFloat(trial_duration);

      context.clearRect(0, 0, canvas_w, canvas_h);
      draw_bar(percent_time);

      myReq = requestAnimationFrame(function(){animate_path()});

      if (percent_time >= 0.999){
        context.clearRect(0, 0, canvas_w, canvas_h);
        window.cancelAnimationFrame(myReq);
        setTimeout(end_trial, 250);
      };
    }

    setTimeout(function(){
      start_time = performance.now();
      animate_path();
    }, 250)

    function end_trial(){
      
      console.log("true positions", probe_positions)

      // gather the data to store for the trial
      let trial_data = {
        "bar_condition": trial.bar_condition,
        "disc_condition": trial.disc_condition,
        "duration": trial_duration,
        "num_frames": rect_width,
      };

      // clear the display
      display_element.innerHTML = '';

      // move on to the next trial
      jsPsych.finishTrial(trial_data);
    }

  };

  return plugin;
})();

