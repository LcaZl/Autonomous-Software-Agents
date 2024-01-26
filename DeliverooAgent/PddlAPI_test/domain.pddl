(define (domain deliveroo)
    (:requirements :strips :typing :negative-preconditions)
    (:types
        tile parcel agent
    )
    (:predicates
        (deliveryTile ?t - tile) 
        (active ?t - tile)
        (me ?a - agent) ; my agent
        (at ?x - (either agent parcel) ?t - tile) ; agent or parcel at a specific tile
        (carries ?a - agent ?p - parcel) ; agent carries a parcel
        (right ?t1 - tile ?t2 - tile)
        (down ?t1 - tile ?t2 - tile)
        (up ?t1 - tile ?t2 - tile)
        (left ?t1 - tile ?t2 - tile)
    )

    (:action move_right
        :parameters (?me - agent ?from ?to - tile)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (active ?to)
            (forall (?a - agent) (not (at ?a ?to))) ; No other agent is at ?to unless it's ?me
            (right ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )
    (:action move_left
        :parameters (?me - agent ?from ?to - tile)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (active ?to)
            (forall (?a - agent) (not (at ?a ?to))) ; No other agent is at ?to unless it's ?me
            (left ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )
    (:action move_up
        :parameters (?me - agent ?from ?to - tile)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (active ?to)
            (forall (?a - agent) (not (at ?a ?to))) ; No other agent is at ?to unless it's ?me
            (up ?from ?to)
        )
        :effect (and
            (at ?me ?to)
            (not (at ?me ?from))
        )
    )
    
    (:action move_down
        :parameters (?me - agent ?from ?to - tile)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (active ?to)
            (forall (?a - agent) (not (at ?a ?to))) ; No other agent is at ?to unless it's ?me
            (down ?from ?to)
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
            (not (carries ?me ?p))
        )
        :effect (and
            (carries ?me ?p)
            (not (at ?p ?t))
        )
    )

    (:action deliver
        :parameters (?me - agent ?t - tile)
        :precondition (and
            (me ?me)
            (deliveryTile ?t)
            (at ?me ?t)
        )
        :effect (and
            (forall (?p - parcel) (not (carries ?me ?p)))
        )
    )
)
