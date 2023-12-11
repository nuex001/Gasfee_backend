const express = require("express");
const { urlencoded } = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const config = require("config");
const axios = require('axios');
const { io } = require("../server"); // Make sure the path is correct
const ethers = require('ethers');
// SCHEMA
const { Tx, User } = require("../models/Schema");
const { CONTRACT_ADDRESS, MATIC_CONTRACT_ADDRESS, ABI } = require("../utils/utils");
const auth = require("../middleware/auth");
// For Creating token

let wallet = new ethers.Wallet(config.get("privateKey"));

// Connect to Ethereum
let providerEth = ethers.getDefaultProvider('https://ethereum-sepolia.publicnode.com');
let walletConnectedEth = wallet.connect(providerEth);

// Connect to Matic (Polygon)
let providerMatic = new ethers.providers.JsonRpcProvider('https://polygon-mumbai-pokt.nodies.app');
let walletConnectedMatic = wallet.connect(providerMatic);

router.get("/", auth, async (req, res) => {
  try {
    const tx = await Tx.find({ username: req.user.username });
    res.json({ msg: tx })
  } catch (error) {
    console.log(error);
    res.status(5000).send("SERVER ERROR");
  }
});

// Step 2c: Implement Socket.io event handling
// Assuming your transactions object looks like this:
const transactions = {};

//processTransaction
function processTransaction(tx, newRoomId, chainId) {
  try {
    if (tx) {
      const passedTransaction = tx;
      if (chainId === "matic") {
        const contract = new ethers.Contract(MATIC_CONTRACT_ADDRESS, ABI, walletConnectedMatic);
        const storedTransactions = passedTransaction.storedTransactions || [];
        const userTx = passedTransaction.users;
        (async () => {
          // Update user balances
          for (const list of userTx) {
            await User.updateMany({ _id: list.user }, { $inc: { balance: -list.amount } });
          }
          // create Transaction
          for (const list of storedTransactions) {
            const transactions = new Tx({
              username: list.username,
              chainId: chainId,
              address: list.address,
              amount: list.amountInWei
            });
            await transactions.save();
          }
          if (storedTransactions.length > 0) {
            // Send transactions via the contract
            const txReceipt = await contract.sendMany(storedTransactions.map((transaction) => [transaction.address, transaction.amountInWei]));

            // Emit the successful transaction event
            const newRoom = io.sockets.adapter.rooms.get(newRoomId);
            if (newRoom && newRoom.size > 0) {
              io.to(newRoomId).emit('transaction Successfull', txReceipt);
              const sockets = await io.in(newRoomId).fetchSockets();
              if (Array.isArray(sockets)) {
                sockets.forEach(socket => {
                  socket.leave(newRoomId);
                });
              } else {
                console.error('No sockets found in the room:', newRoomId);
              }
            } else {
              console.error('Room does not exist or is empty:', newRoomId);
            }
          }
        })();
      } else {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, walletConnectedEth);
        const storedTransactions = passedTransaction.storedTransactions || [];
        const userTx = passedTransaction.users;
        (async () => {
          try {
            // Update user balances
            for (const list of userTx) {
              await User.updateMany({ _id: list.user }, { $inc: { balance: -list.amount } });
            }
            // create Transaction
            for (const list of storedTransactions) {
              const transactions = new Tx({
                username: list.username,
                chainId: chainId,
                address: list.address,
                amount: list.amountInWei
              });
              await transactions.save();
            }
            if (storedTransactions.length > 0) {
              // Send transactions via the contract
              const txReceipt = await contract.sendMany(storedTransactions.map((transaction) => [transaction.address, transaction.amountInWei]));

              // Emit the successful transaction event
              const newRoom = io.sockets.adapter.rooms.get(newRoomId);
              if (newRoom && newRoom.size > 0) {
                io.to(newRoomId).emit('transaction Successfull', txReceipt);
                const sockets = await io.in(newRoomId).fetchSockets();
                if (Array.isArray(sockets)) {
                  sockets.forEach(socket => {
                    socket.leave(newRoomId);
                  });
                } else {
                  console.error('No sockets found in the room:', newRoomId);
                }
              } else {
                console.error('Room does not exist or is empty:', newRoomId);
              }

            }
          } catch (error) {
            console.error('An error occurred:', error);
          }
        })();
      }
    }
  } catch (error) {
    console.log("error");
    console.log(error);
  }
}

