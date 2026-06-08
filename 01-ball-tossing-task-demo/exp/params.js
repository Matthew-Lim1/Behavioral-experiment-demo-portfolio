let expt_name = "ball_tossing_task";
let subj_id = new URLSearchParams(window.location.search).get("participant") || prompt("Please enter a demo participant ID:", "demo");
let subj_name = expt_name + "_" + subj_id.toString();
let completion_code = 'DEMO-CODE';

let shortVersion = true;
let show_boilerplate = true;
let forceFullscreen = true;
let limitToDesktop = true;
let limitToGoogle = false;
let demo_rounds = shortVersion ? 2 : 5;
let demo_practice_passes = shortVersion ? 8 : 15;
let demo_passes_per_round = shortVersion ? 20 : null;


