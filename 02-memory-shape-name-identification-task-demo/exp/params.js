let expt_name = "time";
let subj_id = new URLSearchParams(window.location.search).get("participant") || prompt("Please enter a demo participant ID:", "demo") || "demo";
let subj_name = expt_name + "_" + subj_id.toString();
let demo_duration = 20;
let demo_pay = "$0.00";
let completion_code = '74MM322LS';

let shortVersion = false;
let show_boilerplate = false; // Toggle (false) to skip demo notice and welcome prompt
let forceFullscreen = false;
let limitToDesktop = false;
let limitToGoogle = false;
let skip_ucla = true; // Toggle to include/exclude the UCLA loneliness survey. 
let show_rt_debug = false; // Toggle for on-screen timer


