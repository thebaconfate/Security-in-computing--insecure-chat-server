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
}

module.exports = Database;