//GET PRICE FEED
async function getPrice(amount, chainId) {
  // console.log(chainId);
  try {
    if (chainId === "eth") {
      const response = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD');
      if (response.data && response.data.USD !== undefined) {
        let ethPrice = response.data.USD;
        let amountInEth = amount / ethPrice;

        // Now, convert amount from ETH to Wei
        const decimals = 18; // Maximum decimals for Ether
        const formattedAmount = amountInEth.toFixed(decimals);
        const amountInWei = ethers.utils.parseUnits(formattedAmount, 'ether');
        return { amountInWei };
      } else {
        throw new Error('Unexpected response structure from API');
      }
    } else {
      const response = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=MATIC&tsyms=USD');
      if (response.data && response.data.USD !== undefined) {
        let polygonPrice = response.data.USD;
        let amountInPolygon = amount / polygonPrice;
        // Now, convert amount from Polygon to Wei
        const decimals = 18; // Maximum decimals for Polygon
        const formattedAmount = amountInPolygon.toFixed(decimals);
        const amountInWei = ethers.utils.parseUnits(formattedAmount, 'ether');
        return { amountInWei };
      } else {
        throw new Error('Unexpected response structure from API');
      }
    }

  } catch (error) {
    console.log(error);
    // console.error('Error fetching ETH price:', error.message);
    throw new Error('Unable to fetch ETH price');
  }

}
//getGasEtimate

async function getGasEtimate(chainId, address, amount) {
  try {
    // Assuming gasPrice is defined somewhere in your code
    const maticGasPrice = await providerMatic.getGasPrice();
    const maticRes = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=MATIC&tsyms=USD');
    const ethGasPrice = await providerEth.getGasPrice();
    const ethRes = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD');
    if (transactions[chainId]) {
      if (chainId === "matic") {
        const contract = new ethers.Contract(MATIC_CONTRACT_ADDRESS, ABI, walletConnectedMatic);
        // console.log(transactions[chainId]);
        const storedTransactions = transactions[chainId].storedTransactions || [];

        let polygonPrice = maticRes.data?.USD;
        // Log stored transactions for debugging (comment out in production)
        // console.log(storedTransactions);

        // Estimate gas for the transactions in storedTransactions
        let estimate = await contract.estimateGas.sendMany(storedTransactions.map((tx) => [tx.address, tx.amountInWei]));

        // Calculate the cost in Wei (estimated gas * gas price)
        const costInWei = estimate.mul(maticGasPrice);

        // Convert the cost from Wei to Ether
        const costInEther = ethers.utils.formatEther(costInWei);

        // Calculate the estimated price
        let mainPrice = parseFloat(costInEther) * parseFloat(polygonPrice);

        const numUsers = io.sockets.adapter.rooms.get(chainId)?.size || 0; // Get all connected users

        // Calculate the estimated price per user (avoid division by zero)
        const estimatedPrice = numUsers !== 0 ? mainPrice / numUsers : mainPrice;

        return { estimatedPrice };
      } else {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, walletConnectedEth);
        const storedTransactions = transactions[chainId].storedTransactions || [];

        let ethPrice = ethRes.data?.USD; // Using optional chaining for safety

        // Log stored transactions for debugging (comment out in production)
        // console.log(storedTransactions);

        // Estimate gas for the transactions in storedTransactions
        let estimate = await contract.estimateGas.sendMany(storedTransactions.map((tx) => [tx.address, tx.amountInWei]));

        // Calculate the cost in Wei (estimated gas * gas price)
        const costInWei = estimate.mul(ethGasPrice);

        // Convert the cost from Wei to Ether
        const costInEther = ethers.utils.formatEther(costInWei);

        // Calculate the estimated price
        let mainPrice = parseFloat(costInEther) * parseFloat(ethPrice);

        const numUsers = io.sockets.adapter.rooms.get(chainId)?.size || 0; // Get all connected users

        // Calculate the estimated price per user (avoid division by zero)
        const estimatedPrice = numUsers !== 0 ? mainPrice / numUsers : mainPrice;

        return { estimatedPrice };
      }
    } else {
      // Check if the chain ID is Matic
      if (chainId === "matic") {
        // Create a new contract instance using the Matic contract address and ABI
        const contract = new ethers.Contract(MATIC_CONTRACT_ADDRESS, ABI, walletConnectedMatic);

        // Get the current price of Matic in USD
        let polygonPrice = maticRes.data?.USD;

        // Calculate the amount in ETH based on the Matic price
        let amountInEth = amount / polygonPrice;
        // console.log(amountInEth);
        // Set the maximum number of decimals for Ether
        const decimals = 18;

        // Format the amount in ETH to the maximum number of decimals
        const formattedAmount = amountInEth.toFixed(decimals);

        // Assume 'gasPrice' is the current gas price in Wei, which you can obtain from the network

        // Parse the amount in ETH to Wei
        const amountInWei = ethers.utils.parseUnits(formattedAmount, 'ether');

        // Estimate the gas required for the transaction
        let estimate = await contract.estimateGas.sendMany([[address, amountInWei]]);

        // Calculate the cost in Wei (estimated gas * gas price)
        const costInWei = estimate.mul(maticGasPrice);

        // Convert the cost from Wei to Ether
        const costInEther = ethers.utils.formatEther(costInWei);

        // Calculate the estimated price in USD
        let estimatedPrice = parseFloat(costInEther) * polygonPrice;

        // Return the estimated price
        return { estimatedPrice };
      } else {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, walletConnectedEth);
        let ethPrice = ethRes.data.USD; //the price of a single eth
        let amountInEth = amount / ethPrice; //get the eth equuivalent of our amount
        const decimals = 18; // Maximum decimals for Ether
        const formattedAmount = amountInEth.toFixed(decimals); //format amountInEth
        // Assume 'gasPrice' is the current gas price in Wei, which you can obtain from the network

        const amountInWei = ethers.utils.parseUnits(formattedAmount, 'ether'); //parse our amountInEth to wei
        let estimate = await contract.estimateGas.sendMany([[address, amountInWei]]); //estimate

        // Calculate the cost in Wei (estimated gas * gas price)
        const costInWei = estimate.mul(ethGasPrice);

        // Convert the cost from Wei to Ether
        const costInEther = ethers.utils.formatEther(costInWei);
        // console.log(costInEther);
        let estimatedPrice = parseFloat(costInEther) * ethPrice;
        // console.log(estimatedPrice);
        return { estimatedPrice };

      }
    }
  } catch (error) {
    console.log(error);
  }
}

