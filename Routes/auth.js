const express = require("express");
const { urlencoded } = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
require('dotenv').config();
const bcrypt = require("bcrypt");

// SCHEMA
const { User } = require("../models/Schema");
// For Creating token
const createToken = (payload) => {
    return jwt.sign(payload, process.env.jwtSecret);
};

router.get("/:username", async (req, res) => {
    const username = req.params.username;
    try {
        const user = await User.findOne({ username });
        if (user) {
            res.json({ msg: true });
        } else {
            res.json({ msg: false });
        }
    } catch (error) {
        res.status(500).json({ err: "SERVER ERROR" });
    }
});

router.post("/", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        };
        res.json({ msg: "Registered Successfully" });
    } catch (error) {
        if (error.message.includes("username has already been taken")) {
            res.status(500).json({ err: "username has already been taken" });
        } else {
            res.status(500).json({ err: "SERVER ERROR" });
        }
    }
});

//login
router.put("/", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        //   Checking if user is null
        if (!user) return res.status(500).json({ err: "Invalid Credentials" });

        await bcrypt.compare(password, user.password, function (err, response) {
            if (!response) return res.status(500).json({ err: "Invalid Credentials" });
            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            };
            const token = createToken(payload);
            res.json({
                msg: "Logged Successfully",
                jwt: token,
                role: user.role,
                username: user.username,
            });
        })
    } catch (error) {
        if (error.message.includes("username has already been taken")) {
            res.status(500).json({ err: "username has already been taken" });
        } else {
            res.status(500).json({ err: "SERVER ERROR" });
        }
    }
});


module.exports = router;