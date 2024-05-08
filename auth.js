const Bcrypt = require("./crypto.js");

class Auth {
	#database;
	#bcrypt;
	constructor(database) {
		this.#database = database;
		this.#bcrypt = new Bcrypt();
	}
	registerUser(username, password, callback) {
		const hash = this.#bcrypt.hashPassword(password);
		this.#database.registerUser(username, hash, callback);
	}
	authenticateUser(username, password) {
		const user = this.#database.getUser(username);
		if (user) {
			return this.#bcrypt.authenticatePassword(password, user.password);
		}
		return false;
	}
}

module.exports = Auth;
