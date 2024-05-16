const sqlite = require("sqlite3").verbose();
class Database {
	#db;
	constructor() {
		this.#db = new sqlite.Database("./database.db", (err) => {
			if (err) {
				console.error("Error opening database:", err.message);
			} else {
				console.log("Connected to the database.");
			}
		});
	}

	registerUser(username, password, callback) {
		const query = this.#db.prepare(
			"INSERT INTO users (username, password) VALUES (?, ?)"
		);
		query.run([username, password], callback);
		query.finalize();
	}

	getUser(username, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE username = ?");
		query.get([username], callback);
		query.finalize();
	}

	getUsers(usernames, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE username IN (?)");
		query.all([usernames], callback);
		query.finalize();
	}

	getUserById(id, callback) {
		const query = this.#db.prepare("SELECT * FROM users WHERE ID = ?");
		query.get([id], callback);
		query.finalize();
	}

	createChatroom(name, description, isPrivate, callback) {
		const query = this.#db.prepare(
			"INSERT INTO chatrooms (name, description, private) VALUES (?, ?, ?)"
		);
		query.run([name, description, isPrivate], callback);
		query.finalize();
	}

	getChatroomByName(name, callback) {
		const query = this.#db.prepare("SELECT * FROM chatrooms WHERE name = ?");
		query.get([name], callback);
		query.finalize();
	}

	getChatroomById(id, callback) {
		const query = this.#db.prepare("SELECT * FROM chatrooms WHERE ID = ?");
		query.get([id], callback);
		query.finalize();
	}

	registerMemberToChatroom(userId, chatroomId, callback) {
		const query = this.#db.prepare(
			"INSERT INTO chatroom_members (user_id, chatroom_id) VALUES (?, ?)"
		);
		query.run([userId, chatroomId], callback);
		query.finalize();
	}
}

module.exports = Database;
