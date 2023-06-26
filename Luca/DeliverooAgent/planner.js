#!/usr/bin/env node
import { onlineSolver, PddlExecutor, PddlProblem, Beliefset, PddlDomain, PddlAction } from "@unitn-asa/pddl-client";

export class Planner {


  constructor(host, token) {
    this.planLibrary = [];
    path = 'domain.pddl'
    this.domain = new Beliefset(path);
    myBeliefset.toPddlString()
  }
}
