#!/usr/bin/env node
import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { Environment } from './environment.js';
import { Planner } from './planner.js'
import { randomDirection, distance } from './utils.js';
import { Beliefs } from "../beliefs.js";

export class DeliverooAgent{

    #host = null
    #token = null 

    constructor(host, token) {
        this.#host = host
        this.#token = token 
        this.x = []
        this.y = []
        this.client = new DeliverooApi(this.#host, this.#token);
        this.client.onDisconnect(() => console.log("Socket Disconnected!"));

        this.client.onConnect(() => console.log("[INIT] Agent Connected to Deliveroo!"));

        this.client.onYou( ( {id, name, x, y, score} ) => {
            this.id = id
            this.name = name
            this.x[0] = Math.ceil(x)
            this.y[0] = Math.ceil(y)
            this.score = score

        })

        this.host = host;
        this.token = token;
        this.parcels = new Map()
        this.myParcels = 0
        this.otherPlayers = new Map()
        this.beliefs = new Beliefs()
  }

    async initialization() {
    
        return new Promise(async (resolve, reject) => {
    
            const initMove = async () => {
                try {
                    await this.client.move(randomDirection());
                    console.log("[INIT] First move done.");
                    return true;
                } catch (error) {
                    console.error("[INITERROR] Error during first move call.\nError:\n", error);
                    return false;
                }
            };

            const initEnvironment = async () => {
                try {
                    this.environment = new Environment(this.client.map, this.client.config);
                    return true;
                } catch (error) {
                    console.error("[INITERROR] Error during environment loading.\nError:\n", error);
                    return false;
                }
            };
        
            const initPlanner = async () => {
                this.planner = new Planner()
                let plannerStatus = this.planner.init()
                return plannerStatus
            }

            const initBeliefSet = async () => {
                this.beliefs.init(this)
                console.log('[INIT] Belief set initialized.\n')
                return true
            }

            const callbacks = [initMove, initEnvironment, initPlanner, initBeliefSet];
        
            try {

                for (const callback of callbacks) {
                    const success = await callback();
            
                    if (!success) {
                        reject(new Error("Initialization failed at " + callback.name));
                        return;
                    }
                }
                console.log('[INIT] Initialization Complete.');
                this.activateSensing()
                resolve(true);

            } catch (error) {
                console.error("[INITERROR] Error during initialization.\nError:\n", error);
                reject(error);
            }
        });
    }

    activateSensing(){
        this.client.onParcelsSensing((sensedParcels) => {
            for(let p of sensedParcels){
                var utility = this.parcelUtility(p.reward, p.x, p.y, this.x, this.y, this.otherPlayers)
                this.parcels.set(p.id, {
                    'Reward':p.reward,
                    'x': p.x,
                    'y': p.y,
                    'CarriedBy':p.carriedBy,
                    'Utility': parseFloat(utility)
                })
            }
        })

        this.client.onAgentsSensing( (agents) => {
            for (const a of agents) {

                if ( a.x % 1 != 0 || a.y % 1 != 0 ) continue;// skip intermediate values (0.6 or 0.4)

                    console.log('[AGENT] Meet', a.name, '-', a)
                    this.otherPlayers.set(a.id, {
                    'name':a.name,
                    'x': Math.ceil(a.x), 
                    'y': Math.ceil(a.y),
                    'score': a.score
                    })
            }
        })

        console.log('[INIT] Sensing Activated')
    }

    parcelUtility(reward, px, py, ax, ay){

        var term1 = reward / (distance(ax, ay, px, py) + 1)

        var term2 = 0
        for (let a of this.otherPlayers.values()){
            term2 += 1 / (distance(a.x, a.y, px, py) + 1)
        }

        return (term1 - term2).toFixed(2)
    }
}



