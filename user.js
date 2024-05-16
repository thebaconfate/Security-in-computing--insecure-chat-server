const Database = require("./database.js");

class User {
	ID;
	username;
	#database;
	constructor(id, name, database = new Database()) {
		this.ID = id;
		this.username = name;
		this.#database = database;
	}

	// TODO: WIP - collect room subscriptions n stuff
	getUserData(continuation) {
		return {
			ID: this.ID,
			username: this.username,
		};
	}
}
