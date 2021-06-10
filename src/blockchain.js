/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const BlockClass = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, reject) => {
      resolve(this.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    let self = this;
    function validateChain() {
      const resolutionPromise = (validChain) => {
        return new Promise((resolve, reject) => {
          if (!validChain) {
            reject("Failed to add block to chain - chain validation failed");
          } else {
            resolve("");
          }
        });
      };
      return self
        .validateChain()
        .then((errors) => {
          return errors.length === 0;
        })
        .then(resolutionPromise);
    }

    function updateBlock(block) {
      return new Promise((resolve) => {
        if (self.height > -1) {
          block.previousBlockHash = self.chain[self.height].hash;
        }

        block.height = self.height + 1;
        block.time = Date.now();
        block.hash = SHA256(block);
        resolve(block);
      });
    }

    function updateChain(block) {
      return new Promise((resolve) => {
        self.height += 1;

        self.chain.push(block);
        resolve(block);
      });
    }
    return validateChain()
      .then(() => updateBlock(block))
      .then(updateChain);
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      resolve(`${address}:${`${Date.now()}`.slice(0, -3)}:starRegistry`);
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        const msgTime = parseInt(message.split(":")[1], 10);
        const currentTime = parseInt(`${Date.now()}`.slice(0, -3), 10);
        const timeElapsedInSeconds = currentTime - msgTime;
        if (timeElapsedInSeconds > 300) {
          reject(
            "Cannot submit star. More than 5 minutes have elapsed since the message was produced"
          );
        }
        const verified = bitcoinMessage.verify(message, address, signature);
        if (!verified) reject("Verification failed");
        const block = new BlockClass.Block({
          star,
          address,
          message,
          signature,
        });
        const b = self._addBlock(block);
        resolve(b);
      } catch (e) {
        reject(`There's been an error ~~ ${e}`);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      const block = self.chain.find((b) => b.hash === hash);
      resolve(block);
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter((p) => p.height === height)[0];
      if (block) {
        resolve(block);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    return Promise.all(
      self.chain.map((block) => {
        return block.getBData();
      })
    ).then((blocks) => {
      return blocks.filter((b) => {
        if (!b) return false;
        return b.address === address;
      });
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  async validateChain() {
    let self = this;
    let errors = [];
    function validatePreviousHash(block, previousBlock) {
      const previousBlockHash = previousBlock ? previousBlock.hash : "";
      const isGenesisBlock = block.height < 1;
      const isPreviousHashValid =
        (isGenesisBlock && block.previousBlockHash === null) ||
        JSON.stringify(block.previousBlockHash) ===
          JSON.stringify(previousBlockHash);
      return isPreviousHashValid;
    }

    for (let i = 0; i < self.chain.length; i++) {
      const block = self.chain[i];
      const previousBlock = i > 0 ? self.chain[i - 1] : null;
      const validPreviousHash = validatePreviousHash(block, previousBlock);
      const validBlock = await block.validate();

      if (!validPreviousHash || !validBlock) {
        const errorBlock = {
          block,
          errors: [],
        };
        if (!validPreviousHash)
          errorBlock.errors.push(
            "previousBlockHash does not match the hash of the previous block"
          );
        if (!validBlock)
          errorBlock.errors.push("block fails hash recalculation validation");
        errors.push(errorBlock);
      }
    }
    return errors;
  }
}

module.exports.Blockchain = Blockchain;