//START NEW TRANSACTION
async function startNewTransaction(socket, chainId, user, address, amount) {
  console.log(`Transaction started for chain ${chainId}`);
  socket.join(chainId);
  const mainUser = await User.findOne({ _id: user.id });
  if (!mainUser) {
    return socket.emit('authenticationError', { msg: 'Invalid User data' });
  }
  const { balance } = mainUser;
  if (balance > (Number(amount) + 10)) { //we charge 0.1 for transaction , so we can have more
    let totalTime = 90000; // 1.5 minutes
    let currentTime = totalTime;
    const { amountInWei } = await getPrice(amount, chainId);
    transactions[chainId] = {
      timer: setInterval(async () => {
        currentTime -= 1000;
        const timeRemaining = getFormattedTime(currentTime);
        const numUsers = io.sockets.adapter.rooms.get(chainId)?.size || 0;
        const { estimatedPrice } = await getGasEtimate(chainId, address, amount);
        const fee = estimatedPrice + 0.1; //we add our fee which is 0.1$;
        io.to(chainId).emit('transactionUpdate', { timeRemaining, numUsers, fee: fee });
      }, 1000),
      users: [{ user: user.id, amount, socketId: socket.id }], // Add the initial user
      storedTransactions: [
        { username: user.username, address, amount, amountInWei: amountInWei }, // Add the initial transaction
      ],
      timeout:
        setTimeout(() => {
          if (transactions[chainId].timer) {
            clearInterval(transactions[chainId].timer);
            io.to(chainId).emit('transactionEnd', 'Transaction ended');
            const roomSockets = io.sockets.adapter.rooms.get(chainId);
            // Leave the room for each socket
            // Create a new room with a unique timestamp
            const newRoomId = Date.now().toString() + chainId;
            if (roomSockets) {
              roomSockets.forEach(socketId => {
                io.sockets.sockets.get(socketId).leave(chainId);
                io.sockets.sockets.get(socketId).join(newRoomId);
              });
            }
            if (transactions[chainId]) {
              const tx = transactions[chainId] ? transactions[chainId] : [];
              processTransaction(tx, newRoomId, chainId);
              // console.log(`SetTimeout:${tx}`);
              delete transactions[chainId];
            }
          }
        }, totalTime + 2000)
    };

  } else {
    return socket.emit('authenticationError', { msg: 'Amount too low for transaction' });
  }
}

