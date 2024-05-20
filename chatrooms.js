const Database = require("./database.js");

class Chatrooms {
	#database;
	constructor(database = new Database()) {
		this.#database = database;
	}

	getRoom(userID, roomID, callback) {
		this.#database.getChatroom(userID, roomID, callback);
	}

	sendMessage(userID, message, callback) {
		this.#database.sendMessageToChatRoom(
			message.room,
			userID,
			message.content,
			callback
		);
	}
}

module.exports = Chatrooms;
