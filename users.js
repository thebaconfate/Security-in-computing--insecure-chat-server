const Database = require("./database.js");
const Rooms = require("./rooms.js");

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
		if (state) this.#database.setUserActiveState(this.userID, 1, callback);
		else this.#database.setUserActiveState(this.userID, 0, callback);
	}

	joinChannel(RoomID, callback) {
		this.#database.addUserToChannel(this.userID, RoomID, callback);
	}
}

module.exports = User;
