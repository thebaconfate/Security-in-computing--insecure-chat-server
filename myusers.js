const Database = require("./database.js");

class User {
	ID;
	username;
	constructor(ID, username) {
		this.ID = ID;
		this.username = username;
	}
}

class Users {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	getUserData(userID, username, callback) {
		this.#database.getUserData(userID, username, callback);
	}

	getUser(username, callback) {
		this.#database.getUser(username, callback);
	}
}

module.exports = Users;
