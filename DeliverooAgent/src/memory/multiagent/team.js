export class Team {

  constructor() {
    this.hashMap = {};
    this.orderArray = [];
    this.teamId = 'TEAM-NAME'
    this.TEAM_FORMATION = true; 
    this.TEAM_SIZE = 2; 
    this.MASTER = false; 
    this.MASTER_SET = false;
    this.myRanking = Math.floor(Math.random() * 100) + 1;
    this.masterId = null 
  }

  insert(agentId, rankingNumber) {
    const key = agentId;

    if (!this.hashMap[key]) {
      const agent = { id: agentId, rankingNumber : rankingNumber };
      this.hashMap[key] = agent;
      this.orderArray.push(agent);
      this.orderArray.sort((a, b) => a.rankingNumber - b.rankingNumber);
    }
  }

  find(agentId) {
    const agent = this.hashMap[agentId];
    return agent ? agent : null;
  }

  getOrderedTeam() {
    return [...this.orderArray];
  }

  getAgentWithHighestRanking() {
    const orderedTeam = this.getOrderedTeam();
    return orderedTeam.length > 0 ? {
        id: orderedTeam[orderedTeam.length - 1].id,
        rankingNumber: orderedTeam[orderedTeam.length - 1].rankingNumber
    } : null;
}

  getNumberOfMembers() {
    return this.orderArray.length;
  }

  displayTeamMembers() {
    const orderedTeam = this.getOrderedTeam();

    console.log('Team Members:');
    orderedTeam.forEach(member => {
        console.log(`ID: ${member.id}, Ranking: ${member.rankingNumber}`);
    });
}


}

export class MasterIdPool {
  constructor() {
    this.answerPool = {};
    this.voteCount = {};
  }

  addAnswer(agentId, masterId) {
    // Check if the agent has already provided an answer, if so ignore it 
    if (!this.answerPool[agentId]) {
      this.answerPool[agentId] = masterId;

      // Increment the vote count for the given masterId
      this.voteCount[masterId] = (this.voteCount[masterId] || 0) + 1;
    }
  }

  getMostVotedMasterId() {
    let mostVotedMasterId = null;
    let maxVotes = 0;

    for (const masterId in this.voteCount) {
      if (this.voteCount[masterId] > maxVotes) {
        mostVotedMasterId = masterId;
        maxVotes = this.voteCount[masterId];
      }
    }

    return mostVotedMasterId;
  }
}