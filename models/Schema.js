const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const uniqueValidator = require("mongoose-unique-validator");
const bcrypt = require("bcrypt");

const userSchema = new Schema(
    {
        username: {
            type: String,
            unique: true,
            required: [true, "Please enter username"],
        },
        password: {
            type: String,
            required: [true, "Please enter password"],
        },
        balance: {
            type: Number,
            default: 2000
        },
        role: {
            type: String,
            default: "user",
        },
    },
    { timestamps: true }
);

// Unique validation
userSchema.plugin(uniqueValidator, {
    message: "{PATH} has already been taken",
});

// Hashing password
userSchema.pre("save", async function (next) {
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
});

//model
const User = mongoose.model("user", userSchema);


const TxSchema = new Schema(
    {
        username: {
            type: String,
            required: [true, "Please enter username"],
        },
        chainId: {
            type: String,
            required: [true, "Please enter chainId"],
        },
        address: {
            type: String,
            required: [true, "Please enter address"],
        },
        amount: {
            type: Number,
            required: [true, "Please enter amount"],
        },
    },
    { timestamps: true }
);

// Unique validation
TxSchema.plugin(uniqueValidator, {
    message: "{PATH} has already been taken",
});
const Tx = mongoose.model("tx", TxSchema);

module.exports = { User, Tx };