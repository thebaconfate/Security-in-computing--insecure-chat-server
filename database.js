module.exports = Database;

const sqlite = require("sqlite3").verbose();
const db = new sqlite.Database("./database.db", (err) => {
	if (err) {
		console.error("Error opening database:", err.message);
	} else {
		console.log("Connected to the database.");
	}
});

class Database {
	#db;
	constructor() {
		this.#db = db;
	}

	registerUser(username, password) {
		const query = db.prepare(
			"INSERT INTO users (username, password) VALUES (?, ?)"
		);
		query.run(username, password);
		query.finalize();
	}

	getUser(username) {
		const query = db.prepare("SELECT * FROM users WHERE username = ?");
		return new Promise((resolve, reject) => {
			query.get(username, (err, row) => {
				if (err) false;
				else resolve(row);
			});
		});
	}
}
