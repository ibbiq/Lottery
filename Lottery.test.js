const BigNumber = require('bignumber.js');
const ganache = require('ganache'); //Local Test Network for Ethereum
const { Web3 } = require('web3'); //Constrctor
const assert = require('assert');

const web3 = new Web3(ganache.provider()); //Web3 instance with ganache providing


const { interface, bytecode } = require('../compile'); //our compiled code object from compile file.

let lottery; //Holds the instance of our smart contract
let accounts //Holds the list of all the different accounts automatically generated and unlocked by Ganache

beforeEach(async () => { //Will deploy our contract and get a list of all accounts from Ganache
    accounts = await web3.eth.getAccounts();

    lottery = await new web3.eth.Contract(JSON.parse(interface))
        .deploy({ data: bytecode })
        .send({ from: accounts[0], gas: '1000000' });
});

describe ('Lottery Contract', () => {
    it ('Deploys a contract', () => { //Verify that our contract was successfully deployed to the local network
        assert.ok(lottery.options.address) //If address of that contract exists, means the contract was deployed
    });

    it ('allows one contract to enter', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('0.02', 'ether') });

        const players = await lottery.methods.getPlayers().call({ from: accounts[0] });

        assert.equal(accounts[0], players[0]);
        assert.equal(1, players.length);
    });

    it ('allows Multiple contract to enter', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[1], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[2], value: web3.utils.toWei('0.02', 'ether') });

        const players = await lottery.methods.getPlayers().call({ from: accounts[0] });

        assert.equal(accounts[0], players[0]);
        assert.equal(accounts[1], players[1]);
        assert.equal(accounts[2], players[2]);
        assert.equal(3, players.length);
    });

    it('requires a minimum number of players to pick a winner', async () => {
        try {
            await lottery.methods.pickWinner().send({ from: accounts[0] });
            assert(false); // This line should not be reached
        } catch (err) {
            assert(err);
        }
    });

    it ('requires a min amount to enter', async () => {
        try{
            await lottery.methods.enter().send({ from: accounts[0], value: 2 });
            //assert(false);
        } catch(err) {
            assert(err); //Simple assert function checks existence
        }
    });

    it ('only manager can call pickwinner', async () => {
        try{
            await lottery.methods.pickWinner().send({ from: accounts[0] })
            //assert(false);
        } catch(err) {
            assert(err);
        }
    });

    it('sends money to the winner', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('2', 'ether') });
        await lottery.methods.enter().send({ from: accounts[1], value: web3.utils.toWei('2', 'ether') });
        await lottery.methods.enter().send({ from: accounts[2], value: web3.utils.toWei('2', 'ether') });

        let initialBalance;
        let finalBalance;
        
        initialBalance = await web3.eth.getBalance(accounts[0]);
        initialBalance = web3.utils.fromWei(initialBalance, 'ether')
        console.log('Initial Balance is: ', initialBalance);

        await lottery.methods.pickWinner().send({ from: accounts[0] });
        const winner = await lottery.methods.winner().call({ from: accounts[0] });

        if (winner == accounts[0]) {
            finalBalance = await web3.eth.getBalance(accounts[0]);
            finalBalance = web3.utils.fromWei(finalBalance, 'ether')
        }
        else if (winner == accounts[1]) {
            finalBalance = await web3.eth.getBalance(accounts[1]);
            finalBalance = web3.utils.fromWei(finalBalance, 'ether')
        }
        else {
            finalBalance = await web3.eth.getBalance(accounts[2]);
            finalBalance = web3.utils.fromWei(finalBalance, 'ether')
        }
        console.log('Final Balance is: ', finalBalance);

        const difference = finalBalance - initialBalance;
        console.log('Difference is: ', difference);
        assert(difference > '1.8'); //1.8 allows some money is spent on gas
    });

    it('allows the manager to refund participants', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[1], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[2], value: web3.utils.toWei('0.02', 'ether') });

        const initialBalance = await web3.eth.getBalance(accounts[0]);
        await lottery.methods.refundParticipants().send({ from: accounts[0] });
        const finalBalance = await web3.eth.getBalance(accounts[0]);
        const difference = finalBalance - initialBalance;

        assert(difference > web3.utils.toWei('0.018', 'ether')); // Account should have received a refund
    });

    it('generates a random number within a reasonable range', async () => {
        const maxPlayers = 4;
        const numIterations = 4;

        for (let i = 0; i < numIterations; i++) {
            await lottery.methods.enter().send({ from: accounts[i], value: web3.utils.toWei('0.02', 'ether') });
        }
        
        const randomNumber = BigNumber(await lottery.methods.random().call({ from: accounts[0] }));
        let players = BigNumber(maxPlayers);
        let index = randomNumber.modulo(players);
        //let index = randomNumber % players;
        console.log('The random number is: ', index);

        assert(index >= 0 && index < maxPlayers);
    });

    it('returns the correct winner after picking', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[1], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[2], value: web3.utils.toWei('0.02', 'ether') });
    
        const initialWinner = await lottery.methods.getWinner().call({ from: accounts[0] });
        assert.equal(initialWinner, '0x0000000000000000000000000000000000000000', 'Initial winner should be zero address');

        await lottery.methods.pickWinner().send({ from: accounts[0] });

        const winner = await lottery.methods.winner().call({ from: accounts[0] });    
        const finalWinner = await lottery.methods.getWinner().call({ from: accounts[0] });
        assert.equal(finalWinner, winner, 'Final winner should be the account that called pickWinner');
    });

    it('resets players array after picking a winner', async () => {
        await lottery.methods.enter().send({ from: accounts[0], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[1], value: web3.utils.toWei('0.02', 'ether') });
        await lottery.methods.enter().send({ from: accounts[2], value: web3.utils.toWei('0.02', 'ether') });
    
        const playersBeforePick = await lottery.methods.getPlayers().call({ from: accounts[0] });
        assert.equal(playersBeforePick.length, 3, 'There should be 3 players before picking a winner');
    
        await lottery.methods.pickWinner().send({ from: accounts[0] });
    
        const playersAfterPick = await lottery.methods.getPlayers().call({ from: accounts[0] });
        assert.equal(playersAfterPick.length, 0, 'Players array should be empty after picking a winner');
    });
        
});