pragma solidity ^0.4.17;

contract Lottery {
    address public manager;
    address[] public players;
    address public winner;
    uint public minimumPlayers = 3;

    event WinnerDeclared(address winner);

    function Lottery() public {
        manager = msg.sender;
    }
    
    function enter() public payable {
        require(msg.value > .01 ether);
        players.push(msg.sender);
    }
    
    function getParticipantContribution(address participant) public view returns (uint) {
        for (uint i = 0; i < players.length; i++) {
            if (players[i] == participant) {
                return address(this).balance * 1 / players.length;
            }
        }
    }
    
    //uses a customized function to design a makeshift random number function
    function random() public view returns (uint) {
        return uint(keccak256(block.difficulty, now, players)); 
    }
    
    function pickWinner() public restricted {
        require(players.length >= minimumPlayers);
        
        uint index = random() % players.length;
        winner = players[index];
        winner.transfer(this.balance);
        players = new address[](0);
        
        WinnerDeclared(winner);
    }

    function refundParticipants() public restricted {
        for (uint i = 0; i < players.length; i++) {
            address participant = players[i];
            uint amount = getParticipantContribution(participant);
            participant.transfer(amount);
        }
    }
    
    modifier restricted() {
        require(msg.sender == manager);
        _;
    }
    
    function getPlayers() public view returns (address[]) {
        return players;
    }

    function getWinner() public view returns (address) {
        return winner;
    }

    function setMinimumPlayers(uint _minimumPlayers) public restricted {
        minimumPlayers = _minimumPlayers;
    }
}   