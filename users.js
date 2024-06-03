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
		this.#database.getUserData(this.userID, (err, data) => {
			if (!err) {
				console.log("user-data", data);
				data.users = data.users.map((user) => {
					user.publicKey = user.publicKey.toString("utf-8");
					return user;
				});
				callback(err, data);
			}
		});
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