io.on('connection', (socket) => {

  socket.on('joinTransaction', async ({ chain, address, amount, token }) => {
    if (!token) {
      return socket.emit('authenticationError', { msg: 'No token, Invalid credentials' });
    }
    try {
      const decoded = await jwt.verify(token, config.get('jwtSecret'));
      const user = decoded.user;
      const chainId = chain;
      const mainUser = await User.findOne({ _id: user.id });
      if (!mainUser) {
        return socket.emit('authenticationError', { msg: 'Invalid User data' });
      }
      const { balance } = mainUser;
      if (balance > (Number(amount) + 10)) { //check for balance
        if (transactions[chainId]) { //check for chainId
          socket.join(chainId);
          // console.log(transactions[chainId]);
          const { timer, users } = transactions[chainId];
          socket.emit('transactionJoin', { timeRemaining: getFormattedTime(timer._idleTimeout), users });
          // Add the user and their transaction to the transactions object
          const { estimatedPrice } = await getGasEtimate(chainId, address, amount);
          const { amountInWei } = await getPrice(amount, chainId);
          transactions[chainId].users.push({ user: user.id, amount, socketId: socket.id });
          transactions[chainId].storedTransactions.push({ username: user.username, address, amount, amountInWei });
          const numUsers = io.sockets.adapter.rooms.get(chainId)?.size || 0;
          // checking if user is up to 5, then end
          if (numUsers >= 5) {
            // Clear the interval if numUsers reaches 5
            if (transactions[chainId] && transactions[chainId].timer) {
              clearInterval(transactions[chainId].timer);
            }

            if (transactions[chainId] && transactions[chainId].timeout) {
              clearInterval(transactions[chainId].timeout);
            }

            io.to(chainId).emit('transactionEnd', 'Transaction ended');
            const roomSockets = io.sockets.adapter.rooms.get(chainId);
            const newRoomId = Date.now().toString() + chainId;
            // Leave the room for each socket
            if (roomSockets) {
              // Create a new room with a unique timestamp
              roomSockets.forEach(socketId => {
                io.sockets.sockets.get(socketId).leave(chainId);
                io.sockets.sockets.get(socketId).join(newRoomId);
              });
            }
            if (transactions[chainId]) {
              const tx = transactions[chainId] ? transactions[chainId] : [];
              processTransaction(tx, newRoomId, chainId);
              delete transactions[chainId];
            }
          }
        } else {
          startNewTransaction(socket, chainId, user, address, amount);
        }
      } else {
        return socket.emit('authenticationError', { msg: 'Amount too low for transaction' });
      }
    } catch (error) {
      console.log(error);
      socket.emit('authenticationError', { msg: 'Token is not valid' });
    }
  });

  socket.on('checkFee', async ({ chain, address, amount }) => {
    const chainId = chain;
    const { estimatedPrice } = await getGasEtimate(chainId, address, amount);
    const fee = estimatedPrice + 0.1; //the fee
    socket.emit('feechecked', { fee, address, amount });
  });

  socket.on('optOut', async ({ chain, token }) => {
    if (!token) {
      return socket.emit('authenticationError', { msg: 'No token, Invalid credentials' });
    }
    try {
      // Opt out and remove user and their transaction
      const decoded = await jwt.verify(token, config.get('jwtSecret'));
      const user = decoded.user;
      const chainId = chain;

      const { users, storedTransactions } = transactions[chainId];
      // Find index of the user in the users array
      const userIndex = users.findIndex(u => u.user == user.id);
      if (userIndex !== -1) {
        const socketId = users[userIndex].socketId;
        // Remove the user and their transaction
        users.splice(userIndex, 1);
        storedTransactions.splice(userIndex, 1);
        // console.log(socketId);
        socket.emit('optOut', `User with socket ID ${socketId} is already in the room ${chainId}. Opting out.`);
        io.sockets.sockets.get(socketId).leave(chainId);
      } else {
        socket.emit("optOut", `User with socket ID ${socketId} is not found in the room ${chainId}.`);
      }
    } catch (error) {
      console.log(error);
      socket.emit('authenticationError', { msg: 'Token is not valid' });
    }
  });
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

function getFormattedTime(ms) {
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${Math.floor(ms / 60000)}:${seconds < 10 ? '0' : ''}${seconds}`;
}



module.exports = router;