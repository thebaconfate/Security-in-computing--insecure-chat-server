const Database = require("./database.js");
const Rooms = require("./myrooms.js");

class User {
	#database;
	userID;
	constructor(userID, database = new Database()) {
		this.#database = database;
		this.userID = userID;
	}

	getUserData(callback) {
		this.#database.getUserData(this.userID, callback);
	}

	getUser(callback) {
		this.#database.getUserByID(this.userID, callback);
	}

	setState(state, callback) {
		this.#database.setUserActiveState(this.userID, state, callback);
	}
}

module.exports = User;
