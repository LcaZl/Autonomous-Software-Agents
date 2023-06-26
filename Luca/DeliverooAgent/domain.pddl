(define (domain deliveroo)
    (:requirements :strips)
    (:types
        tile parcel agent
    )
    (:predicates
        (tile ?t)
        (delivery ?t)
        (agent ?a)
        (parcel ?p)
        (me ?a)
        (at ?agentOrParcel ?tile)
        (carries ?a ?p)
    )
    
    (:action move
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
        )
        :effect (and
            (at ?me ?to)
			(not (at ?me ?from))
        )
    )
    
    (:action pickup
        :parameters (?me ?p ?t)
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
        :parameters (?me ?p ?t)
        :precondition (and
            (me ?me)
            (carries ?me ?p)
            (delivery ?t)
            (at ?me ?t)
        )
        :effect (and
            (not (carries ?me ?p))
        )
    )
)