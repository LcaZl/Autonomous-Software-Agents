(define (domain deliveroo)
    (:requirements :strips)
    (:predicates
        (tile ?t)
        (delivery ?t)
        (agent ?a)
        (parcel ?p)
        (me ?a)
        (at ?agentOrParcel ?tile)
        (right ?t1 ?t2)
        (left ?t1 ?t2)
        (up ?t1 ?t2)
        (down ?t1 ?t2)
        (carries ?a ?p)
    )
    
    (:action move-right
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (right ?from ?to)
        )
        :effect (and
            (at ?me ?to)
			(not (at ?me ?from))
        )
    )
    
    (:action move-left
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (left ?from ?to)
        )
        :effect (and
            (at ?me ?to)
			(not (at ?me ?from))
        )
    )
    
    (:action move-up
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (up ?from ?to)
        )
        :effect (and
            (at ?me ?to)
			(not (at ?me ?from))
        )
    )
    
    (:action move-down
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (down ?from ?to)
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
