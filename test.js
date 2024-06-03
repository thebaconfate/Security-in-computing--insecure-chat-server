const crypto = require("crypto");

// Generate Alice's keys
const symmetricKey = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

let plainText = "Hello, Bob!";
const cipher = crypto.createCipheriv("aes-256-cbc", symmetricKey, iv);
console.log("cipher", cipher);
let encrypted = cipher.update(plainText, "utf8", "hex");
encrypted += cipher.final("hex");
console.log("encrypted", encrypted);
encrypted = Buffer.concat([iv, Buffer.from(encrypted, "hex")]);
console.log("encrypted", encrypted);

const encrypted_iv = encrypted.subarray(0, 16);
encrypted = encrypted.subarray(16);
console.log("encrypted_sliced", encrypted);
console.log("encrypted_iv", encrypted_iv);
const decipher = crypto.createDecipheriv(
	"aes-256-cbc",
	symmetricKey,
	encrypted_iv
);
let decrypted = decipher.update(encrypted, "hex", "utf8");
decrypted += decipher.final("utf8");
console.log("decrypted", decrypted);

function encryptMessage(message, aesKey) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
	let encrypted = cipher.update(message, "utf8", "hex");
	encrypted += cipher.final("hex");
	return Buffer.concat([iv, Buffer.from(encrypted, "hex")]);
}

function decryptMessage(encrypted, aesKey) {
	const iv = encrypted.subarray(0, 16);
	encrypted = encrypted.subarray(16);
	const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}


function generateAesKey() {
	return crypto.randomBytes(32);
}

function encryptAesKey(aesKey, publicKey) {
	return crypto.publicEncrypt(publicKey, aesKey);
}

function decryptAesKey(encryptedAesKey, privateKey) {
	return crypto.privateDecrypt(privateKey, encryptedAesKey);
}

aesKey = generateAesKey();
console.log("aesKey", aesKey);
plainText = "Hello again, Bob!";
encrypted = encryptMessage(plainText, aesKey);
console.log("encrypted", encrypted);

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicExponent: 65537,
});

const encryptedAesKey = encryptAesKey(aesKey, publicKey);
console.log("encryptedAesKey", encryptedAesKey);
const decryptedAesKey = decryptAesKey(encryptedAesKey, privateKey);
console.log("decryptedAesKey", decryptedAesKey);
decrypted = decryptMessage(encrypted, decryptedAesKey);
console.log("decrypted", decrypted);