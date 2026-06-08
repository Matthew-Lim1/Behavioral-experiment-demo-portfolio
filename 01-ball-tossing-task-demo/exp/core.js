// Experiment functions
function startExpt() {
    let start_clock = performance.now();
    jsPsych.init({
        timeline: timeline,
        show_progress_bar: true, 
        // Preload images if needed.
        on_interaction_data_update: function (data) {
            viewport_width = get_viewport_size().width;
            viewport_height = get_viewport_size().height;
            data.subj_id = subj_name;
            data.screen_width = viewport_width;
            data.screen_height = viewport_height;
            console.log(JSON.stringify(data));
            if (forceFullscreen) {
                if (JSON.stringify(data).includes('blur') & data.trial > 1 & data.event!='fullscreenexit') {
                    if (confirm("Oops, you may have switched tabs, clicked outside of the browser, or exited full screen mode -- as a result, the experiment will now end.  You can refresh the browser to try again.")) {
                        location.reload();
                    }
                }
            }
        },
        on_finish: function () {
            let end_clock = performance.now();
            let total_time = end_clock - start_clock;
            console.log("Total time:", total_time / 60000);
        }
    });
}

function saveData(name, data) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'write_data.php');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
        filename: name,
        filedata: data
    }));
}


// Demo notice
let demo_notice = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: "<h2>Portfolio Demo Notice</h2>"+
    "<p>This sanitized demo omits private participation materials, institutional contact details, and participant-facing study identifiers.</p>"+
    "<p>It is included to demonstrate browser-based experiment flow, ball tossing task interaction logic, and CSV data capture.</p>"+
    "<p><strong>Press SPACE to continue.</strong></p>",
    data: {
        subj_id: subj_name,
        test_part: 'demo_notice'
    }
};


// Debriefing form
let debrief_text =
    "<div style='width: 50%; text-align: left; margin: 0 auto'><p style='text-align: center'>(You should have been returned to the normal size of your browser.)<br>Finally, we just have a couple questions for you!<br>Please note that you must answer <strong>ALL</strong> the questions before pressing the CONTINUE button below.</p>" +
    '<p>Age: <br><input name="age" type="number" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>Please indicate your gender:<br><input type="radio" id="male" name="gender" value="male"><label for="male">Male</label><br><input type="radio" id="female" name="gender" value="female"><label for="female">Female</label><br><input type="radio" id="other" name="gender" value="other"><label for="other">Other</label><br><input type="radio" id="NA" name="gender" value="NA"><label for="NA">I prefer not to say</label><br>' +
    '<p>In 1-2 sentences, what do you think the experiment is about?<br><input name="what_about" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>Have you ever, to your knowledge, participated in an experiment similar to this one?  If yes, please describe this experiment in 1-2 sentences.  If no, please just type "No" in the text box.<br><input name="prev_exp" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/>' +
    '<p>Did you encounter any problems in the experiment? <br><input name="problems" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/></p>' +
    '<p>Anything else to share? <br><input name="addl" type="text" size="50" style="width: 100%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"/></p>' +
    '<p>We know it is generally difficult to stay focused in these online experiments.  On a scale of 1-100 (with 1 being very distracted, and 100 being very focused), how well did you pay attention to the experiment?  (This is only used as a demo data field.) <br><input name="attn" type="number" max="100" style="width: 20%; border-radius: 4px; padding: 10px 10px; margin: 8px 0; border: 1px solid #ccc; font-size: 15px"></p></div>';

let debrief_prompt = [{
    html: debrief_text,
    data: {
        subj_id: subj_name,
        test_part: 'debrief'
    },
}];

let check_debrief_response = {
    type: 'survey-html-form',
    data: {
        subj_id: subj_name,
        test_part: 'debrief',
        completion_code: completion_code
    },
    check_blanks: true,
    on_finish: function (data) {
        console.log("Responses:", data.responses);
        let respObj = JSON.parse(data.responses);
        data.resp_age = respObj["age"];
        data.resp_gender = respObj["gender"];
        data.resp_expt = respObj["what_about"];
        data.resp_experience = respObj["prev_exp"];
        data.resp_problems = respObj["problems"];
        data.resp_final = respObj["addl"];
        data.resp_attention = respObj["attn"];
        let interaction_data = jsPsych.data.getInteractionData();
        let interaction_filename = 'interactions_' + subj_name;
        saveData(interaction_filename, jsPsych.data.getInteractionData().csv());
        saveData(subj_name, jsPsych.data.get().csv());
    },
    timeline: debrief_prompt
};


