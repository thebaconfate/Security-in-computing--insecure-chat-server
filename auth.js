const bcrypt = require("bcrypt");
const Database = require("./database.js");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "Not-so-secret-secret-key";
const ALGORITHM = process.env.ALGORITHM || "HS512";

class Auth {
	#database;
	#salt = 10;
	constructor(database = new Database()) {
		this.#database = database;
	}

	registerUser(username, password, callback) {
		const hash = bcrypt.hashSync(password, this.#salt);
		this.#database.registerUser(username, hash, callback);
	}

	authenticateUser(username, password, callback) {
		console.log(this.#database);
		this.#database.getUserByUsername(
			username,
			function (err, row) {
				if (err || !row) {
					console.log(
						"Error getting user from database:",
						err?.message || "User not found"
					);
					callback(err, row);
				} else if (bcrypt.compareSync(password, row.password)) {
					console.log("User authenticated:", row);

					callback(err, row);
				} else {
					callback({ success: false, reason: "Invalid password" }, null);
				}
			} /* It took me so long to figure out that anonymous functions and arrow functions
             have different scoping rules. 'this' doesn't behave like I'm used to. I don't like JS */
		);
	}

	generateJWT(userID, username, callback) {
		console.log(userID, username);
		jwt.sign(
			{
				ID: userID,
				username: username,
			},
			SECRET_KEY,
			{ algorithm: ALGORITHM },
			function (err, token) {
				if (err) {
					callback(err, null);
				} else {
					callback(err, token);
				}
			}
		);
	}

	verifyJWT(token, callback) {
		jwt.verify(
			token,
			SECRET_KEY,
			{
				algorithms: [ALGORITHM],
			},
			function (err, decoded) {
				callback(err, decoded);
			}
		);
	}
}

module.exports = Auth;
