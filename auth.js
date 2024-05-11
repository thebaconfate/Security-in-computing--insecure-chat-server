const Bcrypt = require("./crypto.js");
const Database = require("./database.js");

class Auth {
	#database;
	#bcrypt;
	constructor() {
		this.#database = new Database();
		this.#bcrypt = new Bcrypt();
	}

	registerUser(username, password, callback) {
		const hash = this.#bcrypt.hashPassword(password);
		this.#database.registerUser(username, hash, callback);
	}
	authenticateUser(username, password, callback_success, callback_fail) {
		this.#database.getUser(
			username,
			function (err, row) {
				if (err || !row) {
					console.log(
						"Error getting user from database:",
						err.message || "User not found"
					);
					callback_fail();
				} else {
					console.log("row:", row);
					console.log(this.#bcrypt);
					if (this.#bcrypt.authenticatePassword(password, row.password)) {
						callback_success(row);
					} else {
						callback_fail();
					}
				}
			}.bind(
				this
			) /* It took me so long to figure out that anonymous functions and arrow functions
             have different scoping rules. 'this' doesn't behave like I'm used to. I don't like JS */
		);
	}
}

module.exports = Auth;