// Standard elements
let fixation = {
    type: 'html-keyboard-response',
    stimulus: '<div style="font-size:60px;">+</div>',
    choices: jsPsych.NO_KEYS,
    trial_duration: 500,
    data: {
        subj_id: subj_name,
        test_part: 'fixation'
    }
};

let blank = {
    type: 'html-keyboard-response',
    stimulus: '<div style="font-size:60px;"></div>',
    choices: jsPsych.NO_KEYS,
    trial_duration: 500,
    data: {
        subj_id: subj_name,
        test_part: 'blank'
    }
};

let welcome_prompt = {
    type: 'demo-html-keyboard-response',
    wait_duration: 5000,
    choices: ['space'],
    stimulus: "<p>Hi! Thank you for checking out this demo.  Please take a moment to adjust your seating so that you can comfortably watch the monitor and use the keyboard.  Feel free to dim the lights as well.</p><p>Close the door or do whatever is necessary to minimize disturbance during the experiment.  Please also take a moment to silence your phone so that you are not interrupted by any messages mid-experiment.</p><p>Throughout this experiment, you will see greyed out text as in the last line below.</p><p>And a quick note: This text will contain the instructions for how to move to the next page -- which will typically involve pressing the spacebar.  You will not be able to press the spacebar until after a brief period of time has elapsed.  Please use that time to read the instructions on the given page.  Once the greyed out text has turned black, and you have finished reading the instructions, you will then be able to proceed by pressing the relevant key.",
    prompt: "Press SPACE to continue.",
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    }
};

let break_prompt = function (progress, total_blocks) {
    let block = {
        type: 'html-keyboard-response',
        choices: ['space'],
        stimulus: "You have completed " + progress +
            " out of " + total_blocks + "blocks.<p>Take a one-minute break -- but don't leave!<br>You can use this time to adjust your seat, stretch, etc.</p><p><strong>Press the spacebar to continue.</strong></p>",
        response_ends_trial: true,
        data: {
            subj_id: subj_name,
            test_part: 'break_prompt'
        },
        on_finish: function () {
            let file_name = 'partial_' + subj_name
            saveData(file_name, jsPsych.data.get().csv());
        }
    };
    return block;
};

let get_code_prompt = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: '<p>Great, you have completed this experiment.  Please press spacebar to proceed to the next page, and get your code.</p>',
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    },
    on_finish: function (data) {
        saveData(subj_name, jsPsych.data.get().csv());
    }
};

let show_code_prompt = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: '<p>Here is the demo completion code:</p><p style="font-size: 140%; color: grey"><strong>' + completion_code +
        '</strong></p>' + '<p>Press the spacebar to continue.</p>',
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    }
};

let close_prompt = {
    type: 'html-keyboard-response',
    choices: ['space'],
    stimulus: '<p>Thank you for helping!  You are all set.  You can now close the window!</p>',
    data: {
        subj_id: subj_name,
        test_part: 'instruct_prompt'
    },
    on_finish: function (data) {
        let interaction_data = jsPsych.data.getInteractionData();
        let interaction_filename = 'interactions_' + subj_name;
        saveData(interaction_filename, jsPsych.data.getInteractionData().csv());
        saveData(subj_name, jsPsych.data.get().csv());
    }
};


// Browser check
let check = false;

function getBrowserInfo() {
    let ua = navigator.userAgent,
        tem,
        M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return 'IE ' + (tem[1] || '');
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
        if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null)
        M.splice(1, 1, tem[1]);
    return {
        'browser': M[0],
        'version': M[1]
    };
};

function mobileAndTabletCheck() {
    (function (a) {
        if (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i
                .test(a) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
                .test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};


// Helper functions
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function range(start, end) {
    return Array(end - start + 1).fill().map((_, idx) => start + idx)
};

function get_random_value(array) {
    return jsPsych.randomization.sampleWithoutReplacement(array, 1)[0]
};

function pad(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
};

function get_sample(arr, n) {
    let result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        let x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
};

function get_average(array) {
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
        sum += array[i];
    }
    return sum / array.length;
};

function get_viewport_size() {
    let test = document.createElement("div");

    test.style.cssText = "position: fixed;top: 0;left: 0;bottom: 0;right: 0;";
    document.documentElement.insertBefore(test, document.documentElement.firstChild);

    let dims = {
        width: test.offsetWidth,
        height: test.offsetHeight
    };
    document.documentElement.removeChild(test);

    return dims;
};







