(define (domain deliveroo)
    (:requirements :strips)
    (:types
        tile parcel agent
    )
    (:predicates
        (delivery ?t)
        (me ?a)
        (at ?agentOrParcel ?tile)
        (carries ?a ?p)
        (right ?t1 ?t2)
        (down ?t1 ?tt2)
        (up ?t1 ?t2)
        (left ?t1 ?t2)
    )

    (:action move-left
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (left ?to ?from)
            (right ?from ?to)
        )
        :effect (and
            (at ?me ?to)
			(not (at ?me ?from))
        )
    )


    (:action move-right
        :parameters (?me ?from ?to)
        :precondition (and
            (me ?me)
            (at ?me ?from)
            (left ?from ?to)
            (right ?to ?from)
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
            (up ?from ?to)
            (down ?to ?from)
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
            (up ?to ?from)
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
