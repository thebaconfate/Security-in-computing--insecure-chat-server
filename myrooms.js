const Database = require("./database.js");

class Rooms {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
		this.roomID = roomID;
	}

	getRoom(roomID, userID, callback) {
		this.#database.getRoom(roomID, userID, callback);
	}

	sendMessage(roomID, userID, message, callback) {
		this.#database.sendMessageToRoom(roomID, userID, message, callback);
	}
}

module.exports = Rooms;
