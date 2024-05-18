const Database = require("./database.js");
const Chatrooms = require("./chatrooms.js");

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

	setRoom(userID, room, callback) {
		const chatrooms = new Chatrooms(this.#database);
		chatrooms.getRoom(userID, room.ID, callback);
	}
}

module.exports = Users;
