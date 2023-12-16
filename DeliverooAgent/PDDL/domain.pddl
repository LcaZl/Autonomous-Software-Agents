(define (domain deliveroo)
    (:requirements :strips :typing :negative-preconditions)
    (:types
        tile parcel agent 
    )
    (:predicates
        (deliveryTile ?t - tile) 
        (me ?a - agent) ; my agent
        (at ?x - (either agent parcel) ?t - tile) ; agent or parcel at a specific tile
        (carries ?a - agent ?p - parcel) ; agent carries a parcel
        (right ?t1 - tile ?t2 - tile)
        (down ?t1 - tile ?t2 - tile)
        (up ?t1 - tile ?t2 - tile)
        (left ?t1 - tile ?t2 - tile)
    )
(:action move
    :parameters (?me - agent ?from ?to - tile)
    :precondition (and
        (me ?me)
        (at ?me ?from)
        (forall (?a - agent) (not (at ?a ?to))) ; No other agent is at ?to unless it's ?me
        (or
            (right ?from ?to)
            (left ?from ?to)
            (down ?from ?to)
            (up ?from ?to)
        )
    )
    :effect (and
        (at ?me ?to)
        (not (at ?me ?from))
    )
)

(:action pickup
    :parameters (?me - agent ?p - parcel ?t - tile)
    :precondition (and
        (me ?me)
        (at ?me ?t)
        (at ?p ?t)
    )
    :effect (and
        (carries ?me ?p)
        (not (at ?p ?t))
    )
)

(:action deliver
    :parameters (?me - agent ?p - parcel ?t - tile)
    :precondition (and
        (me ?me)
        (carries ?me ?p)
        (deliveryTile ?t)
        (at ?me ?t)
    )
    :effect (and
        (not (carries ?me ?p))
        (not (at ?p ?t)) ; parcel is delivered, no longer on the tile
    )
)
)
