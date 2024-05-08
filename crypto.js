const bcrypt = require("bcrypt");

class Bcrypt {
	#bcrypt;
	#salt;
	constructor() {
		this.#bcrypt = bcrypt;
		this.#salt = 10;
	}
	hashPassword(password) {
		return this.#bcrypt.hashSync(password, this.#salt);
	}
	authenticatePassword(password, hash) {
		return this.#bcrypt.compareSync(password, hash);
	}
}

module.exports = Bcrypt;
