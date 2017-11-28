const store = require("data-store")("data-store", {cwd: "github_token_storage"});
var manager = {};

module.exports = manager;
/**
 * retrieves the token for specified owner. 
 * If the token is not stored it will return "undefined"
 * @param {String} owner //owner for which token is asked.
 */
manager.getToken = function(owner){
    if(store.has(owner)){
        return store.get(owner);
    }
    return null;
}

/**
 * stores the token for the specified owner
 * @param {String} owner //owner/user
 * @param {String} token //token to be stored
 */
manager.addToken = function(owner, token){
    store.set(owner, token);
}

