var clone = require('clone')
// Data object to pass to the next caller.
// If you expect this data to come from another function, add the field with a default below
var data = {'body': '',
            'blame': []
        }

var message = {'status': '',    // Status, either FAILURE or SUCCESS as above
        'message': '',    // Message to send back user
        'data': data     // Data to pass to the next caller
      }

/**
 * Get a message which is actually a clone of the object we are using
 */
function getMessage() {
  return clone(message)
}

function getData(){
  return clone(data);
}

exports.FAILURE = 'failure';
exports.SUCCESS = 'success';
exports.ERROR = 'error';
exports.getDataStructure = getData;
exports.getMessageStructure = getMessage;