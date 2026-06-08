// Experiment settings
let experimentName = "time";
let subjectId = new URLSearchParams(window.location.search).get("participant") || prompt("Please enter a demo participant ID:", "demo") || "demo";
let subjName = experimentName + "_" + subjectId.toString();
let demoDuration = 30;
let demoPay = "$0.00";
let completionCode = '74MM322LS';

let shortVersion = false;
let showBoilerplate = false;
let forceFullscreen = false;
let limitToDesktop = false;
let limitToGoogle = false;
let skipUcla = true;
let showRtDebug = false;




