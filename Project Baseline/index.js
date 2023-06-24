#!/usr/bin/env node
import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import * as pddlClient from "@unitn-asa/pddl-client";
import { default as config } from "./config.js";

const client = new DeliverooApi(config.host, config.token)
client.onConnect(() => console.log("socket", client.socket.id));
client.onDisconnect(() => console.log("disconnected", client.socket.id));


function show_belief(list){
    if (list.size == 0) {
        console.log('Map is empty')
    }
    for (let v of list){
        console.log(v)
    }
}

async function agentLoop() {
    const parcel_list = new Map()
    var deliverTiles = new Map()
    var myself = {
        x : 0,
        y : 0
    }
    var randomValue
    var count = 0
    await client.move('down')
    for (let el of client.map.tiles){
        if (el.delivery == true){
            deliverTiles.set('' + el.x + '-' + el.y, null)
        }
    }
    console.log('Deliver tiles:')
    console.log(deliverTiles)

    while(count < 200){
        randomValue = Math.floor(Math.random() * 4) + 1
        console.log('\nMove ' + count + ' -> ' + randomValue)
        switch(randomValue){
            case 1:
                let down = client.move('down') 
                await down.then((status) => {
                    myself.x = status.x 
                    myself.y = status.y
            }) 
            break

            case 2:
                let up =  client.move('up')
                await up.then((status) => {
                    myself.x = status.x 
                    myself.y = status.y
            }) 
            break

            case 3:
                let right =  client.move('right')
                await right.then((status) => {
                    myself.x = status.x 
                    myself.y = status.y
            }) 
            break

            case 4:
                let left =  client.move('left')
                await left.then((status) => {
                    myself.x = status.x 
                    myself.y = status.y
            }) 
            break     
        }

        client.onParcelsSensing((parcels) => {
            for(let p of parcels){
                parcel_list.set(p.id, {
                    'Reward':p.reward,
                    'x': p.x,
                    'y': p.y,
                    'CariedBy':p.carriedBy
                })
            }
        })
        console.log('Current position -> (' + myself.x + ',' + myself.y + ')')  
        show_belief(parcel_list)

        let parcelToPickup = null;
        for(let parcel of parcel_list.values()){
            if(parcel.x == myself.x && parcel.y == myself.y){
                parcelToPickup = parcel;
                break;
            }
        }
        if(parcelToPickup != null){
            var pickup = client.pickup()
            await pickup.then((parcel) => console.log('Parcel Taken!'))
        }
    
        if (deliverTiles.has(''+ myself.x + '-' + myself.y)){
            await client.putdown() 
        }

        count++   
    }
}


agentLoop()