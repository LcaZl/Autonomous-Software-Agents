
import { PddlProblem, Beliefset } from '@unitn-asa/pddl-client';
import fs from 'fs'
import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";


let beliefs = new Beliefset()

beliefs.declare('me agent1')
beliefs.declare('at agent1 t1_2')
console.log(1, '\n', beliefs.toPddlString(), beliefs.objects)

beliefs.removeFact('at agent1 t1_2')
console.log(2, '\n', beliefs.toPddlString(), beliefs.objects)

beliefs.declare('me agent1')
beliefs.declare('at agent1 t1_5')
console.log(3, '\n', beliefs.toPddlString(), beliefs.objects)
