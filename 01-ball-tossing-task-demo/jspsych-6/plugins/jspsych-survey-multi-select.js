/**
 * jspsych-survey-multi-select
 * a jspsych plugin for multiple choice survey questions
 *
 * documentation: docs.jspsych.org
 *
 */


jsPsych.plugins['survey-multi-select'] = (function() {
  let plugin = {};

  plugin.info = {
    name: 'survey-multi-select',
    description: '',
    parameters: {
      questions: {
        type: jsPsych.plugins.parameterType.COMPLEX,
        array: true,
        pretty_name: 'Questions',
        nested: {
          prompt: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Prompt',
            default: undefined,
            description: 'The strings that will be associated with a group of options.'
          },
          options: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Options',
            array: true,
            default: undefined,
            description: 'Displays options for an individual question.'
          },
          horizontal: {
            type: jsPsych.plugins.parameterType.BOOL,
            pretty_name: 'Horizontal',
            default: false,
            description: 'If true, then questions are centered and options are displayed horizontally.'
          },
          required: {
            type: jsPsych.plugins.parameterType.BOOL,
            pretty_name: 'Required',
            default: false,
            description: 'Subject will be required to pick at least one option for this question.'
          },
          name: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Question Name',
            default: '',
            description: 'Controls the name of data values associated with this question'
          }
        }
      },
      randomize_question_order: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: 'Randomize Question Order',
        default: false,
        description: 'If true, the order of the questions will be randomized'
      },
      preamble: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Preamble',
        default: null,
        description: 'HTML formatted string to display at the top of the page above all the questions.'
      },
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default:  'Continue',
        description: 'Label of the button.'
      },
      required_message: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Required message',
        default: 'You must choose at least one response for this question',
        description: 'Message that will be displayed if required question is not answered.'
      }
    }
  }
  plugin.trial = function(display_element, trial) {
    let plugin_id_name = "jspsych-survey-multi-select";
    let plugin_id_selector = '#' + plugin_id_name;
    let _join = function( /*args*/ ) {
      let arr = Array.prototype.slice.call(arguments, _join.length);
      return arr.join(separator = '-');
    }

    // inject CSS for trial
    let cssstr = ".jspsych-survey-multi-select-question { margin-top: 2em; margin-bottom: 2em; text-align: left; }"+
      ".jspsych-survey-multi-select-text span.required {color: darkred;}"+
      ".jspsych-survey-multi-select-horizontal .jspsych-survey-multi-select-text {  text-align: center;}"+
      ".jspsych-survey-multi-select-option { line-height: 2; }"+
      ".jspsych-survey-multi-select-horizontal .jspsych-survey-multi-select-option {  display: inline-block;  margin-left: 1em;  margin-right: 1em;  vertical-align: top;}"+
      "label.jspsych-survey-multi-select-text input[type='checkbox'] {margin-right: 1em;}"
    display_element.innerHTML = '<style id="jspsych-survey-multi-select-css">' + cssstr + '</style>';
    
    // form element
    let trial_form_id = _join(plugin_id_name, "form");
    display_element.innerHTML += '<form id="'+trial_form_id+'"></form>';
    let trial_form = display_element.querySelector("#" + trial_form_id);
    // show preamble text
    let preamble_id_name = _join(plugin_id_name, 'preamble');
    if(trial.preamble !== null){
      trial_form.innerHTML += '<div id="'+preamble_id_name+'" class="'+preamble_id_name+'">'+trial.preamble+'</div>';
    }
    // generate question order. this is randomized here as opposed to randomizing the order of trial.questions
    // so that the data are always associated with the same question regardless of order
    let question_order = [];
    for(let i=0; i<trial.questions.length; i++){
      question_order.push(i);
    }
    if(trial.randomize_question_order){
      question_order = jsPsych.randomization.shuffle(question_order);
    }
    // add multiple-select questions
    for (let i = 0; i < trial.questions.length; i++) {
      let question = trial.questions[question_order[i]];
      let question_id = question_order[i];
      // create question container
      let question_classes = [_join(plugin_id_name, 'question')];
      if (question.horizontal) {
        question_classes.push(_join(plugin_id_name, 'horizontal'));
      }

      trial_form.innerHTML += '<div id="'+_join(plugin_id_name, question_id)+'" data-name="'+question.name+'" class="'+question_classes.join(' ')+'"></div>';

      let question_selector = _join(plugin_id_selector, question_id);

      // add question text
      display_element.querySelector(question_selector).innerHTML += '<p id="survey-question" class="' + plugin_id_name + '-text survey-multi-select">' + question.prompt + '</p>';

      // create option check boxes
      for (let j = 0; j < question.options.length; j++) {
        let option_id_name = _join(plugin_id_name, "option", question_id, j);

        // add check box container
        display_element.querySelector(question_selector).innerHTML += '<div id="'+option_id_name+'" class="'+_join(plugin_id_name, 'option')+'"></div>';

        // add label and question text
        let form = document.getElementById(option_id_name)
        let input_name = _join(plugin_id_name, 'response', question_id);
        let input_id = _join(plugin_id_name, 'response', question_id, j);
        let label = document.createElement('label');
        label.setAttribute('class', plugin_id_name+'-text');
        label.innerHTML = question.options[j];
        label.setAttribute('for', input_id)

        // create  checkboxes
        let input = document.createElement('input');
        input.setAttribute('type', "checkbox");
        input.setAttribute('name', input_name);
        input.setAttribute('id', input_id);
        input.setAttribute('value', question.options[j])
        form.appendChild(label)
        form.insertBefore(input, label)
      }
    }
    // add submit button
    trial_form.innerHTML += '<div class="fail-message"></div>'
    trial_form.innerHTML += '<button id="'+plugin_id_name+'-next" class="'+plugin_id_name+' jspsych-btn">'+trial.button_label+'</button>';

    // validation check on the data first for custom validation handling
    // then submit the form
    display_element.querySelector('#jspsych-survey-multi-select-next').addEventListener('click', function(){
      for(let i=0; i<trial.questions.length; i++){
        if(trial.questions[i].required){
          if(display_element.querySelector('#jspsych-survey-multi-select-'+i+' input:checked') == null){
            display_element.querySelector('#jspsych-survey-multi-select-'+i+' input').setCustomValidity(trial.required_message);
          } else {
            display_element.querySelector('#jspsych-survey-multi-select-'+i+' input').setCustomValidity('');
          }
        }
      }
      trial_form.reportValidity();
    })

    trial_form.addEventListener('submit', function(event) {
      event.preventDefault();
      // measure response time
      let endTime = performance.now();
      let response_time = endTime - startTime;

      // create object to hold responses
      let question_data = {};
      let has_response = [];
      for(let index=0; index<trial.questions.length; index++){
        let match = display_element.querySelector('#jspsych-survey-multi-select-'+index);
        let val = [];
        let inputboxes = match.querySelectorAll("input[type=checkbox]:checked")
        for(let j=0; j<inputboxes.length; j++){
          currentChecked = inputboxes[j];
          val.push(currentChecked.value)
        }
        let id = 'Q' + index
        let obje = {};
        let name = id;
        if(match.attributes['data-name'].value !== ''){
          name = match.attributes['data-name'].value;
        }
        obje[name] = val;
        Object.assign(question_data, obje);
        if(val.length == 0){ has_response.push(false); } else { has_response.push(true); }
      }

      // save data
      let trial_data = {
        "rt": response_time,
        "responses": JSON.stringify(question_data),
        "question_order": JSON.stringify(question_order)
      };
      display_element.innerHTML = '';

      // next trial
      jsPsych.finishTrial(trial_data);
      
    });

    let startTime = performance.now();
  };

  return plugin;
})();
