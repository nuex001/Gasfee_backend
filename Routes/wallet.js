const express = require("express");
const { urlencoded } = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const config = require("config");
const bcrypt = require("bcrypt");

// SCHEMA
const { User } = require("../models/Schema");
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('balance');
        if (user) {
            res.json({ msg: user });
        } else {
            res.status(500).json({ err: "Invalid Authentification" });
        }
    } catch (error) {
        res.status(500).json({ err: "SERVER ERROR" });
    }
});

//update account
router.put("/deposit", auth, async (req, res) => {
    try {
        const { amount } = req.body;
        await User.updateMany({ _id: req.user.id }, { $inc: { balance: +amount } });
        res.json({ msg: `Successfully deposited $${amount} to your account`});
    } catch (error) {
        console.log(error);
        res.status(500).json({ err: "SERVER ERROR" });
    }
});
router.put("/withdraw", auth, async (req, res) => {
    try {
        const { amount } = req.body;
        await User.updateMany({ _id: req.user.id }, { $inc: { balance: -amount } });
        res.json({ msg: `Successfully withdraw $${amount} from your account`});
    } catch (error) {
        console.log(error);
        res.status(500).json({ err: "SERVER ERROR" });
    }
});


module.exports = router;